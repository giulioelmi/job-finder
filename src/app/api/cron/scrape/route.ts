import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchGreenhouseJobs, GreenhouseJob } from '@/lib/greenhouse'
import { sendJobNotificationEmail } from '@/lib/email'

// Cron runs every 5 minutes. Each run picks one unique company (from all users' settings),
// fetches its Greenhouse jobs, and notifies matching users.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Gather all unique company slugs from all users' settings
  const { data: allSettings } = await supabase
    .from('user_settings')
    .select('companies')

  const uniqueCompanies: string[] = []
  for (const row of allSettings ?? []) {
    for (const slug of (row.companies as string[] | null) ?? []) {
      if (slug && !uniqueCompanies.includes(slug)) {
        uniqueCompanies.push(slug)
      }
    }
  }

  if (uniqueCompanies.length === 0) {
    return NextResponse.json({ success: true, message: 'No companies configured by any user.' })
  }

  // Rotate through companies based on current 5-minute slot
  const slotIndex = Math.floor(Date.now() / (5 * 60 * 1000)) % uniqueCompanies.length
  const currentCompany = uniqueCompanies[slotIndex]

  // Clean up notifications older than 24 hours
  await supabase
    .from('job_notifications')
    .delete()
    .lt('notified_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  // Fetch all users who track this company
  const { data: matchingUsers } = await supabase
    .from('user_settings')
    .select('user_id, companies, categories, location, email_notifications, notification_email')
    .contains('companies', [currentCompany])
    .eq('email_notifications', true)

  if (!matchingUsers || matchingUsers.length === 0) {
    return NextResponse.json({ success: true, company: currentCompany, message: 'No users tracking this company.' })
  }

  // Collect all keywords used by any user watching this company
  const allKeywords = Array.from(
    new Set(matchingUsers.flatMap(u => (u.categories as string[] | null) ?? []))
  )

  const result = await fetchGreenhouseJobs(currentCompany, allKeywords)

  if (!result.ok) {
    console.error(`[cron] Greenhouse fetch failed for "${currentCompany}": ${result.message}`)
    return NextResponse.json({ success: false, company: currentCompany, error: result.message })
  }

  const fetched = result.jobs
  let notifiedUsers = 0

  if (fetched.length > 0) {
    // Upsert into central jobs catalog
    await supabase
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
        { onConflict: 'external_id', ignoreDuplicates: true }
      )

    // Fetch DB ids for the fetched jobs
    const { data: jobRows } = await supabase
      .from('jobs')
      .select('id, external_id, location, title')
      .in('external_id', fetched.map(j => j.external_id))

    if (jobRows && jobRows.length > 0) {
      for (const user of matchingUsers) {
        const userKeywords = ((user.categories as string[] | null) ?? []).map(k => k.toLowerCase())
        const userLocation = (user.location ?? '').trim().toLowerCase()

        // Filter jobs by this user's keywords and location
        const relevantRows = jobRows.filter(j => {
          const titleMatch = userKeywords.length === 0 ||
            userKeywords.some(kw => j.title.toLowerCase().includes(kw))
          const locationMatch = !userLocation || j.location?.toLowerCase().includes(userLocation)
          return titleMatch && locationMatch
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

        if (user.notification_email) {
          const newJobDetails: GreenhouseJob[] = newRows
            .map(jr => fetched.find(f => f.external_id === jr.external_id))
            .filter((j): j is GreenhouseJob => !!j)
          await sendJobNotificationEmail(user.notification_email, newJobDetails)
        }

        notifiedUsers++
      }
    }
  }

  return NextResponse.json({
    success: true,
    slot: slotIndex,
    company: currentCompany,
    totalCompanies: uniqueCompanies.length,
    fetched: fetched.length,
    notifiedUsers,
  })
}
