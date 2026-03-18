export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppLayout } from '@/components/layout/app-layout'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Count contacts with overdue follow-ups for the notification bell
  const { count: notificationCount } = await supabase
    .from('networking_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('next_followup_at', new Date().toISOString())

  // Detect first-time users: no settings row means they haven't completed onboarding
  const { data: settings } = await supabase
    .from('user_settings')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  const isNewUser = !settings

  return (
    <AppLayout
      userEmail={user.email}
      notificationCount={notificationCount ?? 0}
      isNewUser={isNewUser}
      userId={user.id}
    >
      {children}
    </AppLayout>
  )
}
