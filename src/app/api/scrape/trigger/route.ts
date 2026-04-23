import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchGreenhouseJobs, GreenhouseJob } from '@/lib/greenhouse'
import { fetchAshbyJobs, AshbyJob } from '@/lib/ashby'
import { sendJobNotificationEmail } from '@/lib/email'
import { ALL_GREENHOUSE_COMPANIES, ALL_ASHBY_COMPANIES } from '@/lib/categories'
import { isUSLocation, matchesExperienceLevel, matchesJobType } from '@/lib/job-utils'
import { scrapeExperienceYearsForJobs } from '@/lib/experience'

type ScrapedJob = GreenhouseJob | AshbyJob

async function getAllGreenhouseSlugs(supabase: ReturnType<typeof createServiceClient>): Promise<string[]> {
  const { data } = await supabase.from('greenhouse_slugs').select('slug')
  if (data && data.length > 0) return data.map((r: { slug: string }) => r.slug)
  return ALL_GREENHOUSE_COMPANIES
}

async function getAllAshbySlugs(supabase: ReturnType<typeof createServiceClient>): Promise<string[]> {
  const { data } = await supabase.from('ashby_slugs').select('slug')
  if (data && data.length > 0) return data.map((r: { slug: string }) => r.slug)
  return ALL_ASHBY_COMPANIES
}

// Manual trigger — scrapes ALL companies unfiltered, then notifies the current user
// based on their settings. Uses a 14-day window so results are consistent.
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
  const userGhCompanies: string[] = searchAll ? [] : ((settings?.companies ?? []) as string[])
  const userAshbyCompanies: string[] = searchAll ? [] : ((settings?.ashby_companies ?? []) as string[])
  const userKeywords: string[] = ((settings?.categories ?? []) as string[]).map((k: string) => k.toLowerCase())
  const userJobTypes: string[] = (settings?.job_types as string[] | null) ?? ['internship', 'fulltime']
  const userExperienceLevels: string[] = (settings?.experience_levels as string[] | null) ?? []

  // Always scrape ALL companies — filtering happens after
  const [ghSlugs, ashbySlugs] = await Promise.all([
    getAllGreenhouseSlugs(serviceClient),
    getAllAshbySlugs(serviceClient),
  ])

  const createdAfter = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const [ghResults, ashbyResults] = await Promise.all([
    Promise.allSettled(ghSlugs.map(slug => fetchGreenhouseJobs(slug, [], [], createdAfter))),
    Promise.allSettled(ashbySlugs.map(slug => fetchAshbyJobs(slug, [], [], createdAfter))),
  ])

  // Collect all fetched jobs
  const allFetched = new Map<string, ScrapedJob>()

  for (let i = 0; i < ghSlugs.length; i++) {
    const res = ghResults[i]
    if (res.status === 'rejected' || !res.value.ok) {
      if (res.status === 'rejected' || (res.value as { ok: false; reason: string }).reason !== 'not_found') {
        const msg = res.status === 'rejected' ? res.reason : (res.value as { ok: false; message: string }).message
        console.error(`[trigger] Greenhouse fetch failed for "${ghSlugs[i]}": ${msg}`)
      }
      continue
    }
    for (const job of res.value.jobs) allFetched.set(job.external_id, job)
  }

  for (let i = 0; i < ashbySlugs.length; i++) {
    const res = ashbyResults[i]
    if (res.status === 'rejected' || !res.value.ok) {
      if (res.status === 'rejected' || (res.value as { ok: false; reason: string }).reason !== 'not_found') {
        const msg = res.status === 'rejected' ? res.reason : (res.value as { ok: false; message: string }).message
        console.error(`[trigger] Ashby fetch failed for "${ashbySlugs[i]}": ${msg}`)
      }
      continue
    }
    for (const job of res.value.jobs) allFetched.set(job.external_id, job)
  }

  if (allFetched.size === 0) {
    return NextResponse.json({ found: 0, new: 0, message: 'No jobs found in the last 14 days.' })
  }

  const fetchedJobs = Array.from(allFetched.values())
  const { data: existingJobs } = await serviceClient
    .from('jobs')
    .select('external_id, experience_years')
    .in('external_id', fetchedJobs.map(j => j.external_id))

  const existingExperience = new Map(
    (existingJobs ?? []).map(j => [j.external_id as string, j.experience_years as number | null])
  )

  const jobsNeedingScrape = fetchedJobs
    .filter(j => existingExperience.get(j.external_id) == null)
    .map(j => ({ external_id: j.external_id, url: j.url }))

  const scrapedExperience = await scrapeExperienceYearsForJobs(jobsNeedingScrape)

  // Upsert all fetched jobs to the central catalog
  await serviceClient.from('jobs').upsert(
    fetchedJobs.map(j => ({
      external_id: j.external_id,
      title: j.title,
      company: j.company,
      location: j.location,
      url: j.url,
      posted_at: j.posted_at,
      experience_years: existingExperience.get(j.external_id) ?? scrapedExperience.get(j.external_id) ?? null,
    })),
    { onConflict: 'external_id', ignoreDuplicates: false }
  )

  // Fetch DB rows for all upserted jobs
  const { data: jobRows } = await serviceClient
    .from('jobs')
    .select('id, external_id, location, title')
    .in('external_id', Array.from(allFetched.keys()))

  if (!jobRows || jobRows.length === 0) {
    return NextResponse.json({ found: allFetched.size, new: 0, message: `Fetched ${allFetched.size} jobs — none stored.` })
  }

  // Filter to jobs matching this user's preferences
  const matchingRows = jobRows.filter(j => {
    const job = allFetched.get(j.external_id)
    if (!job) return false

    // Company filter
    if (!searchAll) {
      if (job.source === 'greenhouse') {
        if (!userGhCompanies.includes(job.slug)) return false
      } else {
        if (!userAshbyCompanies.includes(job.slug)) return false
      }
    }

    const titleLower = j.title.toLowerCase()
    if (userKeywords.length > 0 && !userKeywords.some(kw => titleLower.includes(kw))) return false

    if (!matchesJobType(j.title, userJobTypes)) return false

    if (!matchesExperienceLevel(j.title, userExperienceLevels)) return false

    if (!isUSLocation(j.location)) return false

    return true
  })

  if (matchingRows.length === 0) {
    return NextResponse.json({
      found: allFetched.size,
      new: 0,
      message: `Fetched ${allFetched.size} jobs across ${ghSlugs.length + ashbySlugs.length} companies — none matched your filters.`,
    })
  }

  // Deduplicate against already-notified jobs
  const { data: existingNotifs } = await serviceClient
    .from('job_notifications')
    .select('job_id')
    .eq('user_id', user.id)
    .in('job_id', matchingRows.map(j => j.id))

  const notifiedIds = new Set((existingNotifs ?? []).map(n => n.job_id))
  const newRows = matchingRows.filter(j => !notifiedIds.has(j.id))

  if (newRows.length > 0) {
    await serviceClient.from('job_notifications').insert(
      newRows.map(j => ({ user_id: user.id, job_id: j.id }))
    )
  }

  const allNewJobs = newRows
    .map(jr => allFetched.get(jr.external_id))
    .filter((j): j is ScrapedJob => !!j)

  if (allNewJobs.length > 0 && settings?.email_notifications) {
    const email = settings.notification_email ?? user.email
    if (email) await sendJobNotificationEmail(email, allNewJobs)
  }

  const message = newRows.length > 0
    ? `Found ${newRows.length} new job(s) matching your filters out of ${allFetched.size} fetched.`
    : `Fetched ${allFetched.size} jobs — all ${matchingRows.length} matching ones already seen.`

  return NextResponse.json({ found: allFetched.size, new: newRows.length, message })
}
