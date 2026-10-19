import type Anthropic from '@anthropic-ai/sdk'
import { parseJson } from './claude'
import { CareerProfileSchema, type CareerProfile } from './schemas'

const SYSTEM_PROMPT = `You build a student's career profile from all of their resumes.
The profile is a master content library: a later step selects and re-frames entries from it
to tailor a one-page resume for a specific job, so it must hold every real accomplishment.

Rules:
- Only true information. Every fact, number, title, skill and date must come from the resumes. Never invent.
- Merge duplicates: the same job or project often appears on several resumes with different wording. Make one entry and keep every distinct fact, but write each fact once; drop a fact that only restates another.
- Do not add details that are not in the resumes, including names, places, adjectives about quality, or outcomes you infer (if a resume says "campus", do not write "UCLA").
- Keep numbers and dates exactly as written. When two resumes give compatible numbers ("2.1M" and "roughly 2 million"), keep the more precise one. Only when they truly conflict, keep both as separate plain facts. Never write notes about your own merging (no "also stated as...").
- For a project, put the course, employer or "Personal project" in org. Include the project's dates only if a resume gives them.
- Each entry gets 2-3 angles: resume bullets (action verb, quantified outcome, context) phrased for different role types. An angle may re-order and re-word the facts but must not add any claim, benefit or skill that the facts do not state.
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
