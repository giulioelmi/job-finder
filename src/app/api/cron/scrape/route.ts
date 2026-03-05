import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { scrapeLinkedInJobs, ScrapedJob } from '@/lib/scraper'
import { sendJobNotificationEmail } from '@/lib/email'

// Called by cron every 30 minutes (e.g. via cron-job.org or Vercel Cron)
// Secured with a secret header to prevent unauthorized runs
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all users with email notifications enabled
  const { data: allSettings, error: settingsError } = await supabase
    .from('user_settings')
    .select('*, auth_users:user_id(email)')
    .eq('email_notifications', true)

  if (settingsError) {
    console.error('Failed to fetch settings:', settingsError)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!allSettings || allSettings.length === 0) {
    return NextResponse.json({ message: 'No users with notifications enabled' })
  }

  const results: Record<string, { found: number; new: number; notified: boolean }> = {}

  for (const settings of allSettings) {
    const userId = settings.user_id
    const userEmail = settings.notification_email ?? (settings as { auth_users?: { email?: string } }).auth_users?.email

    try {
      // Scrape LinkedIn using this user's settings
      const scraped = await scrapeLinkedInJobs(
        settings.keywords,
        settings.location ?? '',
        settings.time_period ?? 1800
      )

      if (scraped.length === 0) {
        results[userId] = { found: 0, new: 0, notified: false }
        continue
      }

      // Upsert jobs into the jobs table (ignore duplicates)
      const { error: upsertError } = await supabase
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

      if (upsertError) {
        console.error(`Upsert error for user ${userId}:`, upsertError)
        continue
      }

      // Fetch job IDs for the scraped linkedin_ids
      const { data: jobRows } = await supabase
        .from('jobs')
        .select('id, linkedin_id')
        .in('linkedin_id', scraped.map(j => j.linkedin_id))

      if (!jobRows) continue

      // Find which jobs this user has NOT been notified about yet
      const { data: existingNotifs } = await supabase
        .from('job_notifications')
        .select('job_id')
        .eq('user_id', userId)
        .in('job_id', jobRows.map(j => j.id))

      const notifiedJobIds = new Set((existingNotifs ?? []).map(n => n.job_id))
      const newJobRows = jobRows.filter(j => !notifiedJobIds.has(j.id))

      if (newJobRows.length === 0) {
        results[userId] = { found: scraped.length, new: 0, notified: false }
        continue
      }

      // Insert notifications for new jobs
      await supabase.from('job_notifications').insert(
        newJobRows.map(j => ({ user_id: userId, job_id: j.id }))
      )

      // Send email if user has an email address
      let notified = false
      if (userEmail) {
        const newJobDetails: ScrapedJob[] = newJobRows
          .map(jr => scraped.find(s => s.linkedin_id === jr.linkedin_id))
          .filter((j): j is ScrapedJob => !!j)

        await sendJobNotificationEmail(userEmail, newJobDetails)
        notified = true
      }

      results[userId] = { found: scraped.length, new: newJobRows.length, notified }
    } catch (err) {
      console.error(`Error processing user ${userId}:`, err)
      results[userId] = { found: 0, new: 0, notified: false }
    }
  }

  return NextResponse.json({ success: true, results })
}
