'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getStatusColor } from '@/lib/utils'
import { Application, ApplicationStatus } from '@/lib/types'
import { ExternalLink, Building2, MapPin, ChevronDown, Briefcase } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const STATUSES: ApplicationStatus[] = ['applied', 'interview', 'offer', 'rejected', 'saved']

interface ApplicationsClientProps {
  applications: Application[]
  userId: string
}

export function ApplicationsClient({ applications: initial }: ApplicationsClientProps) {
  const supabase = createClient()
  const [applications, setApplications] = useState(initial)
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'all'>('all')

  async function updateStatus(appId: string, status: ApplicationStatus) {
    await supabase.from('applications').update({ status }).eq('id', appId)
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status } : a))
  }

  async function updateNotes(appId: string, notes: string) {
    await supabase.from('applications').update({ notes }).eq('id', appId)
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, notes } : a))
  }

  const filtered = filterStatus === 'all'
    ? applications
    : applications.filter(a => a.status === filterStatus)

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filterStatus === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          All ({applications.length})
        </button>
        {STATUSES.map(s => {
          const count = applications.filter(a => a.status === s).length
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                filterStatus === s ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s} ({count})
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No applications</h3>
            <p className="text-gray-500 text-sm">
              Track applications from the{' '}
              <a href="/jobs" className="text-blue-600 hover:underline">Recent Jobs</a> page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => {
            const job = app.jobs as { title: string; company: string; location: string; url: string } | null
            return (
              <Card key={app.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{job?.title ?? 'Unknown'}</h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            {job?.company && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5" />
                                {job.company}
                              </span>
                            )}
                            {job?.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {job.location}
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              Applied {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {job?.url && (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <div className="relative">
                            <select
                              value={app.status}
                              onChange={e => updateStatus(app.id, e.target.value as ApplicationStatus)}
                              className={`appearance-none pl-2.5 pr-7 py-1 rounded-full text-xs font-medium cursor-pointer border-0 focus:outline-none ${getStatusColor(app.status)}`}
                            >
                              {STATUSES.map(s => (
                                <option key={s} value={s} className="bg-white text-gray-900">{s}</option>
                              ))}
                            </select>
                            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      <NotesEditor
                        notes={app.notes}
                        onSave={notes => updateNotes(app.id, notes)}
                      />
                    </div>
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

function NotesEditor({ notes, onSave }: { notes: string; onSave: (n: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(notes)

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-2 text-xs text-gray-400 hover:text-gray-600 text-left"
      >
        {notes ? notes : '+ Add notes'}
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-1">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={2}
        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        placeholder="Interview notes, follow-up date..."
        autoFocus
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { onSave(value); setEditing(false) }}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => { setValue(notes); setEditing(false) }}>Cancel</Button>
      </div>
    </div>
  )
}
