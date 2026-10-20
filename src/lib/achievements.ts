// Gamification: streaks, daily goal and tiered medals, all derived from
// application timestamps. Days are bucketed in the viewer's local timezone.

export const DAILY_GOAL = 5

export const TIERS = [
  { name: 'Bronze', emoji: '🥉', ring: 'from-amber-600 to-orange-800', text: 'text-amber-800' },
  { name: 'Silver', emoji: '🥈', ring: 'from-gray-300 to-gray-500', text: 'text-gray-600' },
  { name: 'Gold', emoji: '🥇', ring: 'from-yellow-300 to-yellow-600', text: 'text-yellow-700' },
  { name: 'Platinum', emoji: '💠', ring: 'from-cyan-300 to-teal-600', text: 'text-teal-700' },
  { name: 'Diamond', emoji: '💎', ring: 'from-sky-300 via-indigo-400 to-fuchsia-500', text: 'text-indigo-700' },
]

export type MedalStat = 'today' | 'week' | 'month' | 'total' | 'streak'

export const MEDALS: { id: MedalStat; name: string; period: string; thresholds: number[] }[] = [
  { id: 'today', name: 'Daily Hustle', period: 'applications today', thresholds: [1, 3, 5, 10, 20] },
  { id: 'week', name: 'Weekly Grind', period: 'applications in 7 days', thresholds: [5, 15, 30, 50, 100] },
  { id: 'month', name: 'Monthly Marathon', period: 'applications in 30 days', thresholds: [20, 50, 100, 200, 400] },
  { id: 'total', name: 'Career Builder', period: 'applications all time', thresholds: [10, 50, 100, 250, 500] },
  { id: 'streak', name: 'On Fire', period: 'day streak', thresholds: [3, 7, 14, 30, 60] },
]

export function dayKey(d: Date): string {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD in local time
}

function shiftDay(key: string, days: number): string {
  const d = new Date(key + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return dayKey(d)
}

export function computeStats(dates: string[], now: Date) {
  const perDay = new Map<string, number>()
  for (const iso of dates) {
    const key = dayKey(new Date(iso))
    perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }

  const todayKey = dayKey(now)
  const sumLastDays = (n: number) => {
    let sum = 0
    for (let i = 0; i < n; i++) sum += perDay.get(shiftDay(todayKey, -i)) ?? 0
    return sum
  }

  // Current streak: a streak stays alive until the end of today, so start
  // counting from yesterday if nothing has been sent yet today.
  let streak = 0
  let cursor = perDay.has(todayKey) ? todayKey : shiftDay(todayKey, -1)
  while (perDay.has(cursor)) {
    streak++
    cursor = shiftDay(cursor, -1)
  }

  let longestStreak = 0
  let run = 0
  let prev = ''
  for (const key of [...perDay.keys()].sort()) {
    run = prev && shiftDay(prev, 1) === key ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    prev = key
  }

  return {
    today: perDay.get(todayKey) ?? 0,
    week: sumLastDays(7),
    month: sumLastDays(30),
    total: dates.length,
    streak,
    longestStreak,
    streakAtRisk: streak > 0 && !perDay.has(todayKey),
  }
}

export type Stats = ReturnType<typeof computeStats>

// Highest tier index reached for a value, or -1 if none yet.
export function tierFor(value: number, thresholds: number[]): number {
  return thresholds.filter(t => value >= t).length - 1
}
