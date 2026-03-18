import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  // Support both cookie auth (web app) and Bearer token (Chrome extension)
  let user = null

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase.auth.getUser(token)
    user = data.user
  } else {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })

  const { title, company, location, url, status } = await req.json()
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400, headers: CORS_HEADERS })

  const service = createServiceClient()

  const external_id = `manual-${randomUUID()}`
  const { data: job, error: jobError } = await service
    .from('jobs')
    .insert({ external_id, title, company: company || null, location: location || null, url: url || '' })
    .select('id')
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500, headers: CORS_HEADERS })
  }

  const { data: application, error: appError } = await service
    .from('applications')
    .insert({ user_id: user.id, job_id: job.id, status: status ?? 'applied' })
    .select('*, jobs(title, company, location, url)')
    .single()

  if (appError || !application) {
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500, headers: CORS_HEADERS })
  }

  return NextResponse.json({ application }, { headers: CORS_HEADERS })
}
