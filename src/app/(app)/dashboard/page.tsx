import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getStatusColor } from '@/lib/utils'
import { Briefcase, Bell, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch stats in parallel
  const [applicationsRes, notificationsRes, recentJobsRes] = await Promise.all([
    supabase
      .from('applications')
      .select('status, jobs(title, company)', { count: 'exact' })
      .eq('user_id', user!.id),
    supabase
      .from('job_notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', user!.id)
      .gte('notified_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('job_notifications')
      .select('notified_at, jobs(title, company, url, location)')
      .eq('user_id', user!.id)
      .order('notified_at', { ascending: false })
      .limit(5),
  ])

  const applications = applicationsRes.data ?? []
  const notificationsCount = notificationsRes.count ?? 0
  const recentJobs = recentJobsRes.data ?? []

  const statusCounts = {
    applied: applications.filter(a => a.status === 'applied').length,
    interview: applications.filter(a => a.status === 'interview').length,
    offer: applications.filter(a => a.status === 'offer').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  }

  const stats = [
    { label: 'Total Applications', value: applications.length, icon: Briefcase, color: 'text-blue-600' },
    { label: 'Jobs Today', value: notificationsCount, icon: Bell, color: 'text-purple-600' },
    { label: 'Interviews', value: statusCounts.interview, icon: TrendingUp, color: 'text-yellow-600' },
    { label: 'Offers', value: statusCounts.offer, icon: Clock, color: 'text-green-600' },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Track your job search progress</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className="p-2 bg-gray-50 rounded-lg">
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Application Pipeline */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Application Pipeline</CardTitle>
              <Link href="/applications" className="text-sm text-blue-600 hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No applications yet</p>
                <Link href="/jobs" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                  Browse recent jobs →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.slice(0, 5).map((app, i) => {
                  const job = (app.jobs as unknown) as { title: string; company: string } | null
                  return (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{job?.title ?? 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{job?.company ?? '—'}</p>
                      </div>
                      <Badge className={getStatusColor(app.status)}>
                        {app.status}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Notifications</CardTitle>
              <Link href="/jobs" className="text-sm text-blue-600 hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentJobs.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No notifications yet</p>
                <Link href="/settings" className="text-blue-600 text-sm hover:underline mt-1 inline-block">
                  Set up job alerts →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((notif, i) => {
                  const job = (notif.jobs as unknown) as { title: string; company: string; url: string; location: string } | null
                  return (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{job?.title ?? 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{job?.company} · {job?.location}</p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(notif.notified_at), { addSuffix: true })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline breakdown */}
      {applications.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <Badge className={getStatusColor(status)}>{status}</Badge>
                  <span className="text-sm font-semibold text-gray-700">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
