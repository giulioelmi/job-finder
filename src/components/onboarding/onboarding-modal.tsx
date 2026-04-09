'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { JOB_TITLE_SUGGESTIONS, COMPANY_SUGGESTIONS, JOB_TYPES, JobTypeId } from '@/lib/categories'
import { X, Search, Globe, Building2, Layers, Bell, Briefcase, Users, ChevronRight } from 'lucide-react'

interface OnboardingModalProps {
  userId: string
  userEmail: string
}

const DEFAULT_JOB_TITLES: string[] = ['Data Scientist', 'Data Analyst']
const DEFAULT_JOB_TYPES: JobTypeId[] = ['internship', 'fulltime']

export function OnboardingModal({ userId, userEmail }: OnboardingModalProps) {
  const supabase = createClient()
  const [slide, setSlide] = useState(0)
  const [done, setDone] = useState(false)

  // Settings state
  const [searchAllCompanies, setSearchAllCompanies] = useState<boolean>(false)
  const [companies, setCompanies] = useState<string[]>([])
  const [jobTitles, setJobTitles] = useState<string[]>(DEFAULT_JOB_TITLES)
  const [jobTypes, setJobTypes] = useState<JobTypeId[]>(DEFAULT_JOB_TYPES)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [notificationEmail, setNotificationEmail] = useState(userEmail)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Job title search
  const [titleQuery, setTitleQuery] = useState('')
  const [showTitleDropdown, setShowTitleDropdown] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const titleDropdownRef = useRef<HTMLDivElement>(null)

  // Company search
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

  const canSave = searchAllCompanies || companies.length > 0

  async function handleSaveAndNext() {
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
          email_notifications: emailNotifications,
          notification_email: notificationEmail || null,
        },
        { onConflict: 'user_id' }
      )
    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      fetch('/api/backfill', { method: 'POST' }).catch(() => null)
      setSlide(1)
    }
  }

  if (done) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-gray-900">
              {slide === 0 ? 'Set up your job filters' : 'Welcome to Bamboo!'}
            </h2>
            <span className="text-sm text-gray-400">Step {slide + 1} of 2</span>
          </div>
          <p className="text-sm text-gray-500">
            {slide === 0
              ? 'Tell us what you\'re looking for so we can surface the right jobs.'
              : 'Here\'s a quick look at what you can do.'}
          </p>
          {/* Progress dots */}
          <div className="flex gap-2 mt-3">
            {[0, 1].map(i => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === slide ? 'w-8 bg-green-600' : i < slide ? 'w-4 bg-green-300' : 'w-4 bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Slide content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {slide === 0 && (
            <>
              {/* Companies */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-800">Companies</label>
                <p className="text-xs text-gray-500">Search all Greenhouse companies or pick specific ones.</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setSearchAllCompanies(true)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                      searchAllCompanies ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${searchAllCompanies ? 'border-green-600' : 'border-gray-400'}`}>
                      {searchAllCompanies && <div className="w-2 h-2 rounded-full bg-green-600" />}
                    </div>
                    <Globe className="w-4 h-4 text-gray-500 shrink-0" />
                    <div>
                      <p className={`text-sm font-medium ${searchAllCompanies ? 'text-green-800' : 'text-gray-700'}`}>All companies</p>
                      <p className="text-xs text-gray-400">Search all Greenhouse job boards we track</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSearchAllCompanies(false)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                      !searchAllCompanies ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${!searchAllCompanies ? 'border-green-600' : 'border-gray-400'}`}>
                      {!searchAllCompanies && <div className="w-2 h-2 rounded-full bg-green-600" />}
                    </div>
                    <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
                    <div>
                      <p className={`text-sm font-medium ${!searchAllCompanies ? 'text-green-800' : 'text-gray-700'}`}>Specific companies</p>
                      <p className="text-xs text-gray-400">Choose which company boards to monitor</p>
                    </div>
                  </button>

                  {!searchAllCompanies && (
                    <div className="pt-1 space-y-2">
                      {companies.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {companies.map(slug => (
                            <span key={slug} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-800 text-sm font-medium rounded-full">
                              {slug}
                              <button onClick={() => setCompanies(prev => prev.filter(c => c !== slug))} className="text-green-400 hover:text-green-700 transition-colors" aria-label={`Remove ${slug}`}>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
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
                        {showCompanyDropdown && (filteredCompanies.length > 0 || showCustomCompany) && (
                          <div ref={companyDropdownRef} className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                            {filteredCompanies.map(slug => (
                              <button key={slug} onMouseDown={e => { e.preventDefault(); addCompany(slug) }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors">
                                {slug}
                              </button>
                            ))}
                            {showCustomCompany && (
                              <button onMouseDown={e => { e.preventDefault(); addCompany(companyQuery.trim()) }} className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-100">
                                Add &ldquo;{companyQuery.trim().toLowerCase()}&rdquo;
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {companies.length === 0 && (
                        <p className="text-xs text-amber-600">Add at least one company to continue.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Job Types */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-800">Job Types</label>
                <div className="flex gap-3">
                  {JOB_TYPES.map(jt => {
                    const checked = jobTypes.includes(jt.id)
                    return (
                      <label key={jt.id} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleJobType(jt.id)} className="w-4 h-4 text-green-700 rounded" />
                        <span className="text-sm font-medium">{jt.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Job Title Keywords */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-800">Job Title Keywords</label>
                <p className="text-xs text-gray-500">Pick from suggestions or type your own. Leave empty to see all jobs.</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setJobTitles([])}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${jobTitles.length === 0 ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${jobTitles.length === 0 ? 'border-green-600' : 'border-gray-400'}`}>
                      {jobTitles.length === 0 && <div className="w-2 h-2 rounded-full bg-green-600" />}
                    </div>
                    <Layers className="w-4 h-4 text-gray-500 shrink-0" />
                    <div>
                      <p className={`text-sm font-medium ${jobTitles.length === 0 ? 'text-green-800' : 'text-gray-700'}`}>All new jobs</p>
                      <p className="text-xs text-gray-400">Receive every new job, regardless of title</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { if (jobTitles.length === 0) setJobTitles(DEFAULT_JOB_TITLES) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${jobTitles.length > 0 ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${jobTitles.length > 0 ? 'border-green-600' : 'border-gray-400'}`}>
                      {jobTitles.length > 0 && <div className="w-2 h-2 rounded-full bg-green-600" />}
                    </div>
                    <Search className="w-4 h-4 text-gray-500 shrink-0" />
                    <div>
                      <p className={`text-sm font-medium ${jobTitles.length > 0 ? 'text-green-800' : 'text-gray-700'}`}>Specific keywords</p>
                      <p className="text-xs text-gray-400">Only jobs whose title contains one of your keywords</p>
                    </div>
                  </button>

                  {jobTitles.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {jobTitles.map(title => (
                          <span key={title} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-800 text-sm font-medium rounded-full">
                            {title}
                            <button onClick={() => setJobTitles(prev => prev.filter(t => t !== title))} className="text-green-400 hover:text-green-700 transition-colors" aria-label={`Remove ${title}`}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          ref={titleInputRef}
                          type="text"
                          value={titleQuery}
                          onChange={e => { setTitleQuery(e.target.value); setShowTitleDropdown(true) }}
                          onFocus={() => setShowTitleDropdown(true)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && titleQuery.trim()) addTitle(titleQuery.trim())
                            else if (e.key === 'Escape') setShowTitleDropdown(false)
                          }}
                          placeholder="e.g. engineer, analyst..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
                        />
                        {showTitleDropdown && titleQuery.trim().length > 0 && (filteredTitles.length > 0 || !jobTitles.includes(titleQuery.trim())) && (
                          <div ref={titleDropdownRef} className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                            {!jobTitles.includes(titleQuery.trim()) && (
                              <button onMouseDown={e => { e.preventDefault(); addTitle(titleQuery.trim()) }} className="w-full text-left px-4 py-2.5 text-sm text-green-700 font-medium hover:bg-green-50 transition-colors">
                                Add &ldquo;{titleQuery.trim()}&rdquo;
                              </button>
                            )}
                            {filteredTitles.length > 0 && (
                              <div className={!jobTitles.includes(titleQuery.trim()) ? 'border-t border-gray-100' : ''}>
                                {filteredTitles.map(title => (
                                  <button key={title} onMouseDown={e => { e.preventDefault(); addTitle(title) }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors">
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
                </div>
              </div>

              {/* Email Notifications */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-800">Email Notifications</label>
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
                  <input
                    type="email"
                    value={notificationEmail}
                    onChange={e => setNotificationEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
                  />
                )}
              </div>
            </>
          )}

          {slide === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Your filters are saved. Here&apos;s what you can do in Bamboo:</p>

              <div className="rounded-xl border border-green-100 bg-green-50 p-4 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Recent Jobs</p>
                  <p className="text-sm text-gray-600">
                    Browse jobs matching your filters, posted in the last 7 days. Use the time filter to narrow down to the last hour, 12 hours, or day. Mark jobs as applied or dismiss ones you&apos;re not interested in.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Applications</p>
                  <p className="text-sm text-gray-600">
                    Track your job applications through the pipeline — from applied to interview, offer, or rejected. Add manual entries for jobs you found elsewhere.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Networking</p>
                  <p className="text-sm text-gray-600">
                    Manage your professional contacts and set follow-up reminders. When a contact&apos;s company posts a matching job, you&apos;ll see a &ldquo;Contact&rdquo; badge on that listing.
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-400 pt-1">
                You can adjust your filters at any time from the Settings page.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex items-center justify-between">
          {slide === 0 ? (
            <>
              <div className="text-sm">
                {saveError && <span className="text-red-500">{saveError}</span>}
                {!canSave && <span className="text-amber-600 text-xs">Add a company or select &ldquo;All companies&rdquo; to continue.</span>}
                {canSave && jobTypes.length === 0 && <span className="text-amber-600 text-xs">Select at least one job type.</span>}
              </div>
              <button
                onClick={handleSaveAndNext}
                disabled={saving || !canSave || jobTypes.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save & Next'}
                {!saving && <ChevronRight className="w-4 h-4" />}
              </button>
            </>
          ) : (
            <>
              <span />
              <button
                onClick={() => setDone(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800 transition-colors"
              >
                Get Started
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
