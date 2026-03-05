export interface GreenhouseJob {
  external_id: string   // "gh_{companySlug}_{jobId}"
  title: string
  company: string       // company slug
  location: string | null
  url: string
  posted_at: string | null
}

export type FetchResult =
  | { ok: true; jobs: GreenhouseJob[] }
  | { ok: false; reason: 'not_found' | 'error'; message: string }

interface GreenhouseApiJob {
  id: number
  title: string
  updated_at: string
  location: { name: string }
  absolute_url: string
}

// Fetch all open jobs for a Greenhouse company board, filtered by keyword matches on title.
// companySlug: the slug used in boards.greenhouse.io/{slug} (e.g. "airbnb", "stripe")
// keywords: job title keywords to filter by (e.g. ["analyst", "engineer"]) — empty = return all
export async function fetchGreenhouseJobs(
  companySlug: string,
  keywords: string[]
): Promise<FetchResult> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs`

  let response: Response
  try {
    response = await fetch(url, { next: { revalidate: 0 } })
  } catch (err) {
    return { ok: false, reason: 'error', message: `Network error: ${String(err)}` }
  }

  if (response.status === 404) {
    return { ok: false, reason: 'not_found', message: `No Greenhouse board found for "${companySlug}".` }
  }

  if (!response.ok) {
    return { ok: false, reason: 'error', message: `Greenhouse API returned ${response.status} for "${companySlug}".` }
  }

  let data: { jobs: GreenhouseApiJob[] }
  try {
    data = await response.json()
  } catch {
    return { ok: false, reason: 'error', message: `Failed to parse Greenhouse response for "${companySlug}".` }
  }

  let jobs: GreenhouseJob[] = (data.jobs ?? []).map(job => ({
    external_id: `gh_${companySlug}_${job.id}`,
    title: job.title,
    company: companySlug,
    location: job.location?.name || null,
    url: job.absolute_url,
    posted_at: job.updated_at || null,
  }))

  if (keywords.length > 0) {
    const lower = keywords.map(k => k.toLowerCase())
    jobs = jobs.filter(job => lower.some(kw => job.title.toLowerCase().includes(kw)))
  }

  return { ok: true, jobs }
}
