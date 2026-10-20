'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getStatusColor } from '@/lib/utils'
import { Application, ApplicationStatus } from '@/lib/types'
import { ExternalLink, MapPin, ChevronDown, Briefcase, Plus, X, Trash2, Pencil, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const STATUSES: ApplicationStatus[] = ['applied', 'interview', 'offer', 'rejected']

type SortOption = 'newest' | 'interview' | 'updated'

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest first',
  interview: 'Interview first',
  updated: 'Recently updated',
}

function sortApplications(apps: Application[], sort: SortOption): Application[] {
  const sorted = [...apps]
  if (sort === 'newest') {
    return sorted.sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
  }
  if (sort === 'interview') {
    return sorted.sort((a, b) => {
      if (a.status === 'interview' && b.status !== 'interview') return -1
      if (b.status === 'interview' && a.status !== 'interview') return 1
      return new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
    })
  }
  if (sort === 'updated') {
    return sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }
  return sorted
}

interface ApplicationsClientProps {
  applications: Application[]
  userId: string
}

export function ApplicationsClient({ applications: initial, userId }: ApplicationsClientProps) {
  const supabase = createClient()
  const [applications, setApplications] = useState(initial)
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingApplication, setEditingApplication] = useState<Application | null>(null)

  async function updateStatus(appId: string, status: ApplicationStatus) {
    await supabase.from('applications').update({ status }).eq('id', appId)
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status, updated_at: new Date().toISOString() } : a))
  }

  async function updateNotes(appId: string, notes: string) {
    await supabase.from('applications').update({ notes }).eq('id', appId)
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, notes, updated_at: new Date().toISOString() } : a))
  }

  async function deleteApplication(appId: string) {
    if (!window.confirm('Delete this application? This cannot be undone.')) return
    await supabase.from('applications').delete().eq('id', appId).eq('user_id', userId)
    setApplications(prev => prev.filter(a => a.id !== appId))
  }

  async function updateApplicationDetails(appId: string, data: {
    title: string
    company: string
    location: string
    url: string
    status: ApplicationStatus
  }): Promise<string | null> {
    const payload = {
      title: data.title.trim(),
      company: data.company.trim() || null,
      location: data.location.trim() || null,
      url: data.url.trim() || null,
      status: data.status,
    }
    const { error } = await supabase.from('applications').update(payload).eq('id', appId).eq('user_id', userId)
    if (error) return error.message
    setApplications(prev =>
      prev.map(a => a.id === appId ? { ...a, ...payload, updated_at: new Date().toISOString() } : a)
    )
    setEditingApplication(null)
    return null
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

  const q = searchQuery.trim().toLowerCase()
  const filtered = sortApplications(
    applications.filter(a => {
      if (filterStatus !== 'all' && a.status !== filterStatus) return false
      if (!q) return true
      const job = a.jobs as { title: string; company: string | null; location: string | null } | null
      const title    = (a.title    ?? job?.title    ?? '').toLowerCase()
      const company  = (a.company  ?? job?.company  ?? '').toLowerCase()
      const location = (a.location ?? job?.location ?? '').toLowerCase()
      return title.includes(q) || company.includes(q) || location.includes(q)
    }),
    sortBy
  )

  return (
    <div>
      {/* Filter tabs + Add button */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'all' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-green-50'
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
                  filterStatus === s ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-green-50'
                }`}
              >
                {s} ({count})
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Job
        </button>
      </div>

      {/* Search + Sort row */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by title, company, or location…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600 bg-white"
          />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600 bg-white text-gray-700 cursor-pointer"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
              <option key={opt} value={opt}>{SORT_LABELS[opt]}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            {q || filterStatus !== 'all' ? (
              <>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No results</h3>
                <p className="text-gray-500 text-sm">Try a different search or filter.</p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No applications</h3>
                <p className="text-gray-500 text-sm">
                  Your <a href="/career-profile" className="text-green-700 hover:underline">AI agent</a> emails you matches. Add an application manually to start tracking it.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => {
            const job = app.jobs as { title: string; company: string | null; location: string | null; url: string; posted_at: string | null; found_at: string } | null
            const title    = app.title    ?? job?.title    ?? 'Unknown'
            const company  = app.company  ?? job?.company  ?? null
            const location = app.location ?? job?.location ?? null
            const url      = app.url      ?? job?.url      ?? null
            const dateSource = job?.posted_at ?? job?.found_at ?? app.applied_at
            return (
              <Card key={app.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Company */}
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                        {company ?? '—'}
                      </p>
                      {/* Title */}
                      <h3 className="font-semibold text-gray-900 leading-snug">{title}</h3>
                      {/* Meta row */}
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span>{formatDistanceToNow(new Date(dateSource), { addSuffix: true })}</span>
                        {location && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5 max-w-[180px] truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{location}</span>
                            </span>
                          </>
                        )}
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <NotesEditor
                        notes={app.notes}
                        onSave={notes => updateNotes(app.id, notes)}
                      />
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditingApplication(app)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit application details"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
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
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {showAddModal && (
        <AddJobModal onClose={() => setShowAddModal(false)} onAdd={handleAddManual} />
      )}

      {editingApplication && (
        <EditJobModal
          application={editingApplication}
          onClose={() => setEditingApplication(null)}
          onSave={data => updateApplicationDetails(editingApplication.id, data)}
        />
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
        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Google"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Remote"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as ApplicationStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm bg-white"
            >
              {(['applied', 'interview', 'offer', 'rejected'] as ApplicationStatus[]).map(s => (
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

function EditJobModal({
  application,
  onClose,
  onSave,
}: {
  application: Application
  onClose: () => void
  onSave: (data: { title: string; company: string; location: string; url: string; status: ApplicationStatus }) => Promise<string | null>
}) {
  const job = application.jobs as { title: string; company: string | null; location: string | null; url: string } | null
  const [title, setTitle] = useState(application.title ?? job?.title ?? '')
  const [company, setCompany] = useState(application.company ?? job?.company ?? '')
  const [location, setLocation] = useState(application.location ?? job?.location ?? '')
  const [url, setUrl] = useState(application.url ?? job?.url ?? '')
  const [status, setStatus] = useState<ApplicationStatus>(application.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    const err = await onSave({ title: title.trim(), company: company.trim(), location: location.trim(), url: url.trim(), status })
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Edit Application</h2>
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
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as ApplicationStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm bg-white"
            >
              {STATUSES.map(s => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving || !title.trim()} className="flex-1">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
