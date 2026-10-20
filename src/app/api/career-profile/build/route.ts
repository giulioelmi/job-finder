import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildCareerProfile } from '@/lib/ai/profile-builder'

export const maxDuration = 300

// Builds the student's profile from all their uploaded resumes and saves it in Profiles
// (autofill_profiles). A rebuild only replaces what the AI fills in: experience, education,
// projects, skills and job targets. Address, work authorization, DEI, Q&A, salary and the
// application resume are never touched, and a contact field the AI finds empty never blanks one the user typed.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row } = await supabase.from('career_profiles').select('resume_paths').eq('user_id', user.id).maybeSingle()
  const paths: string[] = row?.resume_paths ?? []
  if (paths.length === 0) return NextResponse.json({ error: 'Upload at least one resume first' }, { status: 400 })

  try {
    const service = createServiceClient()
    const pdfs = await Promise.all(paths.map(async path => {
      const { data, error } = await service.storage.from('resumes').download(path)
      if (error || !data) throw new Error(`Could not read ${path}`)
      return Buffer.from(await data.arrayBuffer())
    }))

    const built = await buildCareerProfile(pdfs)
    // An empty result means the PDFs had no readable content: keep the existing profile
    if (built.work_experience.length + built.projects.length + built.education.length === 0)
      return NextResponse.json({ error: 'EMPTY_PROFILE', detail: 'We could not find any resume content in your PDFs. If they are scanned images, export a text-based PDF and try again.' }, { status: 422 })

    const { target_titles, target_locations, education, work_experience, projects, skills, ...contact } = built
    const filled = Object.fromEntries(Object.entries(contact).filter(([, v]) => v)) // only non-empty contact fields
    const fields = { ...filled, target_titles, target_locations, education, work_experience, projects, skills }

    const { data: existing } = await service.from('autofill_profiles').select('id').eq('user_id', user.id).eq('use_for_agent', true).maybeSingle()
    const query = existing
      ? service.from('autofill_profiles').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', existing.id).eq('user_id', user.id)
      : service.from('autofill_profiles').insert({ ...fields, name: 'My resumes (AI)', user_id: user.id, use_for_agent: true })
    const { data: saved, error } = await query.select('id, name').single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ profile_id: saved.id, name: saved.name, created: !existing })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'PROFILE_BUILD_FAILED', detail }, { status: 500 })
  }
}
