'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function RunScraperButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const router = useRouter()

  async function run() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/scrape/trigger', { method: 'POST' })
      const data = await res.json()
      setResult(data.message ?? data.error ?? 'Done')
      if (data.new > 0) router.refresh()
    } catch {
      setResult('Failed to run scraper')
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Scanning...' : 'Scan Now'}
      </button>
      {result && <span className="text-sm text-gray-600">{result}</span>}
    </div>
  )
}
