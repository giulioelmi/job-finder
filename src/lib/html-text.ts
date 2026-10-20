import * as cheerio from 'cheerio'

// Plain text from HTML. cheerio's text() glues adjacent blocks together ("Requirements:Bachelor's"),
// so a space is added after each block element first.
export function htmlToText(html: string): string {
  const $ = cheerio.load(html)
  $('br').replaceWith(' ')
  $('p, div, li, h1, h2, h3, h4, h5, h6, tr, td').after(' ')
  return $.root().text().replace(/\s+/g, ' ').trim()
}
