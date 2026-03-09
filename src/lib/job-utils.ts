// Broad set of patterns that identify internship/co-op type roles.
// Intentionally inclusive — false positives are better than false negatives.
const INTERN_PATTERNS = [
  'intern',        // catches "intern", "internship", "interns"
  'co-op',
  'coop',
  'co op',
  'apprentice',    // catches "apprentice", "apprenticeship"
  'trainee',
  'placement',
  'summer analyst',
  'summer associate',
  'summer program',
  'student worker',
  'werkstudent',   // German equivalent, common in EU companies
]

export function isInternshipTitle(title: string): boolean {
  const lower = title.toLowerCase()
  return INTERN_PATTERNS.some(p => lower.includes(p))
}

export function matchesJobType(title: string, jobTypes: string[]): boolean {
  if (jobTypes.length === 0 || (jobTypes.includes('internship') && jobTypes.includes('fulltime'))) {
    return true
  }
  const intern = isInternshipTitle(title)
  if (jobTypes.includes('internship') && !jobTypes.includes('fulltime')) return intern
  if (jobTypes.includes('fulltime') && !jobTypes.includes('internship')) return !intern
  return true
}
