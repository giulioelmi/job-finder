import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph, TabStopType, TextRun,
} from 'docx'
import { parseJson } from './claude'
import { ResumeContentSchema, type ResumeContent } from './schemas'
import type { AgentView } from './profile-view'

// Port of the resume-tailor skill for unattended runs: same truthfulness rules,
// same content.json schema, same one-page ATS-safe Word layout (build_resume.py).

const SYSTEM_PROMPT = `You tailor a one-page, ATS-safe resume for a specific job from a student's profile
(their education, work_experience, projects and skills). You select and re-frame; you never invent.

THE ONE RULE THAT MATTERS MOST: only true information. Every fact, number, title, skill and date
must trace back to the profile. Selection and re-wording are allowed; invention is not.
When in doubt, leave it out.

1. Read the job: target title, must-have skills and keywords, seniority and domain.
2. Select the experience and projects that fit one page and match the job best, and lead with the strongest and most relevant. Each description is a list of true facts, one per line.
3. Each work_experience entry becomes one role heading (company, title, location if known, dates) with bullets made from its facts. Titles, companies and dates come from the profile, never from the target job.
4. Within each role, put the bullet that best matches the job's top requirement first and drop bullets that do not help for this job, so each resume differs visibly by posting. Use the exact numbers from the profile.
5. Tune the wording to mirror the job's language without adding facts, outcomes or praise the profile does not state.
6. Skills: a relevant subset of the profile's skills only, in 2-3 short labeled lines. Never list a skill the profile does not have.
7. Education: school, degree and field, GPA if listed, dates. Additional: only items the profile supports, and only if there is room.
8. title_line: a headline title that the bullets shown actually earn.

Caveats:
- Work or projects that are ongoing (current is true, or the facts say "building" or "currently") stay present tense ("building...", never "built" or "shipped").
- Do not combine facts into a new claim, and do not add a topic, purpose or result that no fact states (e.g. do not say what a poster was about unless a fact does).
- Do not upgrade numbers or dates. If the profile lists conflicting versions, use the more conservative one.
- No summary section. No em dashes anywhere; use commas, colons or semicolons.
- Bullets: action verb, then quantified outcome, then context or method. One or at most two lines each.
- One page: at most 14 bullets in total across experience and projects, at most 4 per role.

Before answering, review your draft with these lenses in order and fix what you find:
1. Keyword coverage: must-have terms surfaced in the bullets, only where the profile truthfully supports them.
2. Recruiter 6-second scan: strongest, most relevant material in the top third; title matches the job.
3. Narrative fit: a coherent story for this job; weakest bullets cut.
4. Truthfulness audit, LAST, as a hard gate: re-check every line against the profile. No invented or
   upgraded numbers, no skills outside the profile, ongoing work still present tense.

Use empty strings or empty arrays for anything you leave out.`

export async function tailorResume(
  profile: AgentView,
  job: { title: string; company: string; description: string }
): Promise<ResumeContent> {
  const text = [
    `Job: ${job.title} at ${job.company}`,
    `Job description:\n${job.description.slice(0, 8000) || '(not available, use the title)'}`,
    `Student profile:\n${JSON.stringify(profile)}`,
  ].join('\n\n')
  return parseJson(ResumeContentSchema, SYSTEM_PROMPT, [{ type: 'text', text }], 'medium')
}

// --- DOCX layout (US Letter, 0.5" margins, Calibri, black only, single column) ---
const INCH = 1440 // twips
const USABLE_WIDTH = 7.5 * INCH
const FONT = 'Calibri'
const BODY = 21 // half-points (10.5pt)

function run(text: string, size = BODY, opts: { bold?: boolean; italics?: boolean } = {}) {
  return new TextRun({ text, font: FONT, size, color: '000000', ...opts })
}

const tight = (before = 0, after = 2) => ({ before: before * 20, after: after * 20, line: 240 })

function heading(text: string) {
  return new Paragraph({
    spacing: tight(6, 2),
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 2, color: '000000' } },
    children: [run(text.toUpperCase(), 22, { bold: true })],
  })
}

function leftRight(left: string, right: string, opts: { bold?: boolean; italics?: boolean } = {}) {
  return new Paragraph({
    spacing: tight(0, 1),
    tabStops: [{ type: TabStopType.RIGHT, position: USABLE_WIDTH }],
    children: [run(left, BODY, opts), ...(right ? [run(`\t${right}`, BODY, { italics: opts.italics })] : [])],
  })
}

function bullet(text: string) {
  const indent = Math.round(0.18 * INCH)
  return new Paragraph({
    spacing: tight(0, 1),
    indent: { left: indent, hanging: indent },
    tabStops: [{ type: TabStopType.LEFT, position: indent }],
    children: [run(`•\t${text}`)],
  })
}

function centered(text: string, size: number, after: number, bold = false) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: tight(0, after), children: [run(text, size, { bold })] })
}

export async function renderResumeDocx(data: ResumeContent): Promise<Buffer> {
  const p: Paragraph[] = [centered(data.name, 40, 1, true)]
  if (data.title_line) p.push(centered(data.title_line, 22, 1))

  const c = data.contact
  const contact = [c.location, c.phone, c.email, c.linkedin, c.github].filter(Boolean)
  if (contact.length) p.push(centered(contact.join('   |   '), 19, 3))

  if (data.education.length) {
    p.push(heading('Education'))
    for (const e of data.education) {
      p.push(leftRight(e.school, e.dates, { bold: true }))
      const line = e.degree + (e.honors ? `, ${e.honors}` : '')
      if (line || e.location) p.push(leftRight(line, e.location, { italics: true }))
      e.details.forEach(d => p.push(bullet(d)))
    }
  }

  if (data.experience.length) {
    p.push(heading('Experience'))
    for (const x of data.experience) {
      p.push(leftRight(x.org, x.dates, { bold: true }))
      if (x.title || x.location) p.push(leftRight(x.title, x.location, { italics: true }))
      x.bullets.forEach(b => p.push(bullet(b)))
    }
  }

  if (data.projects.length) {
    p.push(heading('Projects'))
    for (const pr of data.projects) {
      p.push(leftRight(pr.role ? `${pr.name} | ${pr.role}` : pr.name, pr.dates, { bold: true }))
      pr.bullets.forEach(b => p.push(bullet(b)))
    }
  }

  if (data.skills.length) {
    p.push(heading('Skills'))
    for (const s of data.skills) {
      p.push(new Paragraph({ spacing: tight(0, 1), children: [run(`${s.label}: `, BODY, { bold: true }), run(s.items)] }))
    }
  }

  if (data.additional.length) {
    p.push(heading('Additional'))
    data.additional.forEach(a => p.push(bullet(a)))
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY, color: '000000' } } } },
    sections: [{
      properties: { page: { size: { width: 8.5 * INCH, height: 11 * INCH }, margin: { top: INCH / 2, bottom: INCH / 2, left: INCH / 2, right: INCH / 2 } } },
      children: p,
    }],
  })
  return Packer.toBuffer(doc)
}
