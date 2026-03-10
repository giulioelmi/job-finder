'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NetworkingContact, Job } from '@/lib/types'
import { formatDistanceToNow, isPast, formatDistanceToNowStrict } from 'date-fns'
import {
  Users, Plus, X, Pencil, Trash2, Building2, Clock,
  ExternalLink, CheckCircle,
} from 'lucide-react'

const FOLLOWUP_DAYS = 14

type ContactFormData = {
  name: string
  company: string | null
  role: string | null
  email: string | null
  linkedin_url: string | null
  notes: string | null
}

interface NetworkingClientProps {
  contacts: NetworkingContact[]
  contactJobsByCompany: Record<string, Job[]>
  userId: string
}

export function NetworkingClient({ contacts: initial, contactJobsByCompany, userId }: NetworkingClientProps) {
  const supabase = createClient()
  const [contacts, setContacts] = useState(initial)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingContact, setEditingContact] = useState<NetworkingContact | null>(null)

  async function handleAdd(data: ContactFormData) {
    const nextFollowup = new Date(Date.now() + FOLLOWUP_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data: result, error } = await supabase
      .from('networking_contacts')
      .insert({ user_id: userId, ...data, next_followup_at: nextFollowup })
      .select()
      .single()
    if (!error && result) {
      setContacts(prev => [result as NetworkingContact, ...prev])
    }
    return error?.message ?? null
  }

  async function handleEdit(id: string, data: ContactFormData) {
    const { error } = await supabase
      .from('networking_contacts')
      .update(data)
      .eq('id', id)
      .eq('user_id', userId)
    if (!error) {
      setContacts(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    }
    return error?.message ?? null
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this contact? This cannot be undone.')) return
    await supabase.from('networking_contacts').delete().eq('id', id).eq('user_id', userId)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  async function handleMarkContacted(id: string) {
    const now = new Date()
    const nextFollowup = new Date(now.getTime() + FOLLOWUP_DAYS * 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('networking_contacts')
      .update({ last_contacted_at: now.toISOString(), next_followup_at: nextFollowup })
      .eq('id', id)
    setContacts(prev => prev.map(c =>
      c.id === id ? { ...c, last_contacted_at: now.toISOString(), next_followup_at: nextFollowup } : c
    ))
  }

  function getContactJobs(contact: NetworkingContact): Job[] {
    if (!contact.company) return []
    const key = contact.company.toLowerCase()
    const result: Job[] = []
    for (const [k, jobs] of Object.entries(contactJobsByCompany)) {
      if (k.includes(key) || key.includes(k)) result.push(...jobs)
    }
    return result
  }

  const overdueCount = contacts.filter(
    c => c.next_followup_at && isPast(new Date(c.next_followup_at))
  ).length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Networking</h1>
          <p className="text-gray-500 mt-1">Track your contacts and follow up every 2 weeks</p>
        </div>
        <div className="flex items-center gap-3">
          {overdueCount > 0 && (
            <Badge className="bg-orange-100 text-orange-700">
              {overdueCount} follow-up{overdueCount !== 1 ? 's' : ''} overdue
            </Badge>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No contacts yet</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              Add people you&apos;re networking with. You&apos;ll get reminded to follow up every 2 weeks, and
              you&apos;ll see new job openings at their companies here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contacts.map(contact => {
            const isOverdue = contact.next_followup_at ? isPast(new Date(contact.next_followup_at)) : false
            const contactJobs = getContactJobs(contact)

            return (
              <Card
                key={contact.id}
                className={isOverdue ? 'border-l-4 border-l-orange-400' : ''}
              >
                <CardContent className="py-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                        {isOverdue && (
                          <Badge className="bg-orange-100 text-orange-700 text-xs">Follow up</Badge>
                        )}
                        {contactJobs.length > 0 && (
                          <Badge className="bg-blue-100 text-blue-700 text-xs">
                            {contactJobs.length} new job{contactJobs.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                        {contact.company && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {contact.company}
                          </span>
                        )}
                        {contact.role && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{contact.role}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 flex-wrap">
                        {contact.next_followup_at && (
                          <span className={`flex items-center gap-1 ${isOverdue ? 'text-orange-500 font-medium' : ''}`}>
                            <Clock className="w-3 h-3" />
                            {isOverdue
                              ? `Overdue by ${formatDistanceToNowStrict(new Date(contact.next_followup_at))}`
                              : `Follow up in ${formatDistanceToNowStrict(new Date(contact.next_followup_at))}`
                            }
                          </span>
                        )}
                        {contact.last_contacted_at && (
                          <span>
                            Last contacted {formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>

                      {contact.notes && (
                        <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">{contact.notes}</p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="text-green-700 hover:underline">
                            {contact.email}
                          </a>
                        )}
                        {contact.linkedin_url && (
                          <a
                            href={contact.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-700 hover:underline flex items-center gap-0.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleMarkContacted(contact.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                        title="Mark as contacted (resets 2-week follow-up timer)"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Contacted
                      </button>
                      <button
                        onClick={() => setEditingContact(contact)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Edit contact"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete contact"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Jobs from this company */}
                  {contactJobs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                        New jobs at {contact.company} (last 7 days)
                      </p>
                      <div className="space-y-2">
                        {contactJobs.slice(0, 5).map(job => (
                          <div key={job.id} className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{job.title}</p>
                              <p className="text-xs text-gray-400">
                                {job.location ? `${job.location} · ` : ''}
                                {formatDistanceToNow(new Date(job.posted_at ?? job.found_at), { addSuffix: true })}
                              </p>
                            </div>
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {showAddModal && (
        <ContactModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAdd}
        />
      )}
      {editingContact && (
        <ContactModal
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onSave={data => handleEdit(editingContact.id, data)}
        />
      )}
    </div>
  )
}

function ContactModal({
  contact,
  onClose,
  onSave,
}: {
  contact?: NetworkingContact
  onClose: () => void
  onSave: (data: ContactFormData) => Promise<string | null>
}) {
  const [name, setName] = useState(contact?.name ?? '')
  const [company, setCompany] = useState(contact?.company ?? '')
  const [role, setRole] = useState(contact?.role ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(contact?.linkedin_url ?? '')
  const [notes, setNotes] = useState(contact?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const err = await onSave({
      name: name.trim(),
      company: company.trim() || null,
      role: role.trim() || null,
      email: email.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {contact ? 'Edit Contact' : 'Add Contact'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jane Smith"
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
            <p className="text-xs text-gray-400 mt-1">
              New jobs from this company will appear below their contact card.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role / Title</label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Senior Engineer"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. jane@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Met at career fair, referred by John, interested in data eng..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm resize-none"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving || !name.trim()} className="flex-1">
              {saving ? 'Saving...' : contact ? 'Save Changes' : 'Add Contact'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
