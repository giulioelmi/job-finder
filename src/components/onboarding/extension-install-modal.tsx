'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Chrome, ExternalLink } from 'lucide-react'

interface ExtensionInstallModalProps {
  userId: string
}

const EXTENSION_URL = 'https://chromewebstore.google.com/detail/bamboo-job-tracker/igkaoppnjcalejkpipllpjgikgghhbmj'

export function ExtensionInstallModal({ userId }: ExtensionInstallModalProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleInstalled() {
    setSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('user_settings')
      .update({ extension_prompt_seen: true })
      .eq('user_id', userId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-7">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
            <Chrome className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Install the Bamboo Chrome Extension</h2>
            <p className="text-sm text-gray-500">Required one-time setup</p>
          </div>
        </div>

        <p className="text-sm text-gray-700 leading-6">
          We just launched the Bamboo Job Tracker extension. Please add it to Chrome so you can quickly save jobs while browsing.
        </p>

        <div className="mt-4 p-3 rounded-lg border border-green-200 bg-green-50 text-sm text-green-900">
          This popup only appears once after login.
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">Unable to save confirmation: {error}</p>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <a
            href={EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg font-medium px-4 py-2 text-sm bg-green-700 text-white hover:bg-green-800 transition-colors"
          >
            Open Chrome Web Store
            <ExternalLink className="w-4 h-4 ml-2" />
          </a>

          <button
            type="button"
            onClick={handleInstalled}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg font-medium px-4 py-2 text-sm bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {saving ? 'Saving...' : "I've added the extension"}
          </button>
        </div>
      </div>
    </div>
  )
}
