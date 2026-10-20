const RANGE_RE = /\b(\d{1,2})\s*[-–]\s*(\d{1,2})\+?\s*(?:years|yrs)\b/gi
const MIN_RE = /\b(?:at\s+least|minimum\s+of|min(?:imum)?\.?)\s*(\d{1,2})\+?\s*(?:years|yrs)\b/gi
const PLUS_RE = /\b(\d{1,2})\+?\s*(?:years|yrs)\s+(?:of\s+)?experience\b/gi

// Years of experience a posting asks for (the lowest number it mentions), or null.
export function extractYearsOfExperience(text: string): number | null {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ')
  const found: number[] = []

  for (const match of normalized.matchAll(RANGE_RE)) {
    const low = parseInt(match[1], 10)
    const high = parseInt(match[2], 10)
    if (!Number.isNaN(low) && !Number.isNaN(high)) found.push(Math.min(low, high))
  }

  for (const match of normalized.matchAll(MIN_RE)) {
    const years = parseInt(match[1], 10)
    if (!Number.isNaN(years)) found.push(years)
  }

  for (const match of normalized.matchAll(PLUS_RE)) {
    const years = parseInt(match[1], 10)
    if (!Number.isNaN(years)) found.push(years)
  }

  if (found.length === 0) return null
  return Math.min(...found)
}
