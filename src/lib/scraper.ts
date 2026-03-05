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

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  Referer: 'https://www.linkedin.com/',
}

// jobTypeCode: 'I' = internship, 'F' = full-time (LinkedIn f_JT param)
export function buildLinkedInSearchUrl(keywords: string[], location: string, jobTypeCode: string): string {
  const keywordQuery = keywords.map(k => `"${k}"`).join(' OR ')
  const params = new URLSearchParams({
    keywords: `(${keywordQuery})`,
    f_TPR: 'r1800',
    f_JT: jobTypeCode,
    sortBy: 'R',
  })
  if (location) params.set('location', location)
  return `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}&start=0`
}

export async function scrapeLinkedInJobs(
  keywords: string[],
  location: string,
  jobTypeCode: string
): Promise<ScrapeResult> {
  const url = buildLinkedInSearchUrl(keywords, location, jobTypeCode)

  let response: Response
  try {
    response = await fetch(url, { headers: HEADERS, next: { revalidate: 0 } })
  } catch (err) {
    return { ok: false, reason: 'error', message: `Network error: ${String(err)}` }
  }

  if (response.status === 429) {
    return { ok: false, reason: 'rate_limited', message: 'LinkedIn rate limit hit (429). Try again later.' }
  }

  if (response.status === 403 || response.status === 401) {
    return { ok: false, reason: 'blocked', message: `LinkedIn blocked the request (${response.status}).` }
  }

  if (!response.ok) {
    return { ok: false, reason: 'error', message: `Unexpected HTTP ${response.status} from LinkedIn.` }
  }

  const html = await response.text()

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

  return { ok: true, jobs: parseJobListings(html) }
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
