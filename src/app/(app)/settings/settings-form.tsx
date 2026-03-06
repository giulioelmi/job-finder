'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { JOB_TITLE_SUGGESTIONS, COMPANY_SUGGESTIONS, JOB_TYPES, JobTypeId } from '@/lib/categories'
import { UserSettings } from '@/lib/types'
import { X, Search, Globe, Building2, Layers } from 'lucide-react'

interface SettingsFormProps {
  userId: string
  userEmail: string
  initialSettings: UserSettings | null
}

const DEFAULT_JOB_TITLES: string[] = ['Data Scientist', 'Data Analyst']
const DEFAULT_JOB_TYPES: JobTypeId[] = ['internship', 'fulltime']

export function SettingsForm({ userId, userEmail, initialSettings }: SettingsFormProps) {
  const supabase = createClient()

  const [searchAllCompanies, setSearchAllCompanies] = useState<boolean>(
    initialSettings?.search_all_companies ?? false
  )
  const [companies, setCompanies] = useState<string[]>(
    initialSettings?.companies?.length ? initialSettings.companies : []
  )
  const [jobTitles, setJobTitles] = useState<string[]>(
    initialSettings?.categories?.length ? initialSettings.categories : DEFAULT_JOB_TITLES
  )
  const [jobTypes, setJobTypes] = useState<JobTypeId[]>(
    (initialSettings?.job_types as JobTypeId[] | undefined)?.length
      ? (initialSettings!.job_types as JobTypeId[])
      : DEFAULT_JOB_TYPES
  )
  const [location, setLocation] = useState(initialSettings?.location ?? '')
  const [emailNotifications, setEmailNotifications] = useState(initialSettings?.email_notifications ?? true)
  const [notificationEmail, setNotificationEmail] = useState(initialSettings?.notification_email ?? userEmail)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Job title search state
  const [titleQuery, setTitleQuery] = useState('')
  const [showTitleDropdown, setShowTitleDropdown] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const titleDropdownRef = useRef<HTMLDivElement>(null)

  // Company search state
  const [companyQuery, setCompanyQuery] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const companyInputRef = useRef<HTMLInputElement>(null)
  const companyDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        titleDropdownRef.current && !titleDropdownRef.current.contains(e.target as Node) &&
        titleInputRef.current && !titleInputRef.current.contains(e.target as Node)
      ) setShowTitleDropdown(false)
      if (
        companyDropdownRef.current && !companyDropdownRef.current.contains(e.target as Node) &&
        companyInputRef.current && !companyInputRef.current.contains(e.target as Node)
      ) setShowCompanyDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredTitles = JOB_TITLE_SUGGESTIONS.filter(t =>
    t.toLowerCase().includes(titleQuery.toLowerCase()) && !jobTitles.includes(t)
  ).slice(0, 8)

  const showCustomTitle =
    titleQuery.trim().length > 0 &&
    !JOB_TITLE_SUGGESTIONS.some(t => t.toLowerCase() === titleQuery.trim().toLowerCase()) &&
    !jobTitles.includes(titleQuery.trim())

  const filteredCompanies = COMPANY_SUGGESTIONS.filter(c =>
    c.toLowerCase().includes(companyQuery.toLowerCase()) && !companies.includes(c)
  ).slice(0, 8)

  const showCustomCompany =
    companyQuery.trim().length > 0 &&
    !COMPANY_SUGGESTIONS.some(c => c.toLowerCase() === companyQuery.trim().toLowerCase()) &&
    !companies.includes(companyQuery.trim().toLowerCase())

  function addTitle(title: string) {
    const t = title.trim()
    if (t && !jobTitles.includes(t)) setJobTitles(prev => [...prev, t])
    setTitleQuery('')
    setShowTitleDropdown(false)
    titleInputRef.current?.focus()
  }

  function addCompany(slug: string) {
    const s = slug.trim().toLowerCase()
    if (s && !companies.includes(s)) setCompanies(prev => [...prev, s])
    setCompanyQuery('')
    setShowCompanyDropdown(false)
    companyInputRef.current?.focus()
  }

  function toggleJobType(id: JobTypeId) {
    setJobTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  const canSave = searchAllCompanies || companies.length > 0

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          search_all_companies: searchAllCompanies,
          companies,
          categories: jobTitles,
          job_types: jobTypes,
          location,
          email_notifications: emailNotifications,
          notification_email: notificationEmail || null,
        },
        { onConflict: 'user_id' }
      )
    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div className="space-y-6">
      {/* Company scope */}
      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Choose whether to search all companies on Greenhouse or only specific ones.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* All companies option */}
          <button
            type="button"
            onClick={() => setSearchAllCompanies(true)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
              searchAllCompanies
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              searchAllCompanies ? 'border-blue-500' : 'border-gray-400'
            }`}>
              {searchAllCompanies && <div className="w-2 h-2 rounded-full bg-blue-500" />}
            </div>
            <Globe className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className={`text-sm font-medium ${searchAllCompanies ? 'text-blue-800' : 'text-gray-700'}`}>
                All companies
              </p>
              <p className="text-xs text-gray-400">Search all Greenhouse job boards we track</p>
            </div>
          </button>

          {/* Specific companies option */}
          <button
            type="button"
            onClick={() => setSearchAllCompanies(false)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
              !searchAllCompanies
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              !searchAllCompanies ? 'border-blue-500' : 'border-gray-400'
            }`}>
              {!searchAllCompanies && <div className="w-2 h-2 rounded-full bg-blue-500" />}
            </div>
            <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className={`text-sm font-medium ${!searchAllCompanies ? 'text-blue-800' : 'text-gray-700'}`}>
                Specific companies
              </p>
              <p className="text-xs text-gray-400">Choose which company boards to monitor</p>
            </div>
          </button>

          {/* Company picker (shown only in specific mode) */}
          {!searchAllCompanies && (
            <div className="pt-1 space-y-3">
              {companies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {companies.map(slug => (
                    <span
                      key={slug}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-800 text-sm font-medium rounded-full"
                    >
                      {slug}
                      <button
                        onClick={() => setCompanies(prev => prev.filter(c => c !== slug))}
                        className="text-green-400 hover:text-green-700 transition-colors"
                        aria-label={`Remove ${slug}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    ref={companyInputRef}
                    type="text"
                    value={companyQuery}
                    onChange={e => { setCompanyQuery(e.target.value); setShowCompanyDropdown(true) }}
                    onFocus={() => setShowCompanyDropdown(true)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && companyQuery.trim()) {
                        if (filteredCompanies.length > 0) addCompany(filteredCompanies[0])
                        else addCompany(companyQuery.trim())
                      } else if (e.key === 'Escape') setShowCompanyDropdown(false)
                    }}
                    placeholder="e.g. airbnb, stripe, notion..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                {showCompanyDropdown && (filteredCompanies.length > 0 || showCustomCompany) && (
                  <div
                    ref={companyDropdownRef}
                    className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                  >
                    {filteredCompanies.map(slug => (
                      <button
                        key={slug}
                        onMouseDown={e => { e.preventDefault(); addCompany(slug) }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors"
                      >
                        {slug}
                      </button>
                    ))}
                    {showCustomCompany && (
                      <button
                        onMouseDown={e => { e.preventDefault(); addCompany(companyQuery.trim()) }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-100"
                      >
                        Add &ldquo;{companyQuery.trim().toLowerCase()}&rdquo;
                      </button>
                    )}
                  </div>
                )}
              </div>

              {companies.length === 0 && (
                <p className="text-sm text-amber-600">Add at least one company to start tracking.</p>
              )}

              <p className="text-xs text-gray-400">
                Find a company&apos;s slug at{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded">boards.greenhouse.io/&#123;slug&#125;</code>
              </p>
            </div>
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

      {/* Job Title Keywords */}
      <Card>
        <CardHeader>
          <CardTitle>Job Title Keywords</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Choose whether to receive all new jobs or only those matching specific title keywords.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* All new jobs option */}
          <button
            type="button"
            onClick={() => setJobTitles([])}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
              jobTitles.length === 0
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              jobTitles.length === 0 ? 'border-blue-500' : 'border-gray-400'
            }`}>
              {jobTitles.length === 0 && <div className="w-2 h-2 rounded-full bg-blue-500" />}
            </div>
            <Layers className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className={`text-sm font-medium ${jobTitles.length === 0 ? 'text-blue-800' : 'text-gray-700'}`}>
                All new jobs
              </p>
              <p className="text-xs text-gray-400">Receive every new job, regardless of title</p>
            </div>
          </button>

          {/* Specific keywords option */}
          <button
            type="button"
            onClick={() => { if (jobTitles.length === 0) setJobTitles(DEFAULT_JOB_TITLES) }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
              jobTitles.length > 0
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              jobTitles.length > 0 ? 'border-blue-500' : 'border-gray-400'
            }`}>
              {jobTitles.length > 0 && <div className="w-2 h-2 rounded-full bg-blue-500" />}
            </div>
            <Search className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className={`text-sm font-medium ${jobTitles.length > 0 ? 'text-blue-800' : 'text-gray-700'}`}>
                Specific keywords
              </p>
              <p className="text-xs text-gray-400">Only jobs whose title contains one of your keywords</p>
            </div>
          </button>

          {/* Keyword picker (shown only in specific mode) */}
          {jobTitles.length > 0 && (
            <div className="pt-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                {jobTitles.map(title => (
                  <span
                    key={title}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-sm font-medium rounded-full"
                  >
                    {title}
                    <button
                      onClick={() => setJobTitles(prev => prev.filter(t => t !== title))}
                      className="text-blue-400 hover:text-blue-700 transition-colors"
                      aria-label={`Remove ${title}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={titleQuery}
                    onChange={e => { setTitleQuery(e.target.value); setShowTitleDropdown(true) }}
                    onFocus={() => setShowTitleDropdown(true)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && titleQuery.trim()) {
                        if (filteredTitles.length > 0) addTitle(filteredTitles[0])
                        else addTitle(titleQuery.trim())
                      } else if (e.key === 'Escape') setShowTitleDropdown(false)
                    }}
                    placeholder="Search job titles, e.g. Data Analyst..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                {showTitleDropdown && (filteredTitles.length > 0 || showCustomTitle) && (
                  <div
                    ref={titleDropdownRef}
                    className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                  >
                    {filteredTitles.map(title => (
                      <button
                        key={title}
                        onMouseDown={e => { e.preventDefault(); addTitle(title) }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                      >
                        {title}
                      </button>
                    ))}
                    {showCustomTitle && (
                      <button
                        onMouseDown={e => { e.preventDefault(); addTitle(titleQuery.trim()) }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-100"
                      >
                        Add &ldquo;{titleQuery.trim()}&rdquo;
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
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
                Companies are checked every 5 minutes for jobs posted in the last hour. You&apos;ll only be notified of new jobs.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !canSave || jobTypes.length === 0} size="lg">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        {saveError && <span className="text-sm text-red-500">{saveError}</span>}
        {!canSave && (
          <span className="text-sm text-red-500">Select a company search option.</span>
        )}
        {canSave && jobTypes.length === 0 && (
          <span className="text-sm text-red-500">Select at least one job type.</span>
        )}
      </div>
    </div>
  )
}
