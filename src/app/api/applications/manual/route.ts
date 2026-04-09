import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Support both cookie-based auth (web app) and Bearer token auth (Chrome extension)
  const authHeader = req.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  let userId: string | null = null

  if (bearerToken) {
    // Extension: verify the JWT with the service client, then write with it too
    const service = createServiceClient()
    const { data: { user } } = await service.auth.getUser(bearerToken)
    userId = user?.id ?? null
  } else {
    // Web app: cookie session
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, company, location, url, status } = await req.json()
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  // Use service client to bypass RLS — user_id is set explicitly
  const service = createServiceClient()
  const { data: application, error } = await service
    .from('applications')
    .insert({
      user_id: userId,
      title: title.trim(),
      company: company?.trim() || null,
      location: location?.trim() || null,
      url: url?.trim() || null,
      status: status ?? 'applied',
    })
    .select('*')
    .single()

  if (error || !application) {
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 })
  }

  return NextResponse.json({ application })
}
