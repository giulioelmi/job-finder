'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { JOB_CATEGORIES, JOB_TYPES, CategoryId, JobTypeId } from '@/lib/categories'
import { UserSettings } from '@/lib/types'

interface SettingsFormProps {
  userId: string
  userEmail: string
  initialSettings: UserSettings | null
}

const DEFAULT_CATEGORIES: CategoryId[] = ['data-scientist', 'data-analyst']
const DEFAULT_JOB_TYPES: JobTypeId[] = ['internship', 'fulltime']

export function SettingsForm({ userId, userEmail, initialSettings }: SettingsFormProps) {
  const supabase = createClient()
  const [categories, setCategories] = useState<CategoryId[]>(
    initialSettings?.categories ?? DEFAULT_CATEGORIES
  )
  const [jobTypes, setJobTypes] = useState<JobTypeId[]>(
    initialSettings?.job_types ?? DEFAULT_JOB_TYPES
  )
  const [location, setLocation] = useState(initialSettings?.location ?? '')
  const [emailNotifications, setEmailNotifications] = useState(initialSettings?.email_notifications ?? true)
  const [notificationEmail, setNotificationEmail] = useState(initialSettings?.notification_email ?? userEmail)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggleCategory(id: CategoryId) {
    setCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
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
          categories,
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
      {/* Job Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Job Categories</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Select the roles you want to track. The scraper covers all selected categories automatically.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {JOB_CATEGORIES.map(cat => {
              const checked = categories.includes(cat.id)
              return (
                <label
                  key={cat.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(cat.id)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium">{cat.label}</span>
                </label>
              )
            })}
          </div>
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
                Each category is refreshed automatically every ~40 minutes. You&apos;ll only be notified of new jobs.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || categories.length === 0 || jobTypes.length === 0} size="lg">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        {categories.length === 0 && (
          <span className="text-sm text-red-500">Select at least one category.</span>
        )}
        {categories.length > 0 && jobTypes.length === 0 && (
          <span className="text-sm text-red-500">Select at least one job type.</span>
        )}
      </div>
    </div>
  )
}
