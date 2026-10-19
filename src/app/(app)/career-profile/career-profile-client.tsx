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

const PRO_PRICE = process.env.NEXT_PUBLIC_PRO_PRICE // e.g. "$9/month", shown next to Pro when set

type Kind = 'ok' | 'error' | 'info'

export function CareerProfileClient({ initialRow, plan, initialMatches, justUpgraded, billingReturn }: {
  initialRow: Row | null
  plan: string
  initialMatches: Match[]
  justUpgraded: boolean
  billingReturn: boolean
}) {
  const router = useRouter()
  const [paths, setPaths] = useState(initialRow?.resume_paths ?? [])
  const [profile, setProfile] = useState(initialRow?.profile ?? null)
  const [enabled, setEnabled] = useState(initialRow?.agent_enabled ?? true)
  const [sendResumes, setSendResumes] = useState(initialRow?.send_resumes ?? true)
  const [busy, setBusy] = useState<string | null>(null)
  const [titles, setTitles] = useState(initialRow?.profile?.target_titles.join(', ') ?? '')
  const [locations, setLocations] = useState(initialRow?.profile?.locations.join(', ') ?? '')
  const [elapsed, setElapsed] = useState(0)
  const [resumesChanged, setResumesChanged] = useState(false)
  const [kind, setKind] = useState<Kind>('ok')
  const [overrideNext, setOverrideNext] = useState<number | null>(null)
  const [now, setNow] = useState<number | null>(null)
  const [message, setMessageText] = useState(
    justUpgraded ? (plan === 'pro' ? 'Welcome to Pro! Your agent now runs every hour.' : 'Payment received. Activating your Pro plan…')
      : billingReturn ? (plan === 'pro' ? 'Billing updated. If you cancelled, Pro stays active until the end of your billing period.' : 'Your subscription has ended. You are on the Free plan.')
      : ''
  )

  function setMessage(text: string, next: Kind = 'ok') {
    setMessageText(text)
    setKind(next)
  }

  async function call(label: string, url: string, init: RequestInit) {
    setBusy(label)
    setMessage('')
    const res = await fetch(url, init)
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) setMessage(data.detail ?? data.error ?? 'Something went wrong', 'error')
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
      setResumesChanged(true)
    }
  }

  async function remove(path: string) {
    const data = await call('upload', `/api/career-profile/resumes?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
    if (data) { setPaths(data.resume_paths); setResumesChanged(true) }
  }

  async function build() {
    const data = await call('build', '/api/career-profile/build', { method: 'POST' })
    if (!data) return
    setProfile(data.profile)
    setResumesChanged(false)
    setTitles(data.profile.target_titles.join(', '))
    setLocations(data.profile.locations.join(', '))
  }

  async function runNow() {
    const data = await call('run', '/api/career-profile/run-now', { method: 'POST' })
    if (!data) return
    if (data.status === 'skipped') {
      if (data.lastRunAt && Date.now() - new Date(data.lastRunAt).getTime() < 10 * 60000) {
        setMessage('Your agent is running or just finished. New matches appear below when it is done.', 'info')
        router.refresh()
        return
      }
      setOverrideNext(new Date(data.nextRunAt).getTime())
      setMessage('Your agent already ran recently, so it is waiting for its next scheduled slot.', 'info')
      return
    }
    setMessage(`Agent finished: ${data.matches} new match${data.matches === 1 ? '' : 'es'}.`)
    router.refresh()
  }

  async function savePreferences() {
    const list = (text: string) => text.split(',').map(x => x.trim()).filter(Boolean)
    const next = { ...profile!, target_titles: list(titles), search_keywords: list(titles).map(t => t.toLowerCase()), locations: list(locations) }
    const data = await call('prefs', '/api/career-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: next }),
    })
    if (data) { setProfile(next); setMessage('Saved. Your agent will use these on its next run.') }
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
    if (!justUpgraded) return
    if (plan === 'pro') { setMessage('Welcome to Pro! Your agent now runs every hour.'); return }
    let tries = 0
    const timer = setInterval(() => {
      router.refresh()
      if (++tries >= 5) { clearInterval(timer); setMessage('Still activating your Pro plan. This can take a minute; refresh the page shortly.', 'info') }
    }, 2000)
    return () => clearInterval(timer)
  }, [justUpgraded, plan, router])

  // The banner came from the URL; drop it so a reload or a shared link does not repeat it
  useEffect(() => {
    if (justUpgraded || billingReturn) window.history.replaceState(null, '', '/career-profile')
  }, [justUpgraded, billingReturn])

  // Another tab (or a scheduled run) may be mid-run, so refresh matches for a few minutes after a run started
  const lastRun = initialRow?.last_agent_run_at
  useEffect(() => {
    if (!lastRun || Date.now() - new Date(lastRun).getTime() > 5 * 60000) return
    const timer = setInterval(() => router.refresh(), 10000)
    const stop = setTimeout(() => clearInterval(timer), 5 * 60000)
    return () => { clearInterval(timer); clearTimeout(stop) }
  }, [lastRun, router])

  // Run now follows the plan's schedule, so lock the button until the next slot (5 min of slack, like the server)
  const intervalMs = (plan === 'pro' ? 1 : 12) * 3600000
  const derivedNext = lastRun ? new Date(lastRun).getTime() + intervalMs - 5 * 60000 : 0
  const nextRun = Math.max(derivedNext, overrideNext ?? 0) || null
  useEffect(() => {
    setNow(Date.now())
    if (!nextRun || nextRun <= Date.now()) return
    const timer = setTimeout(() => setNow(Date.now()), nextRun - Date.now() + 500)
    return () => clearTimeout(timer)
  }, [nextRun])
  const locked = now !== null && nextRun !== null && now < nextRun

  // The run takes minutes, so show which stage it is probably in
  useEffect(() => {
    if (busy !== 'run') return
    setElapsed(0)
    const timer = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timer)
  }, [busy])
  const runStage = elapsed < 10 ? 'Reading your profile…' : elapsed < 40 ? 'Searching company boards, LinkedIn and Indeed…' : elapsed < 80 ? 'Judging which jobs fit you…' : 'Tailoring your resumes…'

  const fileName = (p: string) => p.split('/').pop()!.replace(/^\d+_/, '')

  return (
    <div className="space-y-6">
      {message && (
        <p role={kind === 'error' ? 'alert' : 'status'} className={`sticky top-2 z-10 text-sm rounded-lg px-4 py-3 border ${
          kind === 'error' ? 'text-red-800 bg-red-50 border-red-200'
            : kind === 'info' ? 'text-amber-900 bg-amber-50 border-amber-200'
            : 'text-gray-700 bg-green-50 border-green-200'
        }`}>{message}</p>
      )}

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
        {paths.length === 0 && <p className="text-xs text-gray-400 mt-2">Upload at least one resume to build your profile.</p>}
        {profile && resumesChanged && paths.length > 0 && <p className="text-xs text-amber-700 mt-2">Your resumes changed. Rebuild your profile to update it.</p>}
      </CardContent></Card>

      {profile ? (
        <Card><CardContent className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4">2. Your career profile</h2>
          <p className="text-sm text-gray-700 mb-4">
            <strong>{profile.contact.name}</strong>{profile.contact.location && ` · ${profile.contact.location}`}
            {profile.seniority && ` · looking for ${profile.seniority} roles`}
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-5">
            <p className="text-sm font-medium text-gray-900 mb-2">What should your agent look for? Edit and save.</p>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Job titles (comma separated)</label>
            <input value={titles} onChange={e => setTitles(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" />
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Locations (comma separated)</label>
            <input value={locations} onChange={e => setLocations(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3" />
            <Button size="sm" onClick={savePreferences} disabled={busy !== null || !titles.trim()}>Save preferences</Button>
          </div>

          {profile.education.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Education</p>
              <div className="space-y-1 mb-4">
                {profile.education.map((e, i) => (
                  <p key={i} className="text-sm text-gray-700">
                    <strong>{e.school}</strong>, {e.degree} <span className="text-gray-400">{e.dates}</span>
                  </p>
                ))}
              </div>
            </>
          )}
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Skills</p>
          <div className="space-y-1 mb-4">
            {profile.skills.map(s => (
              <p key={s.group} className="text-sm text-gray-700"><strong>{s.group}:</strong> {s.items.join(', ')}</p>
            ))}
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Experience and projects</p>
          <p className="text-xs text-gray-400 mb-2">Stars show how strong an entry is; your agent leads with the strongest ones.</p>
          <div className="space-y-4">
            {[...profile.entries, ...profile.projects].map(e => (
              <div key={e.id}>
                <p className="text-sm font-medium text-gray-900">
                  {[e.role, e.org].filter(Boolean).join(' · ')} {e.dates && <span className="text-gray-400 font-normal">{e.dates}</span>}
                  <span className="ml-2 text-amber-500">{'★'.repeat(e.stars)}</span>
                </p>
                <ul className="list-disc ml-5 text-sm text-gray-600">
                  {e.facts.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-6">
          <h2 className="font-semibold text-gray-400">2. Your career profile</h2>
          <p className="text-sm text-gray-400 mt-1">Your profile appears here after you upload resumes and click &ldquo;Build profile with AI&rdquo;.</p>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">3. Your agent</h2>
          <Badge className={plan === 'pro' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'}>
            {plan === 'pro' ? 'Pro: runs every hour' : 'Free: runs every 12 hours'}
          </Badge>
        </div>
        {plan !== 'pro' && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-700 space-y-1">
            <p><strong>Free:</strong> your agent runs every 12 hours.</p>
            <p><strong>Pro{PRO_PRICE && ` (${PRO_PRICE})`}:</strong> your agent runs every hour, so you see new postings first.</p>
            <p className="text-xs text-gray-500 pt-1">You pay securely through Stripe and can cancel anytime from &ldquo;Manage billing&rdquo;.</p>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
          <input type="checkbox" checked={enabled} onChange={e => toggle('agent_enabled', e.target.checked)} />
          Run my agent on a schedule
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
          <input type="checkbox" checked={sendResumes} onChange={e => toggle('send_resumes', e.target.checked)} />
          Attach a tailored resume to each match
        </label>
        <div className="flex flex-wrap gap-3">
          <Button onClick={runNow} disabled={!profile || busy !== null || locked}>
            {busy === 'run' ? runStage : 'Run now'}
          </Button>
          {plan === 'pro' ? (
            <Button variant="secondary" onClick={() => openBilling('portal')} disabled={busy !== null}>Manage billing</Button>
          ) : (
            <Button variant="secondary" onClick={() => openBilling('checkout')} disabled={busy !== null}>
              Upgrade to Pro: hourly runs
            </Button>
          )}
        </div>
        {!profile && <p className="text-xs text-gray-400 mt-2">Build your profile first to run your agent.</p>}
        {profile && locked && nextRun && (
          <p className="text-xs text-gray-500 mt-2">
            Next run available {new Date(nextRun + 5 * 60000).toLocaleString(undefined, { timeZoneName: 'short' })}. &ldquo;Run now&rdquo; follows the same {plan === 'pro' ? 'hourly' : '12-hour'} limit as the schedule.
          </p>
        )}
        {busy === 'run' && <p className="text-xs text-gray-400 mt-2">This usually takes 1 to 3 minutes. You can leave this page open.</p>}
        {initialRow?.last_agent_run_at && (
          <p className="text-xs text-gray-400 mt-2">Last run: <span suppressHydrationWarning>{new Date(initialRow.last_agent_run_at).toLocaleString()}</span></p>
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
