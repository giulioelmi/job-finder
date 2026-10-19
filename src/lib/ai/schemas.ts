import { z } from 'zod'

// Career profile: a master content library built from all of a student's resumes.
// Same shape the resume-tailor skill reads: entries hold raw facts plus angles.
const EntrySchema = z.object({
  id: z.string().describe('Short id like E1, E2 (experience) or P1, P2 (projects)'),
  org: z.string(),
  role: z.string(),
  location: z.string(),
  dates: z.string(),
  tags: z.array(z.string()),
  facts: z.array(z.string()).describe('Raw facts exactly as written in the resumes, numbers unchanged'),
  angles: z.array(z.string()).describe('2-3 resume bullet phrasings angled for different role types'),
  stars: z.number().int().describe('Strength rating 1-3'),
  in_development: z.boolean().describe('True if the work is ongoing / not shipped'),
})

export const CareerProfileSchema = z.object({
  contact: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    linkedin: z.string(),
    github: z.string(),
  }),
  target_titles: z.array(z.string()),
  search_keywords: z.array(z.string()).describe('Short job-title keywords to search job boards with'),
  locations: z.array(z.string()),
  seniority: z.string().describe('e.g. internship, entry level, mid level'),
  education: z.array(z.object({
    school: z.string(),
    location: z.string(),
    degree: z.string(),
    dates: z.string(),
    details: z.array(z.string()),
  })),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  entries: z.array(EntrySchema),
  projects: z.array(EntrySchema),
  additional: z.array(z.string()),
})

export type CareerProfile = z.infer<typeof CareerProfileSchema>

// Tailored resume: the resume-tailor skill's content.json schema.
export const ResumeContentSchema = z.object({
  name: z.string(),
  title_line: z.string(),
  contact: z.object({
    location: z.string(),
    phone: z.string(),
    email: z.string(),
    linkedin: z.string(),
    github: z.string(),
  }),
  education: z.array(z.object({
    school: z.string(),
    location: z.string(),
    degree: z.string(),
    honors: z.string(),
    dates: z.string(),
    details: z.array(z.string()),
  })),
  experience: z.array(z.object({
    org: z.string(),
    title: z.string(),
    location: z.string(),
    dates: z.string(),
    bullets: z.array(z.string()),
  })),
  projects: z.array(z.object({
    name: z.string(),
    role: z.string(),
    dates: z.string(),
    bullets: z.array(z.string()),
  })),
  skills: z.array(z.object({ label: z.string(), items: z.string() })),
  additional: z.array(z.string()),
})

export type ResumeContent = z.infer<typeof ResumeContentSchema>
