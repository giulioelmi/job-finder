import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { scrapeLinkedInJobs, ScrapedJob } from '@/lib/scraper'
import { sendJobNotificationEmail } from '@/lib/email'
import { JOB_TYPES } from '@/lib/categories'

// Cron runs every 5 minutes. Each run picks one unique job title (from all users' settings),
// scrapes it, and notifies users who track that title. Full cycle time depends on
// the number of unique titles across all users.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Gather all unique job titles from all users' settings
  const { data: allSettings } = await supabase
    .from('user_settings')
    .select('categories')

  const uniqueTitles: string[] = []
  for (const row of allSettings ?? []) {
    for (const title of (row.categories as string[] | null) ?? []) {
      if (title && !uniqueTitles.includes(title)) {
        uniqueTitles.push(title)
      }
    }
  }

  if (uniqueTitles.length === 0) {
    return NextResponse.json({ success: true, message: 'No job titles configured by any user.' })
  }

  // Rotate through titles based on current 5-minute slot
  const slotIndex = Math.floor(Date.now() / (5 * 60 * 1000)) % uniqueTitles.length
  const currentTitle = uniqueTitles[slotIndex]

  // Clean up notifications older than 24 hours
  await supabase
    .from('job_notifications')
    .delete()
    .lt('notified_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const runResults: Record<string, { scraped: number; notified_users: number }> = {}

  // Scrape this title for each job type
  for (const jobType of JOB_TYPES) {
    const result = await scrapeLinkedInJobs([currentTitle], '', jobType.linkedinCode)

    if (!result.ok) {
      console.error(`[cron] Scrape failed for "${currentTitle}"/${jobType.id}: ${result.message}`)
      runResults[`${currentTitle}/${jobType.id}`] = { scraped: 0, notified_users: 0 }
      continue
    }

    const scraped = result.jobs
    runResults[`${currentTitle}/${jobType.id}`] = { scraped: scraped.length, notified_users: 0 }

    if (scraped.length === 0) continue

    // Upsert jobs into the central jobs table
    await supabase
      .from('jobs')
      .upsert(
        scraped.map(j => ({
          linkedin_id: j.linkedin_id,
          title: j.title,
          company: j.company,
          location: j.location,
          url: j.url,
          posted_at: j.posted_at,
        })),
        { onConflict: 'linkedin_id', ignoreDuplicates: true }
      )

    // Fetch DB ids for the scraped jobs
    const { data: jobRows } = await supabase
      .from('jobs')
      .select('id, linkedin_id, location')
      .in('linkedin_id', scraped.map(j => j.linkedin_id))

    if (!jobRows || jobRows.length === 0) continue

    // Find users who track this job title and this job type, with email notifications on
    const { data: matchingUsers } = await supabase
      .from('user_settings')
      .select('user_id, categories, job_types, location, email_notifications, notification_email')
      .contains('job_types', [jobType.id])
      .eq('email_notifications', true)

    if (!matchingUsers) continue

    // Filter to users who actually have this title in their categories
    const usersWantingTitle = matchingUsers.filter(u =>
      (u.categories as string[] | null)?.includes(currentTitle)
    )

    for (const user of usersWantingTitle) {
      const userLocation = (user.location ?? '').trim().toLowerCase()
      const relevantJobRows = userLocation
        ? jobRows.filter(j => j.location?.toLowerCase().includes(userLocation))
        : jobRows

      if (relevantJobRows.length === 0) continue

      const { data: existingNotifs } = await supabase
        .from('job_notifications')
        .select('job_id')
        .eq('user_id', user.user_id)
        .in('job_id', relevantJobRows.map(j => j.id))

      const notifiedIds = new Set((existingNotifs ?? []).map(n => n.job_id))
      const newJobRows = relevantJobRows.filter(j => !notifiedIds.has(j.id))

      if (newJobRows.length === 0) continue

      await supabase.from('job_notifications').insert(
        newJobRows.map(j => ({ user_id: user.user_id, job_id: j.id }))
      )

      const email = user.notification_email
      if (email) {
        const newJobDetails: ScrapedJob[] = newJobRows
          .map(jr => scraped.find(s => s.linkedin_id === jr.linkedin_id))
          .filter((j): j is ScrapedJob => !!j)
        await sendJobNotificationEmail(email, newJobDetails)
      }

      runResults[`${currentTitle}/${jobType.id}`].notified_users++
    }
  }

  return NextResponse.json({
    success: true,
    slot: slotIndex,
    title: currentTitle,
    totalTitles: uniqueTitles.length,
    results: runResults,
  })
}
