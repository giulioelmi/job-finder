import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CareerProfileClient } from './career-profile-client'

export default async function CareerProfilePage({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const { upgraded } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: row }, { data: settings }, { data: matches }] = await Promise.all([
    supabase.from('career_profiles').select('*').eq('user_id', user!.id).maybeSingle(),
    supabase.from('subscriptions').select('plan').eq('user_id', user!.id).maybeSingle(),
    supabase.from('agent_matches').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).order('score', { ascending: false }).limit(20),
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
        Upload your resumes and Claude builds your career profile. Your agent then scans company boards, LinkedIn and Indeed, and emails you the jobs that fit, with a tailored resume.
      </p>
      <CareerProfileClient
        initialRow={row ?? null}
        plan={settings?.plan ?? 'free'}
        initialMatches={matchesWithLinks}
        justUpgraded={upgraded === '1'}
      />
    </div>
  )
}
