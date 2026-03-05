import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { scrapeLinkedInJobs, ScrapedJob } from '@/lib/scraper'
import { sendJobNotificationEmail } from '@/lib/email'

// Manual trigger — authenticated users can run the scraper for themselves
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()

  const { data: settings } = await serviceClient
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!settings) {
    return NextResponse.json({ error: 'No settings found. Please configure your search in Settings.' }, { status: 400 })
  }

  try {
    const scraped = await scrapeLinkedInJobs(
      settings.keywords,
      settings.location ?? '',
      settings.time_period ?? 1800
    )

    if (scraped.length === 0) {
      return NextResponse.json({ message: 'No jobs found for your search criteria.' })
    }

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

    const { data: jobRows } = await serviceClient
      .from('jobs')
      .select('id, linkedin_id')
      .in('linkedin_id', scraped.map(j => j.linkedin_id))

    if (!jobRows) return NextResponse.json({ message: 'No jobs saved.' })

    const { data: existingNotifs } = await serviceClient
      .from('job_notifications')
      .select('job_id')
      .eq('user_id', user.id)
      .in('job_id', jobRows.map(j => j.id))

    const notifiedJobIds = new Set((existingNotifs ?? []).map(n => n.job_id))
    const newJobRows = jobRows.filter(j => !notifiedJobIds.has(j.id))

    if (newJobRows.length > 0) {
      await serviceClient.from('job_notifications').insert(
        newJobRows.map(j => ({ user_id: user.id, job_id: j.id }))
      )

      if (settings.email_notifications) {
        const email = settings.notification_email ?? user.email
        if (email) {
          const newJobDetails: ScrapedJob[] = newJobRows
            .map(jr => scraped.find(s => s.linkedin_id === jr.linkedin_id))
            .filter((j): j is ScrapedJob => !!j)
          await sendJobNotificationEmail(email, newJobDetails)
        }
      }
    }

    return NextResponse.json({
      found: scraped.length,
      new: newJobRows.length,
      message: newJobRows.length > 0
        ? `Found ${newJobRows.length} new job(s)!`
        : 'No new jobs since last check.',
    })
  } catch (err) {
    console.error('Scrape error:', err)
    return NextResponse.json({ error: 'Scraping failed. LinkedIn may be blocking requests.' }, { status: 500 })
  }
}
