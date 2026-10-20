import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getStatusColor } from '@/lib/utils'
import { Briefcase, Sparkles, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'
import ApplicationFlowDiagram from '@/components/dashboard/application-flow-diagram'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch stats in parallel
  const [applicationsRes, matchesRes, agentProfileRes] = await Promise.all([
    supabase
      .from('applications')
      .select('status, created_at, jobs(title, company)', { count: 'exact' })
      .eq('user_id', user!.id),
    supabase
      .from('agent_matches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id),
    supabase
      .from('autofill_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .eq('use_for_agent', true),
  ])

  const applications = applicationsRes.data ?? []
  const matchesCount = matchesRes.count ?? 0
  const hasAgentProfile = (agentProfileRes.count ?? 0) > 0

  // Build 7-day activity chart data
  const today = new Date()
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
  const appsByDay = weekDays.map(day => ({
    day,
    label: new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
    count: applications.filter(a => a.created_at?.startsWith(day)).length,
  }))
  const maxCount = Math.max(...appsByDay.map(d => d.count), 1)

  const statusCounts = {
    applied: applications.filter(a => a.status === 'applied').length,
    interview: applications.filter(a => a.status === 'interview').length,
    offer: applications.filter(a => a.status === 'offer').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    saved: applications.filter(a => a.status === 'saved').length,
  }

  const stats = [
    { label: 'Total Applications', value: applications.length, icon: Briefcase, color: 'text-green-700' },
    { label: 'Agent Matches', value: matchesCount, icon: Sparkles, color: 'text-purple-600' },
    { label: 'Interviews', value: statusCounts.interview, icon: TrendingUp, color: 'text-yellow-600' },
    { label: 'Offers', value: statusCounts.offer, icon: Clock, color: 'text-green-600' },
  ]

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Track your job search progress</p>
        </div>
      </div>

      {!hasAgentProfile && (
        <Link href="/profiles" className="block mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 hover:bg-green-100 transition-colors">
          <p className="font-semibold text-green-900">Start here: upload all your resumes</p>
          <p className="text-sm text-green-800 mt-0.5">
            Every version you have, for every kind of role. Bamboo builds your profile from them, then your AI agent finds jobs and emails you matches with a tailored resume.
          </p>
        </Link>
      )}

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

      {/* Weekly Activity Chart */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Weekly Activity</CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">Applications submitted this week</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-700">
                {appsByDay.reduce((sum, d) => sum + d.count, 0)}
              </p>
              <p className="text-xs text-gray-400">this week</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-28">
            {appsByDay.map(({ day, label, count }) => {
              const isToday = day === today.toISOString().split('T')[0]
              const height = count === 0 ? 4 : Math.max(12, Math.round((count / maxCount) * 100))
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                  {count > 0 && (
                    <span className="text-xs font-semibold text-gray-700">{count}</span>
                  )}
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      isToday
                        ? count > 0 ? 'bg-green-600' : 'bg-green-200'
                        : count > 0 ? 'bg-green-400' : 'bg-gray-100'
                    }`}
                    style={{ height: `${height}px` }}
                  />
                  <span className={`text-xs ${isToday ? 'font-semibold text-green-700' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
          {applications.length === 0 && (
            <p className="text-center text-sm text-gray-400 mt-4">
              Start applying to see your activity here. Early applicants get more responses!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Application flow diagram */}
      {applications.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Application Pipeline</CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">How your applications are progressing</p>
          </CardHeader>
          <CardContent className="pt-2">
            <ApplicationFlowDiagram
              total={applications.length}
              interview={statusCounts.interview}
              offer={statusCounts.offer}
              rejected={statusCounts.rejected}
              noResponse={statusCounts.applied + statusCounts.saved}
            />
            <div className="flex gap-4 flex-wrap mt-4 pt-4 border-t border-gray-100">
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
