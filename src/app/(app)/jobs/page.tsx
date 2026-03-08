import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { JobListClient } from './job-list-client'
import { TimeFilter } from './time-filter'
import { Bell } from 'lucide-react'

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ hours?: string }>
}) {
  const { hours: hoursStr } = await searchParams
  const hours = Math.min(168, Math.max(1, parseInt(hoursStr ?? '24', 10) || 24))
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch current user settings to re-apply filters on display
  const { data: settings } = await supabase
    .from('user_settings')
    .select('search_all_companies, companies, categories, job_types, location')
    .eq('user_id', user!.id)
    .single()

  const searchAll: boolean = settings?.search_all_companies ?? false
  const userCompanies: string[] = searchAll ? [] : ((settings?.companies ?? []) as string[]).map((c: string) => c.toLowerCase())
  const userKeywords: string[] = ((settings?.categories ?? []) as string[]).map((k: string) => k.toLowerCase())
  const userJobTypes: string[] = (settings?.job_types as string[] | null) ?? ['internship', 'fulltime']
  const userLocation = (settings?.location ?? '').trim().toLowerCase()

  // Fetch all notifications within the 7-day window, then filter in JS
  const sevenDaysCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: notifications } = await supabase
    .from('job_notifications')
    .select('id, notified_at, jobs(id, external_id, title, company, location, url, found_at, posted_at)')
    .eq('user_id', user!.id)
    .gte('notified_at', sevenDaysCutoff)
    .order('notified_at', { ascending: false })

  const { data: existingApps } = await supabase
    .from('applications')
    .select('job_id')
    .eq('user_id', user!.id)

  const appliedJobIds = new Set((existingApps ?? []).map(a => a.job_id))

  // Filter by current settings + time window, then sort newest-first
  const jobs = (notifications ?? [])
    .filter(n => {
      const job = n.jobs as { external_id?: string; title?: string; company?: string; location?: string | null; posted_at?: string | null; found_at?: string } | null
      if (!job) return false

      // Time filter
      const timestamp = job.posted_at ?? job.found_at ?? n.notified_at
      if (new Date(timestamp) < new Date(cutoff)) return false

      const titleLower = (job.title ?? '').toLowerCase()

      // Keyword filter (skip if no keywords = show all)
      if (userKeywords.length > 0 && !userKeywords.some(kw => titleLower.includes(kw))) return false

      // Company filter — extract slug from external_id ("gh_{slug}_{numericId}")
      if (!searchAll && userCompanies.length > 0) {
        const parts = (job.external_id ?? '').split('_')
        const slug = parts.slice(1, -1).join('_').toLowerCase()
        if (!userCompanies.includes(slug)) return false
      }

      // Job type filter
      const isIntern = titleLower.includes('intern')
      const wantIntern = userJobTypes.includes('internship')
      const wantFull = userJobTypes.includes('fulltime')
      if (wantIntern && !wantFull && !isIntern) return false
      if (wantFull && !wantIntern && isIntern) return false

      // Location filter
      if (userLocation && !job.location?.toLowerCase().includes(userLocation)) return false

      return true
    })
    .sort((a, b) => {
      const getTs = (n: typeof a) => {
        const job = n.jobs as { posted_at?: string | null; found_at?: string } | null
        return new Date(job?.posted_at ?? job?.found_at ?? n.notified_at).getTime()
      }
      return getTs(b) - getTs(a)
    })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recent Jobs</h1>
          <p className="text-gray-500 mt-1">Jobs matching your preferences from the last {hours < 24 ? `${hours}h` : hours === 24 ? '1 day' : '7 days'}</p>
        </div>
        <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1">
          {jobs.length} job{jobs.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="mb-6">
        <Suspense>
          <TimeFilter current={hours} />
        </Suspense>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No jobs yet</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              Jobs are fetched automatically. Make sure you&apos;ve configured your alerts in{' '}
              <a href="/settings" className="text-blue-600 hover:underline">Settings</a>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <JobListClient
          jobs={jobs as never}
          userId={user!.id}
          appliedJobIds={appliedJobIds}
        />
      )}
    </div>
  )
}
