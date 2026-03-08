export interface AshbyJob {
  source: 'ashby'
  external_id: string   // "ashby_{companySlug}_{jobId}"
  title: string
  company: string       // display name from Ashby API (or slug as fallback)
  slug: string          // company slug used in the Ashby board URL
  location: string | null
  url: string
  posted_at: string | null
}

export type AshbyFetchResult =
  | { ok: true; jobs: AshbyJob[] }
  | { ok: false; reason: 'not_found' | 'error'; message: string }

interface AshbyApiJob {
  id: string
  title: string
  teamName: string | null
  locationName: string | null
  jobPostingLocationNames: string[] | null
  applyUrl: string
  publishedDate: string | null
  updatedAt: string | null
}

interface AshbyApiResponse {
  apiVersion: string
  jobs: AshbyApiJob[]
  jobBoard?: {
    name?: string
  }
}

// Returns true if the job title matches the requested job types.
// Heuristic: titles containing "intern" are internships; everything else is full-time.
function matchesJobType(title: string, jobTypes: string[]): boolean {
  if (jobTypes.length === 0 || (jobTypes.includes('internship') && jobTypes.includes('fulltime'))) {
    return true
  }
  const isIntern = title.toLowerCase().includes('intern')
  if (jobTypes.includes('internship') && !jobTypes.includes('fulltime')) return isIntern
  if (jobTypes.includes('fulltime') && !jobTypes.includes('internship')) return !isIntern
  return true
}

// Fetch open jobs for an Ashby company board.
//   keywords    – filter by job title containing any keyword (empty = all)
//   jobTypes    – ['internship'], ['fulltime'], or both/empty = all
//   createdAfter – only return jobs created at or after this timestamp
export async function fetchAshbyJobs(
  companySlug: string,
  keywords: string[],
  jobTypes: string[] = [],
  createdAfter?: Date
): Promise<AshbyFetchResult> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${companySlug}`

  let response: Response
  try {
    response = await fetch(url, { next: { revalidate: 0 } })
  } catch (err) {
    return { ok: false, reason: 'error', message: `Network error: ${String(err)}` }
  }

  if (response.status === 404) {
    return { ok: false, reason: 'not_found', message: `No Ashby board found for "${companySlug}".` }
  }

  if (!response.ok) {
    return { ok: false, reason: 'error', message: `Ashby API returned ${response.status} for "${companySlug}".` }
  }

  let data: AshbyApiResponse
  try {
    data = await response.json()
  } catch {
    return { ok: false, reason: 'error', message: `Failed to parse Ashby response for "${companySlug}".` }
  }

  const companyName = data.jobBoard?.name || companySlug

  let jobs: AshbyJob[] = (data.jobs ?? [])
    .map(job => ({
      source: 'ashby' as const,
      external_id: `ashby_${companySlug}_${job.id}`,
      title: job.title,
      company: companyName,
      slug: companySlug,
      location: job.locationName || (job.jobPostingLocationNames?.[0] ?? null),
      url: job.applyUrl,
      posted_at: job.publishedDate || job.updatedAt || null,
    }))

  if (createdAfter) {
    jobs = jobs.filter(job => job.posted_at == null || new Date(job.posted_at) >= createdAfter)
  }

  if (keywords.length > 0) {
    const lower = keywords.map(k => k.toLowerCase())
    jobs = jobs.filter(job => lower.some(kw => job.title.toLowerCase().includes(kw)))
  }

  jobs = jobs.filter(job => matchesJobType(job.title, jobTypes))

  return { ok: true, jobs }
}
