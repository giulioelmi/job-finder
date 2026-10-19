import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAgentForUser } from '@/lib/ai/run-agent'

export const maxDuration = 300

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await runAgentForUser(user.id)
    if (result.status === 'skipped' && result.reason === 'no_profile')
      return NextResponse.json({ error: 'Build your profile first' }, { status: 400 })
    return NextResponse.json(result)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'AGENT_RUN_FAILED', detail }, { status: 500 })
  }
}
