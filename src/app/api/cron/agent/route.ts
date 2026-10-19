import { NextRequest, NextResponse } from 'next/server'
import { findDueUsers, runAgentForUser } from '@/lib/ai/run-agent'

export const maxDuration = 300

// Called hourly. Pro users run every hour, free users every 12 hours.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userIds = await findDueUsers(5)
  let matches = 0
  for (const userId of userIds) {
    try {
      matches += (await runAgentForUser(userId)).matches
    } catch (e) {
      console.error(`[agent] run failed for ${userId}:`, e)
    }
  }
  return NextResponse.json({ success: true, users: userIds.length, matches })
}
