import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (bearerToken) {
    const service = createServiceClient()
    const { data: { user } } = await service.auth.getUser(bearerToken)
    return user?.id ?? null
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!['pdf', 'doc', 'docx'].includes(ext))
    return NextResponse.json({ error: 'Invalid file type. Use PDF, DOC, or DOCX.' }, { status: 400 })

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })

  const service = createServiceClient()
  const path = `${userId}/${id}/resume.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await service.storage
    .from('resumes')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

  if (uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { error: updateError } = await service
    .from('autofill_profiles')
    .update({ resume_url: path, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ resume_url: path })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const service = createServiceClient()

  const { data: profile } = await service
    .from('autofill_profiles')
    .select('resume_url')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!profile?.resume_url)
    return NextResponse.json({ error: 'No resume uploaded' }, { status: 404 })

  const { data, error } = await service.storage
    .from('resumes')
    .createSignedUrl(profile.resume_url, 3600)

  if (error || !data)
    return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 500 })

  const filename = profile.resume_url.split('/').pop() ?? 'resume'
  return NextResponse.json({ signed_url: data.signedUrl, filename })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const service = createServiceClient()

  const { data: profile } = await service
    .from('autofill_profiles')
    .select('resume_url')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (profile?.resume_url) {
    await service.storage.from('resumes').remove([profile.resume_url])
  }

  await service
    .from('autofill_profiles')
    .update({ resume_url: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  return NextResponse.json({ success: true })
}
