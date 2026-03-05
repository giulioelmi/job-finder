import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { scrapeLinkedInJobs, ScrapedJob } from '@/lib/scraper'
import { sendJobNotificationEmail } from '@/lib/email'
import { JOB_TYPES } from '@/lib/categories'

const VALID_TIME_FILTERS = new Set(['r3600', 'r86400', 'r604800', 'r2592000'])

// Manual trigger — scrapes all of the current user's selected job titles immediately
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let timeFilter = 'r86400'
  try {
    const body = await req.json()
    if (body.timeFilter && VALID_TIME_FILTERS.has(body.timeFilter)) {
      timeFilter = body.timeFilter
    }
  } catch { /* no body is fine */ }

  const serviceClient = createServiceClient()

  const { data: settings } = await serviceClient
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!settings || !settings.categories?.length || !settings.job_types?.length) {
    return NextResponse.json(
      { error: 'No job titles selected. Please configure your search in Settings.' },
      { status: 400 }
    )
  }

  const userLocation = (settings.location ?? '').trim().toLowerCase()
  let totalFound = 0
  let totalNew = 0
  const allNewJobs: ScrapedJob[] = []

  // Scrape each job title × job type combination
  for (const jobTitle of settings.categories as string[]) {
    for (const jobTypeId of settings.job_types) {
      const jobType = JOB_TYPES.find(t => t.id === jobTypeId)
      if (!jobType) continue

      const result = await scrapeLinkedInJobs(
        [jobTitle],
        '',
        jobType.linkedinCode,
        timeFilter
      )

      if (!result.ok) {
        console.error(`[trigger] Scrape failed for "${jobTitle}"/${jobTypeId}: ${result.message}`)
        continue
      }

      const scraped = result.jobs
      if (scraped.length === 0) continue

      totalFound += scraped.length

      // Upsert jobs
      await serviceClient
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

      // Fetch job DB ids
      const { data: jobRows } = await serviceClient
        .from('jobs')
        .select('id, linkedin_id, location')
        .in('linkedin_id', scraped.map(j => j.linkedin_id))

      if (!jobRows) continue

      // Apply location filter
      const relevantJobRows = userLocation
        ? jobRows.filter(j => j.location?.toLowerCase().includes(userLocation))
        : jobRows

      if (relevantJobRows.length === 0) continue

      // Find new jobs for this user
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

      const newJobDetails: ScrapedJob[] = newJobRows
        .map(jr => scraped.find(s => s.linkedin_id === jr.linkedin_id))
        .filter((j): j is ScrapedJob => !!j)

      allNewJobs.push(...newJobDetails)
    }
  }

  // Send a single email with all new jobs
  if (allNewJobs.length > 0 && settings.email_notifications) {
    const email = settings.notification_email ?? user.email
    if (email) {
      await sendJobNotificationEmail(email, allNewJobs)
    }
  }

  return NextResponse.json({
    found: totalFound,
    new: totalNew,
    message: totalNew > 0
      ? `Found ${totalNew} new job(s) across your selected titles!`
      : 'No new jobs since last check.',
  })
}
