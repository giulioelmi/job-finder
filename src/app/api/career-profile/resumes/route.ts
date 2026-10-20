import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const MAX_FILES = 5
// Vercel rejects request bodies over 4.5 MB, so the client uploads one file per request
const MAX_BYTES = 4 * 1024 * 1024

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  const files = (formData?.getAll('files') ?? []) as File[]
  if (files.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

  const { data: row } = await supabase.from('career_profiles').select('resume_paths').eq('user_id', user.id).single()
  const paths: string[] = row?.resume_paths ?? []
  if (paths.length + files.length > MAX_FILES)
    return NextResponse.json({ error: `You can upload at most ${MAX_FILES} resumes` }, { status: 400 })

  const service = createServiceClient()
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.pdf'))
      return NextResponse.json({ error: `${file.name} is not a PDF. Resumes must be PDF files.` }, { status: 400 })
    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: `${file.name} is larger than 4 MB` }, { status: 400 })

    const bytes = Buffer.from(await file.arrayBuffer())
    if (bytes.subarray(0, 5).toString() !== '%PDF-')
      return NextResponse.json({ error: `${file.name} is not a real PDF. Export your resume as a PDF and try again.` }, { status: 400 })

    const path = `${user.id}/career/${Date.now()}_${file.name.replace(/[^a-z0-9._-]+/gi, '_')}`
    const { error } = await service.storage.from('resumes').upload(path, bytes, { contentType: 'application/pdf' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    paths.push(path)
  }

  await service.from('career_profiles').upsert({ user_id: user.id, resume_paths: paths }, { onConflict: 'user_id' })
  return NextResponse.json({ resume_paths: paths })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = req.nextUrl.searchParams.get('path') ?? ''
  const { data: row } = await supabase.from('career_profiles').select('resume_paths').eq('user_id', user.id).single()
  const paths: string[] = row?.resume_paths ?? []
  if (!paths.includes(path)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const service = createServiceClient()
  await service.storage.from('resumes').remove([path])
  const remaining = paths.filter(p => p !== path)
  await service.from('career_profiles').update({ resume_paths: remaining }).eq('user_id', user.id)
  return NextResponse.json({ resume_paths: remaining })
}
