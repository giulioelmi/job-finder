'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

const TIME_OPTIONS = [
  { label: 'Past 1 hour',  value: 'r3600' },
  { label: 'Past 24 hours', value: 'r86400' },
  { label: 'Past week',    value: 'r604800' },
  { label: 'Past month',  value: 'r2592000' },
]

export function RunScraperButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [timeFilter, setTimeFilter] = useState('r86400')
  const router = useRouter()

  async function run() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/scrape/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeFilter }),
      })
      const data = await res.json()
      setResult(data.message ?? data.error ?? 'Done')
      if (data.new > 0) router.refresh()
    } catch {
      setResult('Failed to run scraper')
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <select
          value={timeFilter}
          onChange={e => setTimeFilter(e.target.value)}
          disabled={loading}
          className="px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 shadow-sm"
        >
          {TIME_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Scanning...' : 'Scan Now'}
        </button>
      </div>
      {result && <span className="text-sm text-gray-600">{result}</span>}
    </div>
  )
}
