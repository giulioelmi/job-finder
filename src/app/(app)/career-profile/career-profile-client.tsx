'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { CareerProfile } from '@/lib/ai/schemas'

interface Row {
  profile: CareerProfile | null
  resume_paths: string[]
  agent_enabled: boolean
  send_resumes: boolean
  last_agent_run_at: string | null
}

interface Match {
  id: string
  url: string
  title: string
  company: string | null
  location: string | null
  source: string
  score: number
  reason: string
  resume_url: string | null
}

export function CareerProfileClient({ initialRow, plan, initialMatches, justUpgraded }: {
  initialRow: Row | null
  plan: string
  initialMatches: Match[]
  justUpgraded: boolean
}) {
  const router = useRouter()
  const [paths, setPaths] = useState(initialRow?.resume_paths ?? [])
  const [profile, setProfile] = useState(initialRow?.profile ?? null)
  const [enabled, setEnabled] = useState(initialRow?.agent_enabled ?? true)
  const [sendResumes, setSendResumes] = useState(initialRow?.send_resumes ?? true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState(
    justUpgraded ? (plan === 'pro' ? 'Welcome to Pro! Your agent now runs every hour.' : 'Payment received. Activating your Pro plan…') : ''
  )

  async function call(label: string, url: string, init: RequestInit) {
    setBusy(label)
    setMessage('')
    const res = await fetch(url, init)
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) setMessage(data.detail ?? data.error ?? 'Something went wrong')
    return res.ok ? data : null
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return
    for (const file of Array.from(files)) {
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
    const data = await call('build', '/api/career-profile/build', { method: 'POST' })
    if (data) setProfile(data.profile)
  }

  async function runNow() {
    const data = await call('run', '/api/career-profile/run-now', { method: 'POST' })
    if (!data) return
    if (data.status === 'skipped') {
      const next = data.nextRunAt ? new Date(data.nextRunAt).toLocaleString() : 'later'
      setMessage(`Your agent already ran recently. The ${plan === 'pro' ? 'Pro' : 'Free'} plan allows the next run at ${next}.`)
      return
    }
    setMessage(`Agent finished: ${data.matches} new match${data.matches === 1 ? '' : 'es'}.`)
    router.refresh()
  }

  async function openBilling(endpoint: 'checkout' | 'portal') {
    const data = await call('billing', `/api/billing/${endpoint}`, { method: 'POST' })
    if (data?.url) window.location.href = data.url
  }

  async function toggle(field: 'agent_enabled' | 'send_resumes', value: boolean) {
    if (field === 'agent_enabled') setEnabled(value)
    else setSendResumes(value)
    await call('toggle', '/api/career-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  // Stripe can redirect back before its webhook lands, so check again for a few seconds after checkout
  useEffect(() => {
    if (!justUpgraded || plan === 'pro') return
    let tries = 0
    const timer = setInterval(() => { router.refresh(); if (++tries >= 5) clearInterval(timer) }, 2000)
    return () => clearInterval(timer)
  }, [justUpgraded, plan, router])

  const fileName = (p: string) => p.split('/').pop()!.replace(/^\d+_/, '')

  return (
    <div className="space-y-6">
      {message && <p className="text-sm text-gray-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">{message}</p>}

      <Card><CardContent className="p-6">
        <h2 className="font-semibold text-gray-900 mb-1">1. Your resumes</h2>
        <p className="text-sm text-gray-500 mb-4">Upload up to 5 PDF resumes (4 MB each). Claude merges them into one profile.</p>
        <ul className="mb-4 space-y-2">
          {paths.map(p => (
            <li key={p} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
              <span>{fileName(p)}</span>
              <button onClick={() => remove(p)} className="text-red-600 hover:underline">Remove</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <label className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer">
            {busy === 'upload' ? 'Uploading…' : 'Upload PDFs'}
            <input type="file" accept="application/pdf" multiple className="hidden" onChange={e => upload(e.target.files)} />
          </label>
          <Button onClick={build} disabled={paths.length === 0 || busy !== null}>
            {busy === 'build' ? 'Building profile…' : profile ? 'Rebuild profile with AI' : 'Build profile with AI'}
          </Button>
        </div>
      </CardContent></Card>

      {profile && (
        <Card><CardContent className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4">2. Your career profile</h2>
          <p className="text-sm text-gray-700 mb-3">
            <strong>{profile.contact.name}</strong>{profile.seniority && ` · ${profile.seniority}`}
          </p>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Target titles</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.target_titles.map(t => <Badge key={t} className="bg-green-100 text-green-800">{t}</Badge>)}
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Skills</p>
          <div className="space-y-1 mb-4">
            {profile.skills.map(s => (
              <p key={s.group} className="text-sm text-gray-700"><strong>{s.group}:</strong> {s.items.join(', ')}</p>
            ))}
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Experience and projects</p>
          <div className="space-y-4">
            {[...profile.entries, ...profile.projects].map(e => (
              <div key={e.id}>
                <p className="text-sm font-medium text-gray-900">
                  {e.role} · {e.org} <span className="text-gray-400 font-normal">{e.dates}</span>
                  <span className="ml-2 text-amber-500">{'★'.repeat(e.stars)}</span>
                </p>
                <ul className="list-disc ml-5 text-sm text-gray-600">
                  {e.facts.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">3. Your agent</h2>
          <Badge className={plan === 'pro' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}>
            {plan === 'pro' ? 'Pro: runs every hour' : 'Free: runs every 12 hours'}
          </Badge>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
          <input type="checkbox" checked={enabled} onChange={e => toggle('agent_enabled', e.target.checked)} />
          Run my agent on a schedule
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
          <input type="checkbox" checked={sendResumes} onChange={e => toggle('send_resumes', e.target.checked)} />
          Attach a tailored resume to each match
        </label>
        <div className="flex flex-wrap gap-3">
          <Button onClick={runNow} disabled={!profile || busy !== null}>
            {busy === 'run' ? 'Agent is searching… (up to a few minutes)' : 'Run now'}
          </Button>
          {plan === 'pro' ? (
            <Button variant="secondary" onClick={() => openBilling('portal')} disabled={busy !== null}>Manage billing</Button>
          ) : (
            <Button variant="secondary" onClick={() => openBilling('checkout')} disabled={busy !== null}>
              Upgrade to Pro: hourly runs
            </Button>
          )}
        </div>
        {initialRow?.last_agent_run_at && (
          <p className="text-xs text-gray-400 mt-2">Last run: {new Date(initialRow.last_agent_run_at).toLocaleString()}</p>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Recent matches</h2>
        {initialMatches.length === 0 ? (
          <p className="text-sm text-gray-400">No matches yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {initialMatches.map(m => (
              <li key={m.id} className="py-3">
                <a href={m.url} target="_blank" rel="noreferrer" className="font-medium text-gray-900 hover:underline">
                  {m.title}
                </a>
                <span className="text-sm text-gray-500"> · {m.company} · {m.source}</span>
                <Badge className="ml-2 bg-green-100 text-green-800">{m.score}% fit</Badge>
                <p className="text-sm text-gray-600 mt-1">{m.reason}</p>
                {m.resume_url && <a href={m.resume_url} className="text-sm text-blue-600 hover:underline">Download tailored resume</a>}
              </li>
            ))}
          </ul>
        )}
      </CardContent></Card>
    </div>
  )
}
