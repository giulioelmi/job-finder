import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function buildLinkedInUrl(keywords: string[], location: string, timePeriod: number): string {
  const keywordQuery = keywords.map(k => `"${k}"`).join(' OR ')
  const params = new URLSearchParams({
    keywords: `(${keywordQuery})`,
    f_TPR: `r${timePeriod}`,
    sortBy: 'R',
  })
  if (location) {
    params.set('location', location)
  }
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'applied': return 'bg-blue-100 text-blue-700'
    case 'interview': return 'bg-yellow-100 text-yellow-700'
    case 'offer': return 'bg-green-100 text-green-700'
    case 'rejected': return 'bg-red-100 text-red-700'
    case 'saved': return 'bg-gray-100 text-gray-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}
