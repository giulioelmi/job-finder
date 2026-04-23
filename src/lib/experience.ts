import * as cheerio from 'cheerio'

const RANGE_RE = /\b(\d{1,2})\s*[-–]\s*(\d{1,2})\+?\s*(?:years|yrs)\b/gi
const MIN_RE = /\b(?:at\s+least|minimum\s+of|min(?:imum)?\.?)\s*(\d{1,2})\+?\s*(?:years|yrs)\b/gi
const PLUS_RE = /\b(\d{1,2})\+?\s*(?:years|yrs)\s+(?:of\s+)?experience\b/gi

export function extractYearsOfExperience(text: string): number | null {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ')
  const found: number[] = []

  for (const match of normalized.matchAll(RANGE_RE)) {
    const low = parseInt(match[1], 10)
    const high = parseInt(match[2], 10)
    if (!Number.isNaN(low) && !Number.isNaN(high)) found.push(Math.min(low, high))
  }

  for (const match of normalized.matchAll(MIN_RE)) {
    const years = parseInt(match[1], 10)
    if (!Number.isNaN(years)) found.push(years)
  }

  for (const match of normalized.matchAll(PLUS_RE)) {
    const years = parseInt(match[1], 10)
    if (!Number.isNaN(years)) found.push(years)
  }

  if (found.length === 0) return null
  return Math.min(...found)
}

export async function fetchExperienceYearsFromUrl(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; BambooBot/1.0; +https://bamboo-job-finder.app)',
      },
    })
    if (!response.ok) return null
    const html = await response.text()
    const $ = cheerio.load(html)
    const text = $('body').text()
    return extractYearsOfExperience(text)
  } catch {
    return null
  }
}

export async function scrapeExperienceYearsForJobs(
  jobs: Array<{ external_id: string; url: string }>,
  concurrency = 8
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>()
  const queue = [...jobs]

  async function worker() {
    while (queue.length > 0) {
      const next = queue.shift()
      if (!next) return
      const years = await fetchExperienceYearsFromUrl(next.url)
      result.set(next.external_id, years)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()))
  return result
}
