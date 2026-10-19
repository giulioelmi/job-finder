import { createServiceClient } from '@/lib/supabase/server'
import { isUSLocation } from '@/lib/job-utils'
import { sendAgentMatchEmail } from '@/lib/email'
import { readJobText } from '@/lib/search/read-job'
import { runJobAgent, type CatalogJob } from './job-agent'
import { tailorResume, renderResumeDocx } from './resume-tailor'
import type { CareerProfile } from './schemas'

type Service = ReturnType<typeof createServiceClient>

export const FREE_HOURS = 12
export const PRO_HOURS = 1
const SLACK_MS = 5 * 60000 // an hourly cron can fire a few minutes early

export function intervalHours(plan: string | null | undefined): number {
  return plan === 'pro' ? PRO_HOURS : FREE_HOURS
}

function dueAt(lastRun: string | null, plan: string | null | undefined): number {
  return (lastRun ? new Date(lastRun).getTime() : 0) + intervalHours(plan) * 3600000 - SLACK_MS
}

async function getPlan(supabase: Service, userId: string): Promise<string> {
  const { data } = await supabase.from('subscriptions').select('plan').eq('user_id', userId).maybeSingle()
  return data?.plan ?? 'free'
}

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

export type RunResult =
  | { status: 'ran'; matches: number }
  | { status: 'skipped'; reason: 'no_profile' | 'not_due'; nextRunAt?: string }

// One agent run for one user: find matches, tailor resumes, email, record.
// The run is claimed up front by stamping last_agent_run_at, so double clicks and
// overlapping cron calls cannot start a second run (or beat the plan's schedule).
export async function runAgentForUser(userId: string): Promise<RunResult> {
  const supabase = createServiceClient()

  const { data: row } = await supabase.from('career_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (!row?.profile) return { status: 'skipped', reason: 'no_profile' }

  const plan = await getPlan(supabase, userId)
  const previousRun: string | null = row.last_agent_run_at
  if (Date.now() < dueAt(previousRun, plan)) {
    return { status: 'skipped', reason: 'not_due', nextRunAt: new Date(dueAt(previousRun, plan) + SLACK_MS).toISOString() }
  }

  const claim = supabase.from('career_profiles').update({ last_agent_run_at: new Date().toISOString() }).eq('user_id', userId)
  const { data: claimed } = await (previousRun ? claim.eq('last_agent_run_at', previousRun) : claim.is('last_agent_run_at', null)).select('id')
  if (!claimed?.length) return { status: 'skipped', reason: 'not_due' }

  try {
    return await run(supabase, userId, row, plan, previousRun)
  } catch (e) {
    // Give the schedule back so a failed run is retried on the next cron call
    await supabase.from('career_profiles').update({ last_agent_run_at: previousRun }).eq('user_id', userId)
    throw e
  }
}

async function run(
  supabase: Service,
  userId: string,
  row: { profile: CareerProfile; send_resumes: boolean },
  plan: string,
  previousRun: string | null
): Promise<RunResult> {
  const profile = row.profile
  const [{ data: settings }, { data: previous }] = await Promise.all([
    supabase.from('user_settings').select('notification_email, email_notifications').eq('user_id', userId).maybeSingle(),
    supabase.from('agent_matches').select('url').eq('user_id', userId),
  ])

  // Look back to the last run (at least one schedule window, at most a day)
  const sinceLast = previousRun ? Math.ceil((Date.now() - new Date(previousRun).getTime()) / 3600000) : 24
  const lookbackHours = Math.min(24, Math.max(intervalHours(plan), sinceLast))
  const since = new Date(Date.now() - lookbackHours * 3600000)

  const catalogJobs = await loadCatalogJobs(supabase, profile, since)
  const excludeUrls = new Set((previous ?? []).map(m => m.url as string))
  const matches = await runJobAgent(profile, catalogJobs, excludeUrls, lookbackHours)

  const attachments: { filename: string; content: Buffer }[] = []
  for (const match of matches) {
    let resumePath: string | null = null
    if (row.send_resumes) {
      try {
        const description = match.description || await readJobText(match.url)
        const content = await tailorResume(profile, { ...match, description })
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

  const email = settings?.notification_email || profile.contact.email
  if (matches.length > 0 && settings?.email_notifications !== false && email) {
    await sendAgentMatchEmail(email, matches.map(m => ({ ...m, posted_at: null })), attachments, profile.contact.name.split(' ')[0])
  }

  return { status: 'ran', matches: matches.length }
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

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('user_id, plan')
    .in('user_id', rows.map(r => r.user_id))
  const planByUser = new Map((subs ?? []).map(s => [s.user_id as string, s.plan as string]))

  return rows
    .filter(r => Date.now() >= dueAt(r.last_agent_run_at, planByUser.get(r.user_id)))
    .slice(0, limit)
    .map(r => r.user_id as string)
}
