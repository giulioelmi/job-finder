import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './settings-form'
import { PlanCard } from './plan-card'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user!.id)
    .single()

  const { data: billing } = await supabase
    .from('billing')
    .select('is_pro')
    .eq('user_id', user!.id)
    .maybeSingle()

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your job search preferences</p>
      </div>
      <PlanCard isPro={billing?.is_pro ?? false} />
      <SettingsForm userId={user!.id} userEmail={user!.email ?? ''} initialSettings={settings} />
    </div>
  )
}
