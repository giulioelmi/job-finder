import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAgentForUser } from '@/lib/ai/run-agent'

export const maxDuration = 300

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    return NextResponse.json(await runAgentForUser(user.id))
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'AGENT_RUN_FAILED', detail }, { status: 500 })
  }
}
