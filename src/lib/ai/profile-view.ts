import type { AutofillProfile } from '@/lib/types'

// What the AI gets to see of a profile: career facts only.
// Address, work authorization, DEI answers, salary and custom Q&A never leave the database.
export function agentView(p: AutofillProfile) {
  return {
    name: [p.first_name, p.last_name].filter(Boolean).join(' '),
    email: p.email ?? '',
    phone: p.phone ?? '',
    location: [p.city, p.state].filter(Boolean).join(', '),
    linkedin: p.linkedin_url ?? '',
    github: p.github_url ?? '',
    target_titles: p.target_titles ?? [],
    target_locations: p.target_locations ?? [],
    education: p.education ?? [],
    work_experience: p.work_experience ?? [],
    projects: p.projects ?? [],
    skills: p.skills ?? [],
  }
}

export type AgentView = ReturnType<typeof agentView>
