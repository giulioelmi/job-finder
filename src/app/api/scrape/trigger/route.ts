import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchGreenhouseJobs, GreenhouseJob } from '@/lib/greenhouse'
import { fetchAshbyJobs, AshbyJob } from '@/lib/ashby'
import { sendJobNotificationEmail } from '@/lib/email'
import { ALL_GREENHOUSE_COMPANIES, ALL_ASHBY_COMPANIES } from '@/lib/categories'

// US state abbreviations for location matching
const US_STATE_RE = /,\s*(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)(\s|,|$)/i

function isUSLocation(location: string | null | undefined): boolean {
  if (!location) return true
  const loc = location.toLowerCase()
  if (loc.includes('united states')) return true
  if (loc.includes('u.s.')) return true
  if (loc.includes('usa')) return true
  if (loc.includes('remote')) return true
  if (US_STATE_RE.test(loc)) return true
  return false
}

type ScrapedJob = GreenhouseJob | AshbyJob

// Manual trigger — fetches companies based on user settings, filters by keywords and job type.
// Uses the same 14-day created_at window so results are consistent.
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
  const ghCompanies: string[] = searchAll ? ALL_GREENHOUSE_COMPANIES : (settings?.companies ?? [])
  const ashbyCompanies: string[] = searchAll ? ALL_ASHBY_COMPANIES : (settings?.ashby_companies ?? [])
  const keywords: string[] = settings?.categories ?? []
  const jobTypes: string[] = settings?.job_types ?? ['internship', 'fulltime']

  if (ghCompanies.length === 0 && ashbyCompanies.length === 0) {
    return NextResponse.json(
      { error: 'No companies configured. Add company slugs in Settings.' },
      { status: 400 }
    )
  }

  let totalFound = 0
  let totalNew = 0
  const allNewJobs: ScrapedJob[] = []

  // Fetch jobs from last 14 days, filtered by user's keywords and job types
  const createdAfter = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const [ghResults, ashbyResults] = await Promise.all([
    Promise.allSettled(ghCompanies.map(slug => fetchGreenhouseJobs(slug, keywords, jobTypes, createdAfter))),
    Promise.allSettled(ashbyCompanies.map(slug => fetchAshbyJobs(slug, keywords, jobTypes, createdAfter))),
  ])

  // Collect all fetched jobs from both APIs
  const allBatches: ScrapedJob[][] = []

  for (let i = 0; i < ghCompanies.length; i++) {
    const res = ghResults[i]
    if (res.status === 'rejected' || !res.value.ok) {
      if (res.status === 'rejected' || (res.value as { ok: false; reason: string }).reason !== 'not_found') {
        const msg = res.status === 'rejected' ? res.reason : (res.value as { ok: false; message: string }).message
        console.error(`[trigger] Greenhouse fetch failed for "${ghCompanies[i]}": ${msg}`)
      }
      continue
    }
    if (res.value.jobs.length > 0) allBatches.push(res.value.jobs)
  }

  for (let i = 0; i < ashbyCompanies.length; i++) {
    const res = ashbyResults[i]
    if (res.status === 'rejected' || !res.value.ok) {
      if (res.status === 'rejected' || (res.value as { ok: false; reason: string }).reason !== 'not_found') {
        const msg = res.status === 'rejected' ? res.reason : (res.value as { ok: false; message: string }).message
        console.error(`[trigger] Ashby fetch failed for "${ashbyCompanies[i]}": ${msg}`)
      }
      continue
    }
    if (res.value.jobs.length > 0) allBatches.push(res.value.jobs)
  }

  // Process each batch: upsert to DB, then notify user
  for (const fetched of allBatches) {
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
        { onConflict: 'external_id', ignoreDuplicates: false }
      )

    const { data: jobRows } = await serviceClient
      .from('jobs')
      .select('id, external_id, location')
      .in('external_id', fetched.map(j => j.external_id))

    if (!jobRows) continue

    const relevantJobRows = jobRows.filter(j => isUSLocation(j.location))

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
        .filter((j): j is ScrapedJob => !!j)
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
      : 'No matching jobs found in the last 14 days across tracked companies.'

  return NextResponse.json({ found: totalFound, new: totalNew, message })
}
