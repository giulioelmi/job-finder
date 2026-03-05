import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RunScraperButton } from './run-scraper-button'
import { JobListClient } from './job-list-client'
import { Bell } from 'lucide-react'

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Jobs the user was notified about in the last 24 hours
  const { data: notifications } = await supabase
    .from('job_notifications')
    .select('notified_at, jobs(id, title, company, location, url, found_at, posted_at)')
    .eq('user_id', user!.id)
    .gte('notified_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('notified_at', { ascending: false })

  // Jobs the user has already applied to (for button state)
  const { data: existingApps } = await supabase
    .from('applications')
    .select('job_id')
    .eq('user_id', user!.id)

  const appliedJobIds = new Set((existingApps ?? []).map(a => a.job_id))
  const jobs = notifications ?? []

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recent Jobs</h1>
          <p className="text-gray-500 mt-1">Jobs found in the last 24 hours matching your preferences</p>
        </div>
        <div className="flex items-center gap-3">
          <RunScraperButton />
          <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No jobs yet</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              The scraper runs every 30 minutes. Make sure you&apos;ve configured your job alerts in{' '}
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
