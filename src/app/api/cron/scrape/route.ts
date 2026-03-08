import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchGreenhouseJobs, GreenhouseJob } from '@/lib/greenhouse'
import { fetchAshbyJobs, AshbyJob } from '@/lib/ashby'
import { sendJobNotificationEmail } from '@/lib/email'
import { ALL_GREENHOUSE_COMPANIES, ALL_ASHBY_COMPANIES } from '@/lib/categories'

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

// Cron runs every 20 minutes, fetching jobs created in the last 30 minutes.
// The intentional 10-minute overlap ensures no jobs are missed between runs.
// Deduplication is handled by job_notifications — users are never notified twice.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: allSettings } = await supabase
    .from('user_settings')
    .select('user_id, search_all_companies, companies, ashby_companies, categories, job_types, location, email_notifications, notification_email')

  if (!allSettings || allSettings.length === 0) {
    return NextResponse.json({ success: true, message: 'No users configured.' })
  }

  // Build the unique sets of slugs to fetch this run — Greenhouse and Ashby separately
  const ghSet = new Set<string>()
  const ashbySet = new Set<string>()
  const anySearchAll = allSettings.some(u => u.search_all_companies)

  if (anySearchAll) {
    const [ghSlugs, ashbySlugs] = await Promise.all([
      getAllGreenhouseSlugs(supabase),
      getAllAshbySlugs(supabase),
    ])
    ghSlugs.forEach(s => ghSet.add(s))
    ashbySlugs.forEach(s => ashbySet.add(s))
  }

  for (const row of allSettings) {
    if (!row.search_all_companies) {
      for (const slug of (row.companies as string[] | null) ?? []) {
        if (slug) ghSet.add(slug)
      }
      for (const slug of (row.ashby_companies as string[] | null) ?? []) {
        if (slug) ashbySet.add(slug)
      }
    }
  }

  const ghSlugsToCheck = Array.from(ghSet)
  const ashbySlugsToCheck = Array.from(ashbySet)

  if (ghSlugsToCheck.length === 0 && ashbySlugsToCheck.length === 0) {
    return NextResponse.json({ success: true, message: 'No companies configured by any user.' })
  }

  // Clean up notifications older than 24 hours
  await supabase
    .from('job_notifications')
    .delete()
    .lt('notified_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  // Fetch jobs created in the last 30 minutes from both APIs in parallel
  const createdAfter = new Date(Date.now() - 30 * 60 * 1000)

  const [ghResults, ashbyResults] = await Promise.all([
    Promise.allSettled(ghSlugsToCheck.map(slug => fetchGreenhouseJobs(slug, [], [], createdAfter))),
    Promise.allSettled(ashbySlugsToCheck.map(slug => fetchAshbyJobs(slug, [], [], createdAfter))),
  ])

  // Build a flat map of external_id → ScrapedJob for all fetched jobs
  const allFetched = new Map<string, ScrapedJob>()

  for (let i = 0; i < ghSlugsToCheck.length; i++) {
    const res = ghResults[i]
    if (res.status === 'rejected' || !res.value.ok) continue
    for (const job of res.value.jobs) allFetched.set(job.external_id, job)
  }

  for (let i = 0; i < ashbySlugsToCheck.length; i++) {
    const res = ashbyResults[i]
    if (res.status === 'rejected' || !res.value.ok) continue
    for (const job of res.value.jobs) allFetched.set(job.external_id, job)
  }

  if (allFetched.size === 0) {
    return NextResponse.json({ success: true, fetched: 0, message: 'No new jobs in the last 30 minutes.' })
  }

  // Upsert all fetched jobs into the central catalog
  const jobsToUpsert = Array.from(allFetched.values()).map(j => ({
    external_id: j.external_id,
    title: j.title,
    company: j.company,
    location: j.location,
    url: j.url,
    posted_at: j.posted_at,
  }))
  await supabase.from('jobs').upsert(jobsToUpsert, { onConflict: 'external_id', ignoreDuplicates: false })

  // Fetch DB rows for the upserted jobs
  const { data: jobRows } = await supabase
    .from('jobs')
    .select('id, external_id, location, title')
    .in('external_id', Array.from(allFetched.keys()))

  if (!jobRows || jobRows.length === 0) {
    return NextResponse.json({ success: true, fetched: allFetched.size, notifiedUsers: 0 })
  }

  // Notify each user
  let notifiedUsers = 0
  for (const user of allSettings) {
    const searchAll: boolean = user.search_all_companies ?? false
    const userGhCompanies: string[] = searchAll ? ghSlugsToCheck : (user.companies ?? [])
    const userAshbyCompanies: string[] = searchAll ? ashbySlugsToCheck : (user.ashby_companies ?? [])
    const userKeywords = ((user.categories as string[] | null) ?? []).map(k => k.toLowerCase())
    const userJobTypes: string[] = user.job_types ?? ['internship', 'fulltime']
    const userLocation = (user.location ?? '').trim().toLowerCase()

    // Filter job rows relevant to this user
    const relevantRows = jobRows.filter(j => {
      const job = allFetched.get(j.external_id)
      if (!job) return false

      // Match company against the correct API's company list
      if (job.source === 'greenhouse') {
        if (!userGhCompanies.includes(job.slug)) return false
      } else {
        if (!userAshbyCompanies.includes(job.slug)) return false
      }

      const titleLower = j.title.toLowerCase()
      if (userKeywords.length > 0 && !userKeywords.some(kw => titleLower.includes(kw))) return false
      if (userLocation && !j.location?.toLowerCase().includes(userLocation)) return false

      // Job type filter
      const isIntern = titleLower.includes('intern')
      const wantIntern = userJobTypes.includes('internship')
      const wantFull = userJobTypes.includes('fulltime')
      if (wantIntern && !wantFull && !isIntern) return false
      if (wantFull && !wantIntern && isIntern) return false

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
    companiesChecked: ghSlugsToCheck.length + ashbySlugsToCheck.length,
    notifiedUsers,
  })
}
