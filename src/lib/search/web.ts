import * as cheerio from 'cheerio'

// Free web search through DuckDuckGo's HTML endpoint: no API key, no tokens.
// Used to find Indeed postings (site:indeed.com/viewjob) and anything else on the open web.

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' }

export interface WebResult {
  title: string
  url: string
  snippet: string
}

// DuckDuckGo wraps result links as //duckduckgo.com/l/?uddg=<encoded url>
function unwrapUrl(href: string): string {
  const uddg = href.match(/[?&]uddg=([^&]+)/)?.[1]
  return uddg ? decodeURIComponent(uddg) : href
}

export async function searchWeb(query: string): Promise<WebResult[]> {
  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ q: query }),
  })
  if (!res.ok) return []

  const $ = cheerio.load(await res.text())
  return $('.result').map((_, el) => {
    const link = $(el).find('a.result__a')
    return {
      title: link.text().trim(),
      url: unwrapUrl(link.attr('href') ?? ''),
      snippet: $(el).find('.result__snippet').text().trim(),
    }
  }).get().filter(r => r.title && r.url.startsWith('http')).slice(0, 10)
}

// Visible text of a page, capped so it fits comfortably in the agent's context.
export async function fetchPageText(url: string, maxChars = 6000): Promise<string> {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return ''
  const $ = cheerio.load(await res.text())
  $('script, style, nav, header, footer, noscript').remove()
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, maxChars)
}
