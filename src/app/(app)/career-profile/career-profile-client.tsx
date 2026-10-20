'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AgentState {
  agent_enabled: boolean
  send_resumes: boolean
  last_agent_run_at: string | null
}

interface AgentProfile {
  id: string
  name: string
  target_titles: string[]
  target_locations: string[]
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

export function CareerProfileClient({ state, agentProfile, plan, initialMatches, justUpgraded, billingReturn }: {
  state: AgentState | null
  agentProfile: AgentProfile | null
  plan: string
  initialMatches: Match[]
  justUpgraded: boolean
  billingReturn: boolean
}) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(state?.agent_enabled ?? true)
  const [sendResumes, setSendResumes] = useState(state?.send_resumes ?? true)
  const [busy, setBusy] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
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
  const lastRun = state?.last_agent_run_at
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
        <h2 className="font-semibold text-gray-900 mb-1">1. Your profile</h2>
        {agentProfile ? (
          <>
            <p className="text-sm text-gray-700">
              Your agent uses the profile <strong>{agentProfile.name}</strong>
              {agentProfile.target_titles.length > 0 && <>, looking for <strong>{agentProfile.target_titles.join(', ')}</strong></>}
              {agentProfile.target_locations.length > 0 && <> in {agentProfile.target_locations.join(', ')}</>}.
            </p>
            <p className="text-xs text-gray-400 mt-1">Have more resumes? Add them in Profiles for a fuller picture.</p>
            <Link href={`/profiles/${agentProfile.id}`} className="inline-block mt-3 text-sm text-green-700 font-medium hover:underline">Review and edit your profile →</Link>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Your agent needs your profile. Upload <strong>all the resumes you have</strong> and the AI builds it for you.
            </p>
            <Link href="/profiles" className="inline-block mt-3">
              <Button>Upload your resumes</Button>
            </Link>
          </>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">2. Your agent</h2>
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
          <Button onClick={runNow} disabled={!agentProfile || busy !== null || locked}>
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
        {!agentProfile && <p className="text-xs text-gray-400 mt-2">Build your profile first to run your agent.</p>}
        {agentProfile && locked && nextRun && (
          <p className="text-xs text-gray-500 mt-2">
            Next run available {new Date(nextRun + 5 * 60000).toLocaleString(undefined, { timeZoneName: 'short' })}. &ldquo;Run now&rdquo; follows the same {plan === 'pro' ? 'hourly' : '12-hour'} limit as the schedule.
          </p>
        )}
        {busy === 'run' && <p className="text-xs text-gray-400 mt-2">This usually takes 1 to 3 minutes. You can leave this page open.</p>}
        {state?.last_agent_run_at && (
          <p className="text-xs text-gray-400 mt-2">Last run: <span suppressHydrationWarning>{new Date(state.last_agent_run_at).toLocaleString()}</span></p>
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
