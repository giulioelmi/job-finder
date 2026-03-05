'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { JOB_TITLE_SUGGESTIONS, JOB_TYPES, JobTypeId } from '@/lib/categories'
import { UserSettings } from '@/lib/types'
import { X, Search } from 'lucide-react'

interface SettingsFormProps {
  userId: string
  userEmail: string
  initialSettings: UserSettings | null
}

const DEFAULT_JOB_TITLES: string[] = ['Data Scientist', 'Data Analyst']
const DEFAULT_JOB_TYPES: JobTypeId[] = ['internship', 'fulltime']

export function SettingsForm({ userId, userEmail, initialSettings }: SettingsFormProps) {
  const supabase = createClient()
  const [jobTitles, setJobTitles] = useState<string[]>(
    initialSettings?.categories?.length ? initialSettings.categories : DEFAULT_JOB_TITLES
  )
  const [jobTypes, setJobTypes] = useState<JobTypeId[]>(
    initialSettings?.job_types ?? DEFAULT_JOB_TYPES
  )
  const [location, setLocation] = useState(initialSettings?.location ?? '')
  const [emailNotifications, setEmailNotifications] = useState(initialSettings?.email_notifications ?? true)
  const [notificationEmail, setNotificationEmail] = useState(initialSettings?.notification_email ?? userEmail)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredSuggestions = JOB_TITLE_SUGGESTIONS.filter(title =>
    title.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !jobTitles.includes(title)
  ).slice(0, 8)

  const showCustomOption =
    searchQuery.trim().length > 0 &&
    !JOB_TITLE_SUGGESTIONS.some(t => t.toLowerCase() === searchQuery.trim().toLowerCase()) &&
    !jobTitles.includes(searchQuery.trim())

  function addTitle(title: string) {
    const trimmed = title.trim()
    if (trimmed && !jobTitles.includes(trimmed)) {
      setJobTitles(prev => [...prev, trimmed])
    }
    setSearchQuery('')
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  function removeTitle(title: string) {
    setJobTitles(prev => prev.filter(t => t !== title))
  }

  function toggleJobType(id: JobTypeId) {
    setJobTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    setSaving(true)
    await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          categories: jobTitles,
          job_types: jobTypes,
          location,
          email_notifications: emailNotifications,
          notification_email: notificationEmail || null,
        },
        { onConflict: 'user_id' }
      )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Job Titles */}
      <Card>
        <CardHeader>
          <CardTitle>Job Titles</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Search for job titles you want to track. The scraper will search LinkedIn for each title.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selected titles */}
          {jobTitles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {jobTitles.map(title => (
                <span
                  key={title}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-sm font-medium rounded-full"
                >
                  {title}
                  <button
                    onClick={() => removeTitle(title)}
                    className="text-blue-400 hover:text-blue-700 transition-colors"
                    aria-label={`Remove ${title}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    // Add first suggestion or custom
                    if (filteredSuggestions.length > 0) {
                      addTitle(filteredSuggestions[0])
                    } else {
                      addTitle(searchQuery.trim())
                    }
                  } else if (e.key === 'Escape') {
                    setShowDropdown(false)
                  }
                }}
                placeholder="Search job titles, e.g. Data Analyst..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {showDropdown && (filteredSuggestions.length > 0 || showCustomOption) && (
              <div
                ref={dropdownRef}
                className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
              >
                {filteredSuggestions.map(title => (
                  <button
                    key={title}
                    onMouseDown={e => { e.preventDefault(); addTitle(title) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                  >
                    {title}
                  </button>
                ))}
                {showCustomOption && (
                  <button
                    onMouseDown={e => { e.preventDefault(); addTitle(searchQuery.trim()) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-100"
                  >
                    Add &ldquo;{searchQuery.trim()}&rdquo;
                  </button>
                )}
              </div>
            )}
          </div>

          {jobTitles.length === 0 && (
            <p className="text-sm text-amber-600">Add at least one job title to start tracking.</p>
          )}
        </CardContent>
      </Card>

      {/* Job Types */}
      <Card>
        <CardHeader>
          <CardTitle>Job Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {JOB_TYPES.map(jt => {
              const checked = jobTypes.includes(jt.id)
              return (
                <label
                  key={jt.id}
                  className={`flex items-center gap-3 px-5 py-3 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleJobType(jt.id)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium">{jt.label}</span>
                </label>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Only show jobs matching this location. Leave empty for all locations.
          </p>
        </CardHeader>
        <CardContent>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. United States, New York, Remote"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={e => setEmailNotifications(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700">Send email notifications for new jobs</span>
          </label>
          {emailNotifications && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notification email</label>
              <input
                type="email"
                value={notificationEmail}
                onChange={e => setNotificationEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Each job title is refreshed automatically every ~40 minutes. You&apos;ll only be notified of new jobs.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || jobTitles.length === 0 || jobTypes.length === 0} size="lg">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        {jobTitles.length === 0 && (
          <span className="text-sm text-red-500">Add at least one job title.</span>
        )}
        {jobTitles.length > 0 && jobTypes.length === 0 && (
          <span className="text-sm text-red-500">Select at least one job type.</span>
        )}
      </div>
    </div>
  )
}
