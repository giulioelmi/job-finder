import * as cheerio from 'cheerio'

export interface ScrapedJob {
  linkedin_id: string
  title: string
  company: string | null
  location: string | null
  url: string
  posted_at: string | null
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
}

export function buildLinkedInSearchUrl(keywords: string[], location: string, timePeriod: number): string {
  const keywordQuery = keywords.map(k => `"${k}"`).join(' OR ')
  const params = new URLSearchParams({
    keywords: `(${keywordQuery})`,
    f_TPR: `r${timePeriod}`,
    sortBy: 'R',
  })
  if (location) params.set('location', location)
  return `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}&start=0`
}

export async function scrapeLinkedInJobs(
  keywords: string[],
  location: string,
  timePeriod: number
): Promise<ScrapedJob[]> {
  // LinkedIn has two scrapeable endpoints:
  // 1. Public guest jobs API (no login required)
  // 2. HTML job listing page
  // We use the guest API which returns structured HTML fragments
  const url = buildLinkedInSearchUrl(keywords, location, timePeriod)

  const response = await fetch(url, { headers: HEADERS, next: { revalidate: 0 } })

  if (!response.ok) {
    throw new Error(`LinkedIn responded with ${response.status}`)
  }

  const html = await response.text()
  return parseJobListings(html)
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
    const title = card.find('.base-search-card__title, h3').first().text().trim()
    const company = card.find('.base-search-card__subtitle, h4').first().text().trim() || null
    const location = card.find('.job-search-card__location').first().text().trim() || null
    const postedAtText = card.find('time').attr('datetime') ?? null

    if (!title || !linkedin_id) return

    // Clean up the URL — keep only the canonical job view URL
    const cleanUrl = `https://www.linkedin.com/jobs/view/${linkedin_id}/`

    jobs.push({
      linkedin_id,
      title,
      company: company || null,
      location: location || null,
      url: cleanUrl,
      posted_at: postedAtText,
    })
  })

  return jobs
}
