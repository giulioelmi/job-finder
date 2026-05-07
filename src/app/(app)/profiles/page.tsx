import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProfilesClient } from './profiles-client'

export default async function ProfilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await supabase
    .from('autofill_profiles')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: true })

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Autofill Profiles</h1>
          <p className="text-gray-500 mt-1">Manage the profiles used by the Bamboo extension to fill job applications.</p>
        </div>
        <Link href="/profiles/new">
          <Button>+ New profile</Button>
        </Link>
      </div>
      <ProfilesClient initialProfiles={profiles ?? []} />
    </div>
  )
}
