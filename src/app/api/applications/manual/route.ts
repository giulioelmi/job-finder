import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, company, location, url, status } = await req.json()
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const service = createServiceClient()

  // Insert the job (service role, since jobs table requires service role for inserts)
  const external_id = `manual-${randomUUID()}`
  const { data: job, error: jobError } = await service
    .from('jobs')
    .insert({ external_id, title, company: company || null, location: location || null, url: url || '', is_manual: true })
    .select('id')
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }

  // Insert the application
  const { data: application, error: appError } = await service
    .from('applications')
    .insert({ user_id: user.id, job_id: job.id, status: status ?? 'applied' })
    .select('*, jobs(title, company, location, url)')
    .single()

  if (appError || !application) {
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 })
  }

  return NextResponse.json({ application })
}
