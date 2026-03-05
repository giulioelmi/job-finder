import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RunScraperButton } from './run-scraper-button'
import { ExternalLink, MapPin, Building2, Clock, Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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

  const jobs = notifications ?? []

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recent Jobs</h1>
          <p className="text-gray-500 mt-1">Jobs you were notified about in the last 24 hours</p>
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
        <div className="space-y-3">
          {jobs.map((notif, i) => {
            const job = (notif.jobs as unknown) as {
              id: string
              title: string
              company: string | null
              location: string | null
              url: string
              found_at: string
              posted_at: string | null
            } | null

            if (!job) return null

            return (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base truncate">{job.title}</h3>
                      <div className="flex items-center flex-wrap gap-3 mt-1.5 text-sm text-gray-500">
                        {job.company && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {job.company}
                          </span>
                        )}
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {job.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Found {formatDistanceToNow(new Date(job.found_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Job
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
