'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getStatusColor } from '@/lib/utils'
import { Application, ApplicationStatus } from '@/lib/types'
import { ExternalLink, Building2, MapPin, ChevronDown, Briefcase, Plus, X, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const STATUSES: ApplicationStatus[] = ['viewed', 'applied', 'interview', 'offer', 'rejected', 'saved']

interface ApplicationsClientProps {
  applications: Application[]
  userId: string
}

export function ApplicationsClient({ applications: initial, userId }: ApplicationsClientProps) {
  const supabase = createClient()
  const [applications, setApplications] = useState(initial)
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'all'>('all')
  const [showAddModal, setShowAddModal] = useState(false)

  async function updateStatus(appId: string, status: ApplicationStatus) {
    await supabase.from('applications').update({ status }).eq('id', appId)
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status, updated_at: new Date().toISOString() } : a))
  }

  async function updateNotes(appId: string, notes: string) {
    await supabase.from('applications').update({ notes }).eq('id', appId)
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, notes, updated_at: new Date().toISOString() } : a))
  }

  async function deleteApplication(appId: string) {
    await supabase.from('applications').delete().eq('id', appId).eq('user_id', userId)
    setApplications(prev => prev.filter(a => a.id !== appId))
  }

  async function handleAddManual(data: {
    title: string; company: string; location: string; url: string; status: ApplicationStatus
  }): Promise<string | null> {
    const res = await fetch('/api/applications/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (json.application) {
      setApplications(prev => [json.application, ...prev])
      setShowAddModal(false)
      return null
    }
    return json.error ?? 'Something went wrong. Please try again.'
  }

  const filtered = filterStatus === 'all'
    ? applications
    : applications.filter(a => a.status === filterStatus)

  return (
    <div>
      {/* Filter tabs + Add button */}
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
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
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Job
        </button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No applications</h3>
            <p className="text-gray-500 text-sm">
              Track applications from the{' '}
              <a href="/jobs" className="text-blue-600 hover:underline">Recent Jobs</a> page, or add one manually.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => {
            const job = app.jobs as { title: string; company: string; location: string; url: string } | null
            const lastActivity = app.updated_at ?? app.applied_at
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
                              Last activity {formatDistanceToNow(new Date(lastActivity), { addSuffix: true })}
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
                          <button
                            onClick={() => deleteApplication(app.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete application"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

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

      {showAddModal && (
        <AddJobModal onClose={() => setShowAddModal(false)} onAdd={handleAddManual} />
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

function AddJobModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (data: { title: string; company: string; location: string; url: string; status: ApplicationStatus }) => Promise<string | null>
}) {
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<ApplicationStatus>('applied')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    const err = await onAdd({ title: title.trim(), company: company.trim(), location: location.trim(), url: url.trim(), status })
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Job Manually</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Product Manager Intern"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Google"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Remote"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as ApplicationStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              {(['applied', 'interview', 'offer', 'rejected', 'saved'] as ApplicationStatus[]).map(s => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving || !title.trim()} className="flex-1">
              {saving ? 'Saving...' : 'Add Application'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
