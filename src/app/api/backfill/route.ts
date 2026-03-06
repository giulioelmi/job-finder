import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function matchesJobType(title: string, jobTypes: string[]): boolean {
  if (jobTypes.length === 0 || (jobTypes.includes('internship') && jobTypes.includes('fulltime'))) {
    return true
  }
  const isIntern = title.toLowerCase().includes('intern')
  if (jobTypes.includes('internship') && !jobTypes.includes('fulltime')) return isIntern
  if (jobTypes.includes('fulltime') && !jobTypes.includes('internship')) return !isIntern
  return true
}

// Backfills job_notifications from jobs already in the local DB.
// Useful when settings change or jobs were missed by the cron.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()

  const { data: settings } = await serviceClient
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const searchAll: boolean = settings?.search_all_companies ?? false
  const userCompanies: string[] = (settings?.companies ?? []).map((c: string) => c.toLowerCase())
  const keywords: string[] = ((settings?.categories ?? []) as string[]).map((k: string) => k.toLowerCase())
  const jobTypes: string[] = settings?.job_types ?? ['internship', 'fulltime']
  const userLocation = (settings?.location ?? '').trim().toLowerCase()

  // Fetch jobs found in the last 7 days from the local DB
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: jobs, error } = await serviceClient
    .from('jobs')
    .select('id, title, company, location, external_id')
    .gte('found_at', since)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ added: 0, message: 'No jobs found in the last 7 days.' })
  }

  // Apply user filters
  const matching = jobs.filter(job => {
    // Company filter (skip when searching all)
    if (!searchAll && userCompanies.length > 0) {
      const companyLower = (job.company ?? '').toLowerCase()
      const slugFromId = job.external_id?.split('_')[1]?.toLowerCase() ?? ''
      if (!userCompanies.includes(companyLower) && !userCompanies.includes(slugFromId)) return false
    }

    const titleLower = job.title.toLowerCase()

    // Keyword filter
    if (keywords.length > 0 && !keywords.some(kw => titleLower.includes(kw))) return false

    // Location filter
    if (userLocation && !job.location?.toLowerCase().includes(userLocation)) return false

    // Job type filter
    if (!matchesJobType(job.title, jobTypes)) return false

    return true
  })

  if (matching.length === 0) {
    return NextResponse.json({ added: 0, message: 'No matching jobs found in the local database.' })
  }

  // Check which ones already have notifications
  const { data: existingNotifs } = await serviceClient
    .from('job_notifications')
    .select('job_id')
    .eq('user_id', user.id)
    .in('job_id', matching.map(j => j.id))

  const notifiedIds = new Set((existingNotifs ?? []).map(n => n.job_id))
  const newJobs = matching.filter(j => !notifiedIds.has(j.id))

  if (newJobs.length === 0) {
    return NextResponse.json({ added: 0, message: 'All matching jobs are already in your notifications.' })
  }

  const { error: insertError } = await serviceClient
    .from('job_notifications')
    .insert(newJobs.map(j => ({ user_id: user.id, job_id: j.id })))

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ added: newJobs.length, message: `Added ${newJobs.length} job(s) to your notifications.` })
}
