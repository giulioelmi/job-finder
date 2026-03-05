'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { buildLinkedInUrl } from '@/lib/utils'
import { UserSettings } from '@/lib/types'
import { ExternalLink, X, Plus } from 'lucide-react'

const TIME_PERIOD_OPTIONS = [
  { label: 'Last 30 minutes', value: 1800 },
  { label: 'Last 1 hour', value: 3600 },
  { label: 'Last 24 hours', value: 86400 },
  { label: 'Last week', value: 604800 },
]

interface SettingsFormProps {
  userId: string
  initialSettings: UserSettings | null
}

export function SettingsForm({ userId, initialSettings }: SettingsFormProps) {
  const supabase = createClient()
  const [keywords, setKeywords] = useState<string[]>(
    initialSettings?.keywords ?? ['software engineer intern', 'product manager intern']
  )
  const [newKeyword, setNewKeyword] = useState('')
  const [location, setLocation] = useState(initialSettings?.location ?? '')
  const [timePeriod, setTimePeriod] = useState(initialSettings?.time_period ?? 1800)
  const [emailNotifications, setEmailNotifications] = useState(initialSettings?.email_notifications ?? true)
  const [notificationEmail, setNotificationEmail] = useState(initialSettings?.notification_email ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function addKeyword() {
    const kw = newKeyword.trim()
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
    }
    setNewKeyword('')
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords.filter(k => k !== kw))
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      user_id: userId,
      keywords,
      location,
      time_period: timePeriod,
      email_notifications: emailNotifications,
      notification_email: notificationEmail || null,
    }

    await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const previewUrl = buildLinkedInUrl(keywords, location, timePeriod)

  return (
    <div className="space-y-6">
      {/* Keywords */}
      <Card>
        <CardHeader>
          <CardTitle>Job Keywords</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Add job titles you want to track</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            {keywords.map(kw => (
              <span
                key={kw}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
              >
                {kw}
                <button onClick={() => removeKeyword(kw)} className="hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addKeyword()}
              placeholder="e.g. data analyst intern"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <Button onClick={addKeyword} size="sm" variant="secondary">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Location & Timing */}
      <Card>
        <CardHeader>
          <CardTitle>Search Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. New York, United States"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search window (for scraping)</label>
            <select
              value={timePeriod}
              onChange={e => setTimePeriod(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              {TIME_PERIOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              The scraper runs every 30 min and only notifies you of new jobs since the last run.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Email */}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notification email (leave blank to use account email)
              </label>
              <input
                type="email"
                value={notificationEmail}
                onChange={e => setNotificationEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* LinkedIn URL Preview */}
      <Card>
        <CardHeader>
          <CardTitle>LinkedIn Search Preview</CardTitle>
          <p className="text-sm text-gray-500 mt-1">This is the URL the scraper will use</p>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 break-all font-mono">
            {previewUrl}
          </div>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mt-3"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Test this search on LinkedIn
          </a>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
      </div>
    </div>
  )
}
