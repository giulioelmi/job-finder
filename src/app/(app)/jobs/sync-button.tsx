'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function SyncButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function handleSync() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/backfill', { method: 'POST' })
      const data = await res.json()
      setMessage(data.message ?? (res.ok ? 'Done.' : 'Error.'))
      if (res.ok && data.added > 0) router.refresh()
    } catch {
      setMessage('Request failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Syncing…' : 'Sync'}
      </button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </div>
  )
}
