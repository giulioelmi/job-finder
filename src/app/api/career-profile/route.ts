import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CareerProfileSchema } from '@/lib/ai/schemas'

// Edit the profile JSON and the agent toggles.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    profile?: unknown
    agent_enabled?: boolean
    send_resumes?: boolean
  } | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (body.profile !== undefined) {
    const parsed = CareerProfileSchema.safeParse(body.profile)
    if (!parsed.success) return NextResponse.json({ error: 'Profile does not match the expected shape' }, { status: 400 })
    update.profile = parsed.data
  }
  if (typeof body.agent_enabled === 'boolean') update.agent_enabled = body.agent_enabled
  if (typeof body.send_resumes === 'boolean') update.send_resumes = body.send_resumes

  const { error } = await supabase
    .from('career_profiles')
    .upsert({ user_id: user.id, ...update }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
