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

// Fetch open jobs for a Greenhouse company board.
//   keywords  – filter by job title containing any keyword (empty = all)
//   jobTypes  – ['internship'], ['fulltime'], or both/empty = all
//   hoursBack – only include jobs whose updated_at is within this many hours (undefined = no filter)
export async function fetchGreenhouseJobs(
  companySlug: string,
  keywords: string[],
  jobTypes: string[] = [],
  hoursBack?: number
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

  const cutoff = hoursBack ? new Date(Date.now() - hoursBack * 60 * 60 * 1000) : null

  let jobs: GreenhouseJob[] = (data.jobs ?? [])
    .filter(job => !cutoff || !job.updated_at || new Date(job.updated_at) >= cutoff)
    .map(job => ({
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

  jobs = jobs.filter(job => matchesJobType(job.title, jobTypes))

  return { ok: true, jobs }
}
