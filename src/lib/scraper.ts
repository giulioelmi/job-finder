import * as cheerio from 'cheerio'

export interface ScrapedJob {
  linkedin_id: string
  title: string
  company: string | null
  location: string | null
  url: string
  posted_at: string | null
}

export type ScrapeResult =
  | { ok: true; jobs: ScrapedJob[] }
  | { ok: false; reason: 'blocked' | 'rate_limited' | 'error'; message: string }

const SCRAPFLY_API = 'https://api.scrapfly.io/scrape'

async function scrapflyFetch(targetUrl: string): Promise<{ html: string; status: number }> {
  const apiKey = process.env.SCRAPFLY_API_KEY
  if (!apiKey) throw new Error('SCRAPFLY_API_KEY is not set')

  const params = new URLSearchParams({
    key: apiKey,
    url: targetUrl,
    asp: 'true',
    country: 'us',
  })

  const response = await fetch(`${SCRAPFLY_API}?${params}`, { next: { revalidate: 0 } })
  const json = await response.json()

  const status: number = json?.result?.status_code ?? response.status
  const html: string = json?.result?.content ?? ''
  return { html, status }
}

// jobTypeCode: 'I' = internship, 'F' = full-time (LinkedIn f_JT param)
// timeFilter: LinkedIn f_TPR values — 'r3600' = 1h, 'r86400' = 24h, 'r604800' = 1 week, 'r2592000' = 1 month
export function buildLinkedInSearchUrl(
  keywords: string[],
  location: string,
  jobTypeCode: string,
  timeFilter = 'r86400'
): string {
  const keywordQuery = keywords.map(k => `"${k}"`).join(' OR ')
  const params = new URLSearchParams({
    keywords: `(${keywordQuery})`,
    f_TPR: timeFilter,
    f_JT: jobTypeCode,
    sortBy: 'R',
  })
  if (location) params.set('location', location)
  return `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}&start=0`
}

export async function scrapeLinkedInJobs(
  keywords: string[],
  location: string,
  jobTypeCode: string,
  timeFilter = 'r86400'
): Promise<ScrapeResult> {
  const url = buildLinkedInSearchUrl(keywords, location, jobTypeCode, timeFilter)

  let html: string
  let status: number
  try {
    ;({ html, status } = await scrapflyFetch(url))
  } catch (err) {
    return { ok: false, reason: 'error', message: `Scrapfly request failed: ${String(err)}` }
  }

  if (status === 429) {
    return { ok: false, reason: 'rate_limited', message: 'LinkedIn rate limit hit (429). Try again later.' }
  }

  if (status === 403 || status === 401) {
    return { ok: false, reason: 'blocked', message: `LinkedIn blocked the request (${status}).` }
  }

  if (status < 200 || status >= 300) {
    return { ok: false, reason: 'error', message: `Unexpected HTTP ${status} from LinkedIn.` }
  }

  // Detect silent blocks: login/captcha pages returned with 200 OK
  if (
    html.includes('linkedin.com/login') ||
    html.includes('authwall') ||
    html.includes('sign-in') ||
    html.length < 200
  ) {
    return {
      ok: false,
      reason: 'blocked',
      message: 'LinkedIn returned a login/auth page. The server IP may be blocked.',
    }
  }

  return { ok: true, jobs: parseJobListings(html).filter(isRecentJob) }
}

// LinkedIn sometimes returns old promoted jobs regardless of the f_TPR filter.
// Drop any job whose posted_at date is older than 60 days.
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000

function isRecentJob(job: ScrapedJob): boolean {
  if (!job.posted_at) return true // no date → keep, we can't tell
  const postedMs = new Date(job.posted_at).getTime()
  if (isNaN(postedMs)) return true
  return Date.now() - postedMs <= MAX_AGE_MS
}

function parseJobListings(html: string): ScrapedJob[] {
  const $ = cheerio.load(html)
  const jobs: ScrapedJob[] = []

  $('li').each((_, el) => {
    const card = $(el)

    const jobLink = card.find('a.base-card__full-link, a[href*="/jobs/view/"]').first()
    const href = jobLink.attr('href') ?? ''
    const jobIdMatch = href.match(/\/jobs\/view\/(\d+)/)
    if (!jobIdMatch) return

    const linkedin_id = jobIdMatch[1]

    const title =
      card.find('.base-search-card__title').first().text().trim() ||
      card.find('h3').first().text().trim()

    if (!title) return

    const company =
      card.find('.base-search-card__subtitle').first().text().trim() ||
      card.find('h4').first().text().trim() ||
      null

    const location =
      card.find('.job-search-card__location').first().text().trim() ||
      card.find('[class*="location"]').first().text().trim() ||
      null

    const posted_at = card.find('time').attr('datetime') ?? null

    jobs.push({
      linkedin_id,
      title,
      company: company || null,
      location: location || null,
      url: `https://www.linkedin.com/jobs/view/${linkedin_id}/`,
      posted_at,
    })
  })

  return jobs
}
