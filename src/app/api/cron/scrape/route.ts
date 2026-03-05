import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { scrapeLinkedInJobs, ScrapedJob } from '@/lib/scraper'
import { sendJobNotificationEmail } from '@/lib/email'
import { JOB_CATEGORIES, JOB_TYPES } from '@/lib/categories'

// Cron runs every 5 minutes. Each run processes one category (both job types),
// rotating through all 8 categories. Full cycle = 8 × 5 min = 40 minutes.
// → 2 LinkedIn requests per run, ~24/hour — low enough to avoid rate limiting.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Determine which category to process this run based on current time slot
  const slotIndex = Math.floor(Date.now() / (5 * 60 * 1000)) % JOB_CATEGORIES.length
  const category = JOB_CATEGORIES[slotIndex]

  // Clean up notifications older than 24 hours (do this on every run)
  await supabase
    .from('job_notifications')
    .delete()
    .lt('notified_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const runResults: Record<string, { scraped: number; notified_users: number }> = {}

  // Scrape this category for each job type (internship + full-time)
  for (const jobType of JOB_TYPES) {
    const result = await scrapeLinkedInJobs(category.keywords as unknown as string[], '', jobType.linkedinCode)

    if (!result.ok) {
      console.error(`[cron] Scrape failed for ${category.id}/${jobType.id}: ${result.message}`)
      runResults[`${category.id}/${jobType.id}`] = { scraped: 0, notified_users: 0 }
      continue
    }

    const scraped = result.jobs
    runResults[`${category.id}/${jobType.id}`] = { scraped: scraped.length, notified_users: 0 }

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

    // Fetch the DB ids for the scraped jobs
    const { data: jobRows } = await supabase
      .from('jobs')
      .select('id, linkedin_id, location')
      .in('linkedin_id', scraped.map(j => j.linkedin_id))

    if (!jobRows || jobRows.length === 0) continue

    // Find users who want this category + job type, with email notifications on
    const { data: matchingUsers } = await supabase
      .from('user_settings')
      .select('user_id, categories, job_types, location, email_notifications, notification_email')
      .contains('categories', [category.id])
      .contains('job_types', [jobType.id])
      .eq('email_notifications', true)

    if (!matchingUsers || matchingUsers.length === 0) continue

    for (const user of matchingUsers) {
      // Filter jobs by user's location preference (if set)
      const userLocation = (user.location ?? '').trim().toLowerCase()
      const relevantJobRows = userLocation
        ? jobRows.filter(j => j.location?.toLowerCase().includes(userLocation))
        : jobRows

      if (relevantJobRows.length === 0) continue

      // Find which jobs this user hasn't been notified about yet
      const { data: existingNotifs } = await supabase
        .from('job_notifications')
        .select('job_id')
        .eq('user_id', user.user_id)
        .in('job_id', relevantJobRows.map(j => j.id))

      const notifiedIds = new Set((existingNotifs ?? []).map(n => n.job_id))
      const newJobRows = relevantJobRows.filter(j => !notifiedIds.has(j.id))

      if (newJobRows.length === 0) continue

      // Insert notifications
      await supabase.from('job_notifications').insert(
        newJobRows.map(j => ({ user_id: user.user_id, job_id: j.id }))
      )

      // Send email
      const email = user.notification_email
      if (email) {
        const newJobDetails: ScrapedJob[] = newJobRows
          .map(jr => scraped.find(s => s.linkedin_id === jr.linkedin_id))
          .filter((j): j is ScrapedJob => !!j)
        await sendJobNotificationEmail(email, newJobDetails)
      }

      runResults[`${category.id}/${jobType.id}`].notified_users++
    }
  }

  return NextResponse.json({
    success: true,
    slot: slotIndex,
    category: category.id,
    results: runResults,
  })
}
