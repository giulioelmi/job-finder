'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { JOB_TITLE_SUGGESTIONS, COMPANY_SUGGESTIONS, JOB_TYPES, EXPERIENCE_LEVELS, JobTypeId, ExperienceLevelOptionId } from '@/lib/categories'
import { UserSettings } from '@/lib/types'
import { X, Search, Globe, Building2, Layers } from 'lucide-react'

interface SettingsFormProps {
  userId: string
  userEmail: string
  initialSettings: UserSettings | null
}

const DEFAULT_JOB_TITLES: string[] = ['Data Scientist', 'Data Analyst']
const DEFAULT_JOB_TYPES: JobTypeId[] = ['internship', 'fulltime']
const DEFAULT_EXPERIENCE_LEVELS: ExperienceLevelOptionId[] = ['entry', 'mid', 'senior']

export function SettingsForm({ userId, userEmail, initialSettings }: SettingsFormProps) {
  const supabase = createClient()

  const [searchAllCompanies, setSearchAllCompanies] = useState<boolean>(
    initialSettings?.search_all_companies ?? false
  )
  const [companies, setCompanies] = useState<string[]>(
    initialSettings?.companies?.length ? initialSettings.companies : []
  )
  const [jobTitles, setJobTitles] = useState<string[]>(
    initialSettings?.categories ?? DEFAULT_JOB_TITLES
  )
  const [jobTypes, setJobTypes] = useState<JobTypeId[]>(
    (initialSettings?.job_types?.length
      ? (initialSettings.job_types as JobTypeId[])
      : DEFAULT_JOB_TYPES)
  )
  const [experienceLevels, setExperienceLevels] = useState<ExperienceLevelOptionId[]>(
    (initialSettings?.experience_levels?.length
      ? (initialSettings.experience_levels as ExperienceLevelOptionId[])
      : DEFAULT_EXPERIENCE_LEVELS)
  )
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

  // Company search state (Greenhouse)
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

  function toggleExperienceLevel(id: ExperienceLevelOptionId) {
    setExperienceLevels(prev =>
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
          experience_levels: experienceLevels,
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
      // Backfill notifications from existing DB jobs in background
      fetch('/api/backfill', { method: 'POST' }).catch(() => null)
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
                ? 'border-green-600 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              searchAllCompanies ? 'border-green-600' : 'border-gray-400'
            }`}>
              {searchAllCompanies && <div className="w-2 h-2 rounded-full bg-green-600" />}
            </div>
            <Globe className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className={`text-sm font-medium ${searchAllCompanies ? 'text-green-800' : 'text-gray-700'}`}>
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
                ? 'border-green-600 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              !searchAllCompanies ? 'border-green-600' : 'border-gray-400'
            }`}>
              {!searchAllCompanies && <div className="w-2 h-2 rounded-full bg-green-600" />}
            </div>
            <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className={`text-sm font-medium ${!searchAllCompanies ? 'text-green-800' : 'text-gray-700'}`}>
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
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
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
                      ? 'border-green-600 bg-green-50 text-green-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleJobType(jt.id)}
                    className="w-4 h-4 text-green-700 rounded"
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
            Choose whether to receive all new jobs or only those matching specific keywords — pick from suggestions or type your own.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* All new jobs option */}
          <button
            type="button"
            onClick={() => setJobTitles([])}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
              jobTitles.length === 0
                ? 'border-green-600 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              jobTitles.length === 0 ? 'border-green-600' : 'border-gray-400'
            }`}>
              {jobTitles.length === 0 && <div className="w-2 h-2 rounded-full bg-green-600" />}
            </div>
            <Layers className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className={`text-sm font-medium ${jobTitles.length === 0 ? 'text-green-800' : 'text-gray-700'}`}>
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
                ? 'border-green-600 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              jobTitles.length > 0 ? 'border-green-600' : 'border-gray-400'
            }`}>
              {jobTitles.length > 0 && <div className="w-2 h-2 rounded-full bg-green-600" />}
            </div>
            <Search className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className={`text-sm font-medium ${jobTitles.length > 0 ? 'text-green-800' : 'text-gray-700'}`}>
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-800 text-sm font-medium rounded-full"
                  >
                    {title}
                    <button
                      onClick={() => setJobTitles(prev => prev.filter(t => t !== title))}
                      className="text-green-400 hover:text-green-700 transition-colors"
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
                        addTitle(titleQuery.trim())
                      } else if (e.key === 'Escape') setShowTitleDropdown(false)
                    }}
                    placeholder="Type a keyword or search suggestions, e.g. engineer, analyst..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
                  />
                </div>
                {showTitleDropdown && titleQuery.trim().length > 0 && (filteredTitles.length > 0 || !jobTitles.includes(titleQuery.trim())) && (
                  <div
                    ref={titleDropdownRef}
                    className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                  >
                    {!jobTitles.includes(titleQuery.trim()) && (
                      <button
                        onMouseDown={e => { e.preventDefault(); addTitle(titleQuery.trim()) }}
                        className="w-full text-left px-4 py-2.5 text-sm text-green-700 font-medium hover:bg-green-50 transition-colors"
                      >
                        Add &ldquo;{titleQuery.trim()}&rdquo;
                      </button>
                    )}
                    {filteredTitles.length > 0 && (
                      <div className={!jobTitles.includes(titleQuery.trim()) ? 'border-t border-gray-100' : ''}>
                        {filteredTitles.map(title => (
                          <button
                            key={title}
                            onMouseDown={e => { e.preventDefault(); addTitle(title) }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors"
                          >
                            {title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Experience</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Filters by seniority inferred from the job title.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            {EXPERIENCE_LEVELS.map(level => {
              const checked = experienceLevels.includes(level.id)
              return (
                <label
                  key={level.id}
                  className={`flex items-center gap-3 px-5 py-3 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? 'border-green-600 bg-green-50 text-green-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleExperienceLevel(level.id)}
                    className="w-4 h-4 text-green-700 rounded"
                  />
                  <span className="text-sm font-medium">{level.label}</span>
                </label>
              )
            })}
          </div>
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
              className="w-4 h-4 text-green-700 rounded"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Companies are checked every 5 minutes for jobs posted in the last hour. You&apos;ll only be notified of new jobs.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !canSave || jobTypes.length === 0 || experienceLevels.length === 0} size="lg">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        {saveError && <span className="text-sm text-red-500">{saveError}</span>}
        {!canSave && (
          <span className="text-sm text-red-500">Add at least one company or enable &ldquo;All companies&rdquo;.</span>
        )}
        {canSave && jobTypes.length === 0 && (
          <span className="text-sm text-red-500">Select at least one job type.</span>
        )}
        {canSave && jobTypes.length > 0 && experienceLevels.length === 0 && (
          <span className="text-sm text-red-500">Select at least one experience level.</span>
        )}
      </div>
    </div>
  )
}
