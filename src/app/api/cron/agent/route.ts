import { NextRequest, NextResponse } from 'next/server'
import { findDueUsers, runAgentForUser } from '@/lib/ai/run-agent'

export const maxDuration = 300

// Called hourly. Two users per call keeps each call inside the function time limit; the
// stalest users go first, so the rest are picked up on the next hourly call.
// Pro users run every hour, free users once a day.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userIds = await findDueUsers(2)
  let matches = 0
  for (const userId of userIds) {
    try {
      const result = await runAgentForUser(userId)
      if (result.status === 'ran') matches += result.matches
    } catch (e) {
      console.error(`[agent] run failed for ${userId}:`, e)
    }
  }
  return NextResponse.json({ success: true, users: userIds.length, matches })
}
