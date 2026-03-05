import { createClient } from '@/lib/supabase/server'
import { ApplicationsClient } from './applications-client'

export default async function ApplicationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: applications } = await supabase
    .from('applications')
    .select('*, jobs(title, company, location, url)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <p className="text-gray-500 mt-1">Track your job applications</p>
      </div>
      <ApplicationsClient applications={applications ?? []} userId={user!.id} />
    </div>
  )
}
