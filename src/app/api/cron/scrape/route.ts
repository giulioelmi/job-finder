import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchGreenhouseJobs, GreenhouseJob } from '@/lib/greenhouse'
import { sendJobNotificationEmail } from '@/lib/email'
import { ALL_GREENHOUSE_COMPANIES } from '@/lib/categories'

async function getAllSlugs(supabase: ReturnType<typeof createServiceClient>): Promise<string[]> {
  const { data } = await supabase.from('greenhouse_slugs').select('slug')
  if (data && data.length > 0) return data.map((r: { slug: string }) => r.slug)
  // Fall back to the hardcoded list if the table is empty or missing
  return ALL_GREENHOUSE_COMPANIES
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
    .select('user_id, search_all_companies, companies, categories, job_types, location, email_notifications, notification_email')

  if (!allSettings || allSettings.length === 0) {
    return NextResponse.json({ success: true, message: 'No users configured.' })
  }

  // Build the unique set of companies to fetch this run
  const companySet = new Set<string>()
  const anySearchAll = allSettings.some(u => u.search_all_companies)
  if (anySearchAll) {
    const allSlugs = await getAllSlugs(supabase)
    allSlugs.forEach(c => companySet.add(c))
  }
  for (const row of allSettings) {
    if (!row.search_all_companies) {
      for (const slug of (row.companies as string[] | null) ?? []) {
        if (slug) companySet.add(slug)
      }
    }
  }

  const companiesToCheck = Array.from(companySet)

  if (companiesToCheck.length === 0) {
    return NextResponse.json({ success: true, message: 'No companies configured by any user.' })
  }

  // Clean up notifications older than 24 hours
  await supabase
    .from('job_notifications')
    .delete()
    .lt('notified_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  // Fetch jobs created in the last 30 minutes across all companies in parallel
  const createdAfter = new Date(Date.now() - 30 * 60 * 1000)
  const fetchResults = await Promise.allSettled(
    companiesToCheck.map(slug => fetchGreenhouseJobs(slug, [], [], createdAfter))
  )

  // Build a flat map of external_id → GreenhouseJob for all fetched jobs
  const allFetched = new Map<string, GreenhouseJob>()
  const companyJobs = new Map<string, GreenhouseJob[]>() // slug → jobs
  for (let i = 0; i < companiesToCheck.length; i++) {
    const res = fetchResults[i]
    if (res.status === 'rejected' || !res.value.ok) continue
    const jobs = res.value.jobs
    companyJobs.set(companiesToCheck[i], jobs)
    for (const job of jobs) allFetched.set(job.external_id, job)
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
  await supabase.from('jobs').upsert(jobsToUpsert, { onConflict: 'external_id', ignoreDuplicates: true })

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
    const userCompanies: string[] = searchAll ? Array.from(companySet) : (user.companies ?? [])
    const userKeywords = ((user.categories as string[] | null) ?? []).map(k => k.toLowerCase())
    const userJobTypes: string[] = user.job_types ?? ['internship', 'fulltime']
    const userLocation = (user.location ?? '').trim().toLowerCase()

    // Filter job rows relevant to this user
    const relevantRows = jobRows.filter(j => {
      const job = allFetched.get(j.external_id)
      if (!job) return false
      if (!userCompanies.includes(job.company)) return false

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
        .filter((j): j is GreenhouseJob => !!j)
      await sendJobNotificationEmail(user.notification_email, newJobDetails)
    }

    notifiedUsers++
  }

  return NextResponse.json({
    success: true,
    fetched: allFetched.size,
    companiesChecked: companiesToCheck.length,
    notifiedUsers,
  })
}
