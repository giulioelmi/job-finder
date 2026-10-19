import type Anthropic from '@anthropic-ai/sdk'
import { parseJson } from './claude'
import { CareerProfileSchema, type CareerProfile } from './schemas'

const SYSTEM_PROMPT = `You build a student's career profile from all of their resumes.
The profile is a master content library: a later step selects and re-frames entries from it
to tailor a one-page resume for a specific job, so it must hold every real accomplishment.

Rules:
- Only true information. Every fact, number, title, skill and date must come from the resumes. Never invent.
- Merge duplicates: the same job or project often appears on several resumes with different wording. Make one entry and keep every distinct fact.
- Keep numbers and dates exactly as written. If two resumes disagree, keep both versions in the facts.
- Each entry gets 2-3 angles: resume bullets (action verb, quantified outcome, context) phrased for different role types.
- Rate each entry 1-3 stars by how strong and specific it is.
- Set in_development to true for ongoing or unshipped work.
- target_titles: the 3-5 job titles this student is best qualified for right now.
- search_keywords: 3-6 short title keywords to search job boards (e.g. "data analyst", "product manager intern").
- Use empty strings or empty arrays when something is not in the resumes.`

export async function buildCareerProfile(pdfs: Buffer[]): Promise<CareerProfile> {
  const content: Anthropic.ContentBlockParam[] = pdfs.map(pdf => ({
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') },
  }))
  content.push({ type: 'text', text: `Build the career profile from these ${pdfs.length} resume(s).` })

  return parseJson(CareerProfileSchema, SYSTEM_PROMPT, content, 'medium')
}
