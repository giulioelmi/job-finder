import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProfilesClient } from './profiles-client'
import { ResumeSourceCard } from './resume-source-card'

export default async function ProfilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profiles }, { data: agentState }] = await Promise.all([
    supabase
    .from('autofill_profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true }),
    supabase.from('career_profiles').select('resume_paths').eq('user_id', user.id).maybeSingle(),
  ])

  const agentProfile = (profiles ?? []).find(p => p.use_for_agent)

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profiles</h1>
          <p className="text-gray-500 mt-1">Your career profile. It fills job applications through the Bamboo extension and feeds your AI job agent.</p>
        </div>
        <Link href="/profiles/new">
          <Button>+ New profile</Button>
        </Link>
      </div>
      <ResumeSourceCard initialPaths={agentState?.resume_paths ?? []} agentProfileName={agentProfile?.name ?? null} />
      {/* The list copies its props into state once, so remount it when a build or edit changes the profiles */}
      <ProfilesClient key={(profiles ?? []).map(p => `${p.id}:${p.updated_at}`).join(',')} initialProfiles={profiles ?? []} />
    </div>
  )
}
