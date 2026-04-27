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

  // Ensure every authenticated user has a settings row so we don't force onboarding on login.
  let { data: settings } = await supabase
    .from('user_settings')
    .select('id, extension_prompt_seen')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!settings) {
    const { data: insertedSettings } = await supabase
      .from('user_settings')
      .insert({ user_id: user.id, extension_prompt_seen: false })
      .select('id, extension_prompt_seen')
      .single()

    settings = insertedSettings
  }

  const showExtensionInstallModal = !settings?.extension_prompt_seen

  return (
    <AppLayout
      userEmail={user.email}
      notificationCount={notificationCount ?? 0}
      userId={user.id}
      showExtensionInstallModal={showExtensionInstallModal}
    >
      {children}
    </AppLayout>
  )
}
