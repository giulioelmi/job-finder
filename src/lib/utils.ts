import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function getStatusColor(status: string): string {
  switch (status) {
    case 'applied': return 'bg-emerald-100 text-emerald-700'
    case 'interview': return 'bg-yellow-100 text-yellow-700'
    case 'offer': return 'bg-green-100 text-green-700'
    case 'rejected': return 'bg-red-100 text-red-700'
    case 'saved': return 'bg-gray-100 text-gray-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

// A date `days` from now (negative for the past).
export const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000)
