import { fetchLinkedInJob } from './linkedin'
import { fetchPageText } from './web'

// Text of a job posting, from LinkedIn's guest API or the page itself.
export async function readJobText(url: string): Promise<string> {
  try {
    return url.includes('linkedin.com') ? await fetchLinkedInJob(url) : await fetchPageText(url)
  } catch {
    return ''
  }
}
