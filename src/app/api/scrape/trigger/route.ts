import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchGreenhouseJobs, GreenhouseJob } from '@/lib/greenhouse'
import { sendJobNotificationEmail } from '@/lib/email'
import { ALL_GREENHOUSE_COMPANIES } from '@/lib/categories'

// Manual trigger — fetches companies based on user settings, filters by keywords and job type.
// Uses the same 30-minute created_at window as the cron so results are consistent.
export async function POST(_req: NextRequest) {
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
  const companies: string[] = searchAll ? ALL_GREENHOUSE_COMPANIES : (settings?.companies ?? [])
  const keywords: string[] = settings?.categories ?? []
  const jobTypes: string[] = settings?.job_types ?? ['internship', 'fulltime']

  if (companies.length === 0) {
    return NextResponse.json(
      { error: 'No companies configured. Add company slugs in Settings.' },
      { status: 400 }
    )
  }

  const userLocation = (settings?.location ?? '').trim().toLowerCase()
  let totalFound = 0
  let totalNew = 0
  const allNewJobs: GreenhouseJob[] = []

  // Fetch jobs created in the last 30 minutes (same window as cron)
  const createdAfter = new Date(Date.now() - 30 * 60 * 1000)
  const results = await Promise.allSettled(
    companies.map(slug => fetchGreenhouseJobs(slug, keywords, jobTypes, createdAfter))
  )

  for (let i = 0; i < companies.length; i++) {
    const res = results[i]
    if (res.status === 'rejected' || !res.value.ok) {
      const msg = res.status === 'rejected' ? res.reason : (res.value as { ok: false; message: string }).message
      console.error(`[trigger] Greenhouse fetch failed for "${companies[i]}": ${msg}`)
      continue
    }

    const fetched = res.value.jobs
    if (fetched.length === 0) continue

    totalFound += fetched.length

    await serviceClient
      .from('jobs')
      .upsert(
        fetched.map(j => ({
          external_id: j.external_id,
          title: j.title,
          company: j.company,
          location: j.location,
          url: j.url,
          posted_at: j.posted_at,
        })),
        { onConflict: 'external_id', ignoreDuplicates: true }
      )

    const { data: jobRows } = await serviceClient
      .from('jobs')
      .select('id, external_id, location')
      .in('external_id', fetched.map(j => j.external_id))

    if (!jobRows) continue

    const relevantJobRows = userLocation
      ? jobRows.filter(j => j.location?.toLowerCase().includes(userLocation))
      : jobRows

    if (relevantJobRows.length === 0) continue

    const { data: existingNotifs } = await serviceClient
      .from('job_notifications')
      .select('job_id')
      .eq('user_id', user.id)
      .in('job_id', relevantJobRows.map(j => j.id))

    const notifiedIds = new Set((existingNotifs ?? []).map(n => n.job_id))
    const newJobRows = relevantJobRows.filter(j => !notifiedIds.has(j.id))

    if (newJobRows.length === 0) continue

    await serviceClient.from('job_notifications').insert(
      newJobRows.map(j => ({ user_id: user.id, job_id: j.id }))
    )

    totalNew += newJobRows.length
    allNewJobs.push(
      ...newJobRows
        .map(jr => fetched.find(f => f.external_id === jr.external_id))
        .filter((j): j is GreenhouseJob => !!j)
    )
  }

  if (allNewJobs.length > 0 && settings?.email_notifications) {
    const email = settings.notification_email ?? user.email
    if (email) await sendJobNotificationEmail(email, allNewJobs)
  }

  const message = totalNew > 0
    ? `Found ${totalNew} new job(s) out of ${totalFound} fetched.`
    : totalFound > 0
      ? `Fetched ${totalFound} job(s) — all already seen.`
      : 'No jobs posted in the last 30 minutes across tracked companies.'

  return NextResponse.json({ found: totalFound, new: totalNew, message })
}
