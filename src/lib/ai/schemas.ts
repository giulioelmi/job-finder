import { z } from 'zod'

// What the profile builder returns: the same shape as the Profiles (autofill_profiles) fields it fills in,
// so a build is saved with no mapping step.
export const BuiltProfileSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  phone: z.string(),
  city: z.string(),
  state: z.string().describe('Two-letter US state code when it is a US location'),
  linkedin_url: z.string(),
  github_url: z.string(),
  target_titles: z.array(z.string()).describe('3-5 job titles this student is best qualified for right now'),
  target_locations: z.array(z.string()),
  education: z.array(z.object({
    school: z.string(),
    degree: z.string(),
    field_of_study: z.string(),
    gpa: z.string(),
    start_date: z.string(),
    end_date: z.string(),
  })),
  work_experience: z.array(z.object({
    company: z.string(),
    title: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    current: z.boolean(),
    description: z.string().describe('One true fact per line, each starting with "- ", numbers exactly as written'),
  })),
  projects: z.array(z.object({
    name: z.string(),
    url: z.string(),
    description: z.string().describe('One true fact per line, each starting with "- "'),
    technologies: z.string(),
  })),
  skills: z.array(z.string()),
})

export type BuiltProfile = z.infer<typeof BuiltProfileSchema>

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
