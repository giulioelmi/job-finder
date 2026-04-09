import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Support cookie session (web app) and Bearer token (Chrome extension)
  const authHeader = req.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  let userId: string | null = null

  if (bearerToken) {
    const service = createServiceClient()
    const { data: { user } } = await service.auth.getUser(bearerToken)
    userId = user?.id ?? null
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, company, role, linkedin_url, notes } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const service = createServiceClient()
  const nextFollowup = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: contact, error } = await service
    .from('networking_contacts')
    .insert({
      user_id:          userId,
      name:             name.trim(),
      company:          company?.trim()      || null,
      role:             role?.trim()         || null,
      linkedin_url:     linkedin_url?.trim() || null,
      notes:            notes?.trim()        || null,
      last_contacted_at: new Date().toISOString(),
      next_followup_at:  nextFollowup,
    })
    .select('*')
    .single()

  if (error || !contact) {
    return NextResponse.json({ error: 'Failed to save contact' }, { status: 500 })
  }

  return NextResponse.json({ contact })
}
