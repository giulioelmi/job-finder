import { createServiceClient } from '@/lib/supabase/server'
import { isUSLocation } from '@/lib/job-utils'
import { sendAgentMatchEmail } from '@/lib/email'
import { runJobAgent, type CatalogJob } from './job-agent'
import { tailorResume, renderResumeDocx } from './resume-tailor'
import type { CareerProfile } from './schemas'

type Service = ReturnType<typeof createServiceClient>

const FREE_HOURS = 12

// Greenhouse/Ashby jobs found since the last run, filtered to the student's keywords.
async function loadCatalogJobs(supabase: Service, profile: CareerProfile, since: Date): Promise<CatalogJob[]> {
  const { data } = await supabase
    .from('jobs')
    .select('title, company, location, url, external_id')
    .gte('found_at', since.toISOString())
    .limit(2000)

  const keywords = [...profile.search_keywords, ...profile.target_titles].map(k => k.toLowerCase())
  return (data ?? [])
    .filter(j => isUSLocation(j.location))
    .filter(j => keywords.some(k => j.title.toLowerCase().includes(k)))
    .slice(0, 60)
    .map(j => ({
      title: j.title,
      company: j.company,
      location: j.location,
      url: j.url,
      source: (j.external_id as string).startsWith('ashby') ? 'ashby' : 'greenhouse',
    }))
}

// One agent run for one user: find matches, tailor resumes, email, record.
export async function runAgentForUser(userId: string): Promise<{ matches: number }> {
  const supabase = createServiceClient()

  const [{ data: row }, { data: settings }, { data: previous }] = await Promise.all([
    supabase.from('career_profiles').select('*').eq('user_id', userId).single(),
    supabase.from('user_settings').select('plan, notification_email, email_notifications').eq('user_id', userId).single(),
    supabase.from('agent_matches').select('url').eq('user_id', userId),
  ])
  if (!row?.profile) return { matches: 0 }

  const profile = row.profile as CareerProfile
  const hours = settings?.plan === 'pro' ? 1 : FREE_HOURS
  // Look back to the last run (at least one schedule window, at most a day)
  const lastRun = row.last_agent_run_at ? new Date(row.last_agent_run_at).getTime() : 0
  const lookbackHours = Math.min(24, Math.max(hours, Math.ceil((Date.now() - lastRun) / 3600000)))
  const since = new Date(Date.now() - lookbackHours * 3600000)

  const catalogJobs = await loadCatalogJobs(supabase, profile, since)
  const excludeUrls = new Set((previous ?? []).map(m => m.url as string))
  const matches = await runJobAgent(profile, catalogJobs, excludeUrls, lookbackHours)

  const attachments: { filename: string; content: Buffer }[] = []
  for (const match of matches) {
    let resumePath: string | null = null
    if (row.send_resumes) {
      try {
        const content = await tailorResume(profile, match)
        const docx = await renderResumeDocx(content)
        const safe = `${match.company}_${match.title}`.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)
        const filename = `Resume_${safe}.docx`
        resumePath = `${userId}/tailored/${Date.now()}_${filename}`
        await supabase.storage.from('resumes').upload(resumePath, docx, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
        attachments.push({ filename, content: docx })
      } catch (e) {
        console.error('[agent] resume tailoring failed:', e)
      }
    }

    await supabase.from('agent_matches').upsert({
      user_id: userId,
      url: match.url,
      title: match.title,
      company: match.company,
      location: match.location,
      source: match.source,
      score: match.score,
      reason: match.reason,
      resume_path: resumePath,
    }, { onConflict: 'user_id,url', ignoreDuplicates: true })
  }

  const email = settings?.notification_email ?? profile.contact.email
  if (matches.length > 0 && settings?.email_notifications !== false && email) {
    await sendAgentMatchEmail(
      email,
      matches.map(m => ({ ...m, posted_at: null })),
      attachments
    )
  }

  await supabase
    .from('career_profiles')
    .update({ last_agent_run_at: new Date().toISOString() })
    .eq('user_id', userId)

  return { matches: matches.length }
}

// Users whose next run is due: pro every hour, free every 12 hours.
export async function findDueUsers(limit: number): Promise<string[]> {
  const supabase = createServiceClient()
  const { data: rows } = await supabase
    .from('career_profiles')
    .select('user_id, last_agent_run_at')
    .eq('agent_enabled', true)
    .not('profile', 'is', null)
    .order('last_agent_run_at', { ascending: true, nullsFirst: true })

  if (!rows || rows.length === 0) return []

  const { data: plans } = await supabase
    .from('user_settings')
    .select('user_id, plan')
    .in('user_id', rows.map(r => r.user_id))
  const planByUser = new Map((plans ?? []).map(p => [p.user_id as string, p.plan as string]))

  const now = Date.now()
  return rows
    .filter(r => {
      // 5 min of slack so an hourly cron doesn't skip a run that is a few seconds early
      const hours = planByUser.get(r.user_id) === 'pro' ? 1 : FREE_HOURS
      const last = r.last_agent_run_at ? new Date(r.last_agent_run_at).getTime() : 0
      return now - last >= hours * 3600000 - 5 * 60000
    })
    .slice(0, limit)
    .map(r => r.user_id as string)
}
