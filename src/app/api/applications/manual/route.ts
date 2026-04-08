import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, company, location, url, status } = await req.json()
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const { data: application, error } = await supabase
    .from('applications')
    .insert({
      user_id: user.id,
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
