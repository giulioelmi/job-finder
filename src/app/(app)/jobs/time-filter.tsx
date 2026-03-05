'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const OPTIONS = [
  { label: '1h',  value: 1 },
  { label: '6h',  value: 6 },
  { label: '12h', value: 12 },
  { label: '24h', value: 24 },
]

export function TimeFilter({ current }: { current: number }) {
  const router = useRouter()
  const params = useSearchParams()

  function select(hours: number) {
    const next = new URLSearchParams(params.toString())
    next.set('hours', String(hours))
    router.push(`?${next.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => select(opt.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            current === opt.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
