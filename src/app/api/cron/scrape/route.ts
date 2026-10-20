import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchGreenhouseJobs, fetchGreenhouseJobDescription, type GreenhouseJob } from '@/lib/greenhouse'
import { fetchAshbyJobs, type AshbyJob } from '@/lib/ashby'
import { ALL_GREENHOUSE_COMPANIES, ALL_ASHBY_COMPANIES } from '@/lib/categories'
import { extractYearsOfExperience } from '@/lib/experience'
import { mapWithConcurrency } from '@/lib/concurrency'

export const maxDuration = 300

// New postings from every Greenhouse and Ashby board go into the shared `jobs` table.
// The AI agents (/api/cron/agent) read that table; nothing is emailed from here.
// Call this every 20-30 minutes. The window is wider than that on purpose, so one missed
// call loses nothing: jobs are de-duplicated by external_id and found_at keeps the first-seen time.
const WINDOW_MINUTES = 90
const BOARD_CONCURRENCY = 40
const DETAIL_CONCURRENCY = 8

type Service = ReturnType<typeof createServiceClient>

async function getSlugs(supabase: Service, table: 'greenhouse_slugs' | 'ashby_slugs', fallback: string[]): Promise<string[]> {
  const { data, error } = await supabase.from(table).select('slug')
  if (error) throw new Error(`${table}: ${error.message}`)
  return data.length > 0 ? data.map(r => r.slug as string) : fallback
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const createdAfter = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)

  let ghSlugs: string[], ashbySlugs: string[]
  try {
    [ghSlugs, ashbySlugs] = await Promise.all([
      getSlugs(supabase, 'greenhouse_slugs', ALL_GREENHOUSE_COMPANIES),
      getSlugs(supabase, 'ashby_slugs', ALL_ASHBY_COMPANIES),
    ])
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  const [ghResults, ashbyResults] = await Promise.all([
    mapWithConcurrency(ghSlugs, BOARD_CONCURRENCY, slug => fetchGreenhouseJobs(slug, [], [], createdAfter)),
    mapWithConcurrency(ashbySlugs, BOARD_CONCURRENCY, slug => fetchAshbyJobs(slug, [], [], createdAfter)),
  ])

  // Boards that failed are counted so a broken API shows up in the cron-job.org response
  const boards = { ok: 0, notFound: 0, failed: 0 }
  const fetched = new Map<string, GreenhouseJob | AshbyJob>()
  for (const res of [...ghResults, ...ashbyResults]) {
    if (res.ok) {
      boards.ok++
      for (const job of res.jobs) fetched.set(job.external_id, job)
    } else if (res.reason === 'not_found') {
      boards.notFound++
    } else {
      boards.failed++
    }
  }

  if (fetched.size === 0) {
    return NextResponse.json({ success: true, boards, fetched: 0, newJobs: 0 })
  }

  // Only jobs we have not stored a description for need the extra work below
  const stored = new Map<string, boolean>()
  const ids = [...fetched.keys()]
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from('jobs').select('external_id, description').in('external_id', ids.slice(i, i + 200))
    if (error) return NextResponse.json({ error: `jobs lookup: ${error.message}` }, { status: 500 })
    for (const row of data) stored.set(row.external_id as string, !!row.description)
  }

  const needsDescription = [...fetched.values()].filter(j => !j.description && !stored.get(j.external_id) && j.source === 'greenhouse')
  await mapWithConcurrency(needsDescription, DETAIL_CONCURRENCY, async job => {
    job.description = await fetchGreenhouseJobDescription(job.slug, job.external_id)
  })

  const rows = [...fetched.values()].map(j => ({
    external_id: j.external_id,
    title: j.title,
    company: j.company,
    location: j.location,
    url: j.url,
    posted_at: j.posted_at,
    description: j.description,
    experience_years: j.description ? extractYearsOfExperience(j.description) : null,
  }))

  // Two uniform upserts: a job we have no text for must not overwrite a description or years already stored
  const withText = rows.filter(r => r.description)
  const withoutText = rows.filter(r => !r.description).map(({ description: _d, experience_years: _e, ...rest }) => rest)
  for (const [batch, label] of [[withText, 'with description'], [withoutText, 'without description']] as const) {
    if (batch.length === 0) continue
    const { error } = await supabase.from('jobs').upsert(batch, { onConflict: 'external_id', ignoreDuplicates: false })
    if (error) return NextResponse.json({ error: `jobs upsert (${label}): ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    boards,
    fetched: fetched.size,
    newJobs: [...fetched.keys()].filter(id => !stored.has(id)).length,
    withDescription: withText.length,
  })
}
