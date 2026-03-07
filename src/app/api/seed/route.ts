import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const SAMPLE_JOBS = [
  {
    external_id: 'sample-001',
    title: 'Product Manager Intern',
    company: 'Stripe',
    location: 'San Francisco, CA',
    url: 'https://www.linkedin.com/jobs/view/sample-001/',
    posted_at: new Date().toISOString(),
  },
  {
    external_id: 'sample-002',
    title: 'Data Analyst Intern',
    company: 'Airbnb',
    location: 'Remote',
    url: 'https://www.linkedin.com/jobs/view/sample-002/',
    posted_at: new Date().toISOString(),
  },
  {
    external_id: 'sample-003',
    title: 'Product Intern',
    company: 'Notion',
    location: 'New York, NY',
    url: 'https://www.linkedin.com/jobs/view/sample-003/',
    posted_at: new Date().toISOString(),
  },
]

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Insert sample jobs
  await service.from('jobs').upsert(SAMPLE_JOBS, { onConflict: 'external_id', ignoreDuplicates: true })

  // Fetch their IDs
  const { data: jobs } = await service
    .from('jobs')
    .select('id')
    .in('external_id', SAMPLE_JOBS.map(j => j.external_id))

  if (!jobs) return NextResponse.json({ error: 'Failed to insert jobs' }, { status: 500 })

  // Notify the current user of all sample jobs
  await service.from('job_notifications').upsert(
    jobs.map(j => ({ user_id: user.id, job_id: j.id })),
    { onConflict: 'user_id,job_id', ignoreDuplicates: true }
  )

  // Also add a sample application
  await service.from('applications').upsert(
    [{ user_id: user.id, job_id: jobs[0].id, status: 'interview', notes: 'Phone screen went well!' }],
    { onConflict: 'user_id,job_id', ignoreDuplicates: true }
  )

  return NextResponse.json({ ok: true })
}
