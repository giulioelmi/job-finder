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

const US_STATE_TOKEN_RE = /(?:^|[\s,\-/])(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)(?:$|[\s,\-/])/i

export function isUSLocation(location: string | null | undefined): boolean {
  if (!location) return true
  const loc = location.toLowerCase()

  if (loc.includes('united states')) return true
  if (loc.includes('u.s.')) return true
  if (loc.includes('usa')) return true
  if (loc.includes('us remote')) return true
  if (loc.includes('remote')) return true
  if (US_STATE_TOKEN_RE.test(loc)) return true

  return false
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
