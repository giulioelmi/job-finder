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

  // Fetch all notifications within the 7-day window, then filter by posted_at in JS
  const sevenDaysCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: notifications } = await supabase
    .from('job_notifications')
    .select('id, notified_at, jobs(id, title, company, location, url, found_at, posted_at)')
    .eq('user_id', user!.id)
    .gte('notified_at', sevenDaysCutoff)
    .order('notified_at', { ascending: false })

  const { data: existingApps } = await supabase
    .from('applications')
    .select('job_id')
    .eq('user_id', user!.id)

  const appliedJobIds = new Set((existingApps ?? []).map(a => a.job_id))

  // Filter by posted_at so the time tabs reflect when the job was actually posted
  const jobs = (notifications ?? []).filter(n => {
    const job = n.jobs as { posted_at?: string | null; found_at?: string } | null
    const timestamp = job?.posted_at ?? job?.found_at ?? n.notified_at
    return new Date(timestamp) >= new Date(cutoff)
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
