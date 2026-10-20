import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CareerProfileClient } from './career-profile-client'

export default async function CareerProfilePage({ searchParams }: { searchParams: Promise<{ upgraded?: string; billing?: string }> }) {
  const { upgraded, billing } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: state }, { data: agentProfile }, { data: subscription }, { data: matches }] = await Promise.all([
    supabase.from('career_profiles').select('agent_enabled, send_resumes, last_agent_run_at').eq('user_id', user.id).maybeSingle(),
    supabase.from('autofill_profiles').select('id, name, target_titles, target_locations').eq('user_id', user.id).eq('use_for_agent', true).maybeSingle(),
    supabase.from('subscriptions').select('plan').eq('user_id', user.id).maybeSingle(),
    supabase.from('agent_matches').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).order('score', { ascending: false }).limit(20),
  ])

  // Signed links for tailored resumes
  const service = createServiceClient()
  const matchesWithLinks = await Promise.all((matches ?? []).map(async m => {
    if (!m.resume_path) return { ...m, resume_url: null }
    const { data } = await service.storage.from('resumes').createSignedUrl(m.resume_path, 3600)
    return { ...m, resume_url: data?.signedUrl ?? null }
  }))

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">AI Job Agent</h1>
      <p className="text-gray-500 mt-1 mb-8">
        Your agent scans company boards, LinkedIn and Indeed for jobs that fit your profile and emails you the best ones, each with a tailored resume.
      </p>
      <CareerProfileClient
        state={state ?? null}
        agentProfile={agentProfile ? { ...agentProfile, target_titles: agentProfile.target_titles ?? [], target_locations: agentProfile.target_locations ?? [] } : null}
        plan={subscription?.plan ?? 'free'}
        initialMatches={matchesWithLinks}
        justUpgraded={upgraded === '1'}
        billingReturn={billing === '1'}
      />
    </div>
  )
}
