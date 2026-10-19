import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildCareerProfile } from '@/lib/ai/profile-builder'

export const maxDuration = 300

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row } = await supabase.from('career_profiles').select('resume_paths').eq('user_id', user.id).single()
  const paths: string[] = row?.resume_paths ?? []
  if (paths.length === 0) return NextResponse.json({ error: 'Upload at least one resume first' }, { status: 400 })

  try {
    const service = createServiceClient()
    const pdfs = await Promise.all(paths.map(async path => {
      const { data, error } = await service.storage.from('resumes').download(path)
      if (error || !data) throw new Error(`Could not read ${path}`)
      return Buffer.from(await data.arrayBuffer())
    }))

    const profile = await buildCareerProfile(pdfs)
    await service.from('career_profiles').update({ profile }).eq('user_id', user.id)
    return NextResponse.json({ profile })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'PROFILE_BUILD_FAILED', detail }, { status: 500 })
  }
}
