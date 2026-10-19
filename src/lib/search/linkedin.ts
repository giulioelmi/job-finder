import * as cheerio from 'cheerio'

// LinkedIn's public guest jobs endpoints: no login, no API key, no tokens.

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' }

export interface LinkedInJob {
  title: string
  company: string
  location: string
  url: string
  posted_at: string | null
}

export async function searchLinkedIn(keywords: string, location: string, hours = 24): Promise<LinkedInJob[]> {
  const params = new URLSearchParams({
    keywords,
    location: location || 'United States',
    f_TPR: `r${hours * 3600}`,
    start: '0',
  })
  const res = await fetch(`https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}`, { headers: HEADERS })
  if (!res.ok) return []

  const $ = cheerio.load(await res.text())
  return $('.base-card').map((_, el) => {
    const card = $(el)
    const href = card.find('a.base-card__full-link').attr('href') ?? ''
    return {
      title: card.find('.base-search-card__title').text().trim(),
      company: card.find('.base-search-card__subtitle').text().trim(),
      location: card.find('.job-search-card__location').text().trim(),
      url: href.split('?')[0],
      posted_at: card.find('time').attr('datetime') ?? null,
    }
  }).get().filter(j => j.title && j.url)
}

// Full description for a LinkedIn job URL (…/jobs/view/some-title-1234567890).
export async function fetchLinkedInJob(url: string): Promise<string> {
  const id = url.match(/(\d{6,})\/?$/)?.[1]
  if (!id) return ''
  const res = await fetch(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`, { headers: HEADERS })
  if (!res.ok) return ''
  const $ = cheerio.load(await res.text())
  return $('.show-more-less-html__markup').text().replace(/\s+/g, ' ').trim()
}
