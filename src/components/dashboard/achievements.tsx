'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Flame, Share2, Check, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { computeStats, tierFor, DAILY_GOAL, MEDALS, TIERS } from '@/lib/achievements'

const SEEN_KEY = 'bamboo-medals-seen'

interface Props {
  // created_at timestamps of sent applications
  dates: string[]
}

function Achievements({ dates }: Props) {
  // Computed once on mount; the seen-medals bookkeeping must not rerun on re-render.
  const [{ stats, fresh }] = useState(() => {
    const stats = computeStats(dates, new Date())
    const earned = Object.fromEntries(MEDALS.map(m => [m.id, tierFor(stats[m.id], m.thresholds)]))

    let seen: Record<string, number> = {}
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}')
      localStorage.setItem(SEEN_KEY, JSON.stringify(earned))
    } catch {}

    const fresh = MEDALS.filter(m => earned[m.id] >= 0 && earned[m.id] > (seen[m.id] ?? -1))
      .map(m => `${TIERS[earned[m.id]].emoji} ${TIERS[earned[m.id]].name} ${m.name}`)
    return { stats, fresh }
  })
  const [copied, setCopied] = useState(false)

  async function share(text: string) {
    const url = window.location.origin
    try {
      if (navigator.share) {
        await navigator.share({ text, url })
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {} // user cancelled the share sheet
  }

  const progressText =
    `🎋 My job hunt on Bamboo: ${stats.week} applications this week, ${stats.total} total` +
    (stats.streak > 1 ? `, and a ${stats.streak}-day streak 🔥` : '') + '. Keep going!'

  const goalPct = Math.min(stats.today / DAILY_GOAL, 1)

  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Your Momentum</CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">Keep the streak alive and level up your medals</p>
          </div>
          <button
            onClick={() => share(progressText)}
            className="flex items-center gap-1.5 text-sm font-medium text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg"
          >
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {fresh.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg bg-linear-to-r from-yellow-50 to-green-50 border border-yellow-200 px-4 py-3">
            <span className="text-2xl animate-bounce">🎉</span>
            <p className="text-sm text-gray-800">
              <span className="font-semibold">New medal{fresh.length > 1 ? 's' : ''} unlocked:</span>{' '}
              {fresh.join(', ')}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Streak */}
          <div className={`flex items-center gap-4 rounded-xl p-4 ${stats.streak > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
            <Flame className={`w-10 h-10 ${stats.streak > 0 ? 'text-orange-500 fill-orange-400' : 'text-gray-300'}`} />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.streak} day{stats.streak === 1 ? '' : 's'}
              </p>
              <p className="text-sm text-gray-500">
                {stats.streakAtRisk
                  ? <span className="text-orange-600 font-medium">Apply today to keep your streak!</span>
                  : stats.streak > 0
                    ? `Current streak · best ${stats.longestStreak}`
                    : 'Send an application to start a streak'}
              </p>
            </div>
          </div>

          {/* Daily goal ring */}
          <div className="flex items-center gap-4 rounded-xl p-4 bg-green-50">
            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-green-100" strokeWidth="4" />
              <circle
                cx="18" cy="18" r="15.9" fill="none" className="stroke-green-600 transition-all"
                strokeWidth="4" strokeLinecap="round" strokeDasharray={`${goalPct * 100} 100`}
              />
            </svg>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.today}/{DAILY_GOAL}</p>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                {stats.today >= DAILY_GOAL ? 'Daily goal crushed! 🎉' : `${DAILY_GOAL - stats.today} more to hit today's goal`}
              </p>
            </div>
          </div>
        </div>

        {/* Medals */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {MEDALS.map(medal => {
            const value = stats[medal.id]
            const tier = tierFor(value, medal.thresholds)
            const next = medal.thresholds[tier + 1]
            const prev = tier >= 0 ? medal.thresholds[tier] : 0
            const pct = next ? ((value - prev) / (next - prev)) * 100 : 100
            const t = tier >= 0 ? TIERS[tier] : null

            return (
              <div key={medal.id} className="flex flex-col items-center text-center rounded-xl border border-gray-100 p-3">
                <div className={`w-16 h-16 rounded-full p-1 ${t ? `bg-linear-to-br ${t.ring} shadow-md` : 'bg-gray-200'}`}>
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl">
                    <span className={t ? '' : 'grayscale opacity-30'}>{t ? t.emoji : '🏅'}</span>
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-900">{medal.name}</p>
                <p className={`text-xs font-medium ${t ? t.text : 'text-gray-400'}`}>{t ? t.name : 'Locked'}</p>
                <p className="text-xs text-gray-500 mt-1">{value} {medal.period}</p>

                <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {next ? `${next - value} to ${TIERS[tier + 1].name}` : 'Max tier!'}
                </p>

                {t && (
                  <button
                    onClick={() => share(`${t.emoji} I earned the ${t.name} "${medal.name}" medal on Bamboo: ${value} ${medal.period}!`)}
                    className="mt-2 text-xs text-green-700 hover:underline flex items-center gap-1"
                  >
                    <Share2 className="w-3 h-3" /> Share
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// Client-only so days follow the viewer's timezone (not the server's) and localStorage is available.
export default dynamic(() => Promise.resolve(Achievements), {
  ssr: false,
  loading: () => <div className="mb-6 h-72 rounded-xl bg-gray-100 animate-pulse" />,
})
