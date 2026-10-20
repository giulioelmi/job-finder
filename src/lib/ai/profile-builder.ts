import type Anthropic from '@anthropic-ai/sdk'
import { parseJson } from './claude'
import { BuiltProfileSchema, type BuiltProfile } from './schemas'

const SYSTEM_PROMPT = `You build a student's profile from all of their resumes.
The profile is saved in their account and used to fill job applications and to find and tailor jobs,
so it must hold every real accomplishment, each as a short true fact.

Rules:
- Only true information. Every fact, number, title, skill and date must come from the resumes. Never invent.
- Merge duplicates: the same job or project often appears on several resumes with different wording. Make one entry and keep every distinct fact, but write each fact once; drop a fact that only restates another.
- Each work_experience and project description is a list of facts, one per line, each starting with "- ". Write them as resume bullets (action verb, quantified outcome, context) but add no claim, benefit, adjective about quality, or skill that the resumes do not state.
- Do not upgrade titles or responsibilities: "led a team of four" does not make someone a "Team Lead". If a resume gives no role, describe it plainly (e.g. "Team member").
- Do not add details that are not in the resumes, including names, places or outcomes you infer (if a resume says "campus", do not write "UCLA").
- Keep numbers exactly as written. When two resumes give compatible numbers ("2.1M" and "roughly 2 million"), keep the more precise one. Only when they truly conflict, keep both as separate plain facts. Never write notes about your own merging (no "also stated as...").
- Dates: "Mon YYYY" (e.g. "Jun 2025"). Set current to true and end_date to "" for work that is ongoing. Ongoing or unshipped project work stays in present tense ("Building...").
- For a project, put the course, employer or "Personal project" at the start of its description's first line only if a resume says so. Give a project's technologies as a comma-separated string.
- skills: a flat list of the skills the resumes name, with no duplicates.
- target_titles: the 3-5 job titles this student is best qualified for right now (short titles, as they appear on job boards).
- target_locations: where the student lives or says they want to work. Use "Remote" only if a resume says so.
- Use empty strings or empty arrays when something is not in the resumes.`

export async function buildCareerProfile(pdfs: Buffer[]): Promise<BuiltProfile> {
  const content: Anthropic.ContentBlockParam[] = pdfs.map(pdf => ({
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') },
  }))
  content.push({ type: 'text', text: `Build the profile from these ${pdfs.length} resume(s).` })

  return parseJson(BuiltProfileSchema, SYSTEM_PROMPT, content, 'medium')
}
