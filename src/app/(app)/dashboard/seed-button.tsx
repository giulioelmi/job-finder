'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical } from 'lucide-react'

export function SeedButton() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function seed() {
    setLoading(true)
    await fetch('/api/seed', { method: 'POST' })
    setLoading(false)
    setDone(true)
    router.refresh()
  }

  if (done) return null

  return (
    <button
      onClick={seed}
      disabled={loading}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
    >
      <FlaskConical className="w-3.5 h-3.5" />
      {loading ? 'Loading...' : 'Load sample data'}
    </button>
  )
}
