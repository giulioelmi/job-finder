'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const MAX_RESUMES = 5

export function ResumeSourceCard({ initialPaths, agentProfileName }: {
  initialPaths: string[]
  agentProfileName: string | null
}) {
  const router = useRouter()
  const [paths, setPaths] = useState(initialPaths)
  const [busy, setBusy] = useState<'upload' | 'build' | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  async function call(label: 'upload' | 'build', url: string, init: RequestInit) {
    setBusy(label)
    setMessage(null)
    const res = await fetch(url, init)
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) setMessage({ text: data.detail ?? data.error ?? 'Something went wrong', error: true })
    return res.ok ? data : null
  }

  // One file per request: Vercel rejects request bodies over 4.5 MB
  async function upload(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      const form = new FormData()
      form.append('files', file)
      const data = await call('upload', '/api/career-profile/resumes', { method: 'POST', body: form })
      if (!data) return
      setPaths(data.resume_paths)
    }
  }

  async function remove(path: string) {
    const data = await call('upload', `/api/career-profile/resumes?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
    if (data) setPaths(data.resume_paths)
  }

  async function build() {
    if (agentProfileName && !confirm(`This replaces the experience, education, projects, skills and job targets in "${agentProfileName}" with what is in your resumes. Your address, work authorization and other answers stay as they are. Continue?`)) return
    const data = await call('build', '/api/career-profile/build', { method: 'POST' })
    if (!data) return
    setMessage({ text: `Done. Your profile "${data.name}" is saved below. Check it and fix anything that is off.`, error: false })
    router.refresh()
  }

  const fileName = (p: string) => p.split('/').pop()!.replace(/^\d+_/, '')

  return (
    <Card className="mb-6"><CardContent className="p-6">
      <h2 className="font-semibold text-gray-900 mb-1">Build your profile from your resumes</h2>
      <p className="text-sm text-gray-600 mb-1">
        <strong>Upload all the resumes you have</strong>: every version, for every kind of role you might apply to.
        The more we see, the more complete your profile, and the better your job matches and tailored resumes.
      </p>
      <p className="text-xs text-gray-400 mb-4">
        We merge them into one profile and keep every real accomplishment. PDF only, up to {MAX_RESUMES} files, 4 MB each.
      </p>

      {paths.length > 0 && (
        <ul className="mb-3 space-y-2">
          {paths.map(p => (
            <li key={p} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
              <span>{fileName(p)}</span>
              <button onClick={() => remove(p)} disabled={busy !== null} className="text-red-600 hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      )}
      {paths.length === 1 && (
        <p className="text-xs text-amber-700 mb-3">Only one resume so far. Do you have others (older versions, ones for different roles)? Add them for a fuller picture.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {paths.length < MAX_RESUMES && (
          <label className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer">
            {busy === 'upload' ? 'Uploading…' : paths.length === 0 ? 'Upload your resumes' : 'Add another resume'}
            <input type="file" accept="application/pdf" multiple className="hidden" onChange={e => upload(e.target.files)} />
          </label>
        )}
        <Button onClick={build} disabled={paths.length === 0 || busy !== null}>
          {busy === 'build' ? 'Reading your resumes… (under a minute)' : agentProfileName ? 'Rebuild my profile' : 'Build my profile with AI'}
        </Button>
        <span className="text-xs text-gray-400">{paths.length} of {MAX_RESUMES} resumes uploaded</span>
      </div>
      {paths.length === 0 && <p className="text-xs text-gray-400 mt-2">Upload at least one resume to build your profile.</p>}

      {message && (
        <p role={message.error ? 'alert' : 'status'} className={`mt-4 text-sm rounded-lg px-4 py-3 border ${message.error ? 'text-red-800 bg-red-50 border-red-200' : 'text-gray-700 bg-green-50 border-green-200'}`}>
          {message.text}
        </p>
      )}
    </CardContent></Card>
  )
}
