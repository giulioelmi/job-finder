import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
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

// Cron runs every 20 minutes, fetching ALL companies regardless of user settings.
// User settings are only used for per-user email notifications.
// The 30-minute window (vs 20-minute interval) ensures no jobs are missed between runs.
// Deduplication is handled by job_notifications — users are never notified twice.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Always scrape ALL companies — independent of whether any users exist
  const [ghSlugs, ashbySlugs] = await Promise.all([
    getAllGreenhouseSlugs(supabase),
    getAllAshbySlugs(supabase),
  ])

  // Clean up notifications older than 7 days
  await supabase
    .from('job_notifications')
    .delete()
    .lt('notified_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  // Fetch all jobs created in the last 30 minutes from all companies, unfiltered
  const createdAfter = new Date(Date.now() - 30 * 60 * 1000)

  const [ghResults, ashbyResults] = await Promise.all([
    Promise.allSettled(ghSlugs.map(slug => fetchGreenhouseJobs(slug, [], [], createdAfter))),
    Promise.allSettled(ashbySlugs.map(slug => fetchAshbyJobs(slug, [], [], createdAfter))),
  ])

  const allFetched = new Map<string, ScrapedJob>()

  for (let i = 0; i < ghSlugs.length; i++) {
    const res = ghResults[i]
    if (res.status === 'rejected' || !res.value.ok) continue
    for (const job of res.value.jobs) allFetched.set(job.external_id, job)
  }

  for (let i = 0; i < ashbySlugs.length; i++) {
    const res = ashbyResults[i]
    if (res.status === 'rejected' || !res.value.ok) continue
    for (const job of res.value.jobs) allFetched.set(job.external_id, job)
  }

  if (allFetched.size === 0) {
    return NextResponse.json({ success: true, fetched: 0, companiesChecked: ghSlugs.length + ashbySlugs.length, message: 'No new jobs in the last 30 minutes.' })
  }

  const fetchedJobs = Array.from(allFetched.values())
  const { data: existingJobs } = await supabase
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

  // Upsert all fetched jobs into the central catalog
  await supabase.from('jobs').upsert(
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

  // Fetch user settings for email notifications only
  const { data: allSettings } = await supabase
    .from('user_settings')
    .select('user_id, search_all_companies, companies, ashby_companies, categories, job_types, experience_levels, email_notifications, notification_email')

  if (!allSettings || allSettings.length === 0) {
    return NextResponse.json({ success: true, fetched: allFetched.size, companiesChecked: ghSlugs.length + ashbySlugs.length, notifiedUsers: 0 })
  }

  // Fetch DB rows for the upserted jobs
  const { data: jobRows } = await supabase
    .from('jobs')
    .select('id, external_id, location, title')
    .in('external_id', Array.from(allFetched.keys()))

  if (!jobRows || jobRows.length === 0) {
    return NextResponse.json({ success: true, fetched: allFetched.size, companiesChecked: ghSlugs.length + ashbySlugs.length, notifiedUsers: 0 })
  }

  // Notify each user based on their settings
  let notifiedUsers = 0
  for (const user of allSettings) {
    const searchAll: boolean = user.search_all_companies ?? false
    const userGhCompanies: string[] = searchAll ? ghSlugs : (user.companies ?? [])
    const userAshbyCompanies: string[] = searchAll ? ashbySlugs : (user.ashby_companies ?? [])
    const userKeywords = ((user.categories as string[] | null) ?? []).map(k => k.toLowerCase())
    const userJobTypes: string[] = user.job_types ?? ['internship', 'fulltime']
    const userExperienceLevels: string[] = user.experience_levels ?? []

    const relevantRows = jobRows.filter(j => {
      const job = allFetched.get(j.external_id)
      if (!job) return false

      if (job.source === 'greenhouse') {
        if (!userGhCompanies.includes(job.slug)) return false
      } else {
        if (!userAshbyCompanies.includes(job.slug)) return false
      }

      const titleLower = j.title.toLowerCase()
      if (userKeywords.length > 0 && !userKeywords.some(kw => titleLower.includes(kw))) return false
      if (!isUSLocation(j.location)) return false

      if (!matchesJobType(j.title, userJobTypes)) return false
      if (!matchesExperienceLevel(j.title, userExperienceLevels)) return false

      return true
    })

    if (relevantRows.length === 0) continue

    const { data: existingNotifs } = await supabase
      .from('job_notifications')
      .select('job_id')
      .eq('user_id', user.user_id)
      .in('job_id', relevantRows.map(j => j.id))

    const notifiedIds = new Set((existingNotifs ?? []).map(n => n.job_id))
    const newRows = relevantRows.filter(j => !notifiedIds.has(j.id))
    if (newRows.length === 0) continue

    await supabase.from('job_notifications').insert(
      newRows.map(j => ({ user_id: user.user_id, job_id: j.id }))
    )

    if (user.email_notifications && user.notification_email) {
      const newJobDetails = newRows
        .map(jr => allFetched.get(jr.external_id))
        .filter((j): j is ScrapedJob => !!j)
      await sendJobNotificationEmail(user.notification_email, newJobDetails)
    }

    notifiedUsers++
  }

  return NextResponse.json({
    success: true,
    fetched: allFetched.size,
    companiesChecked: ghSlugs.length + ashbySlugs.length,
    notifiedUsers,
  })
}
