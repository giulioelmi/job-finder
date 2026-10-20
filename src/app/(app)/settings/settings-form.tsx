'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserSettings } from '@/lib/types'

interface SettingsFormProps {
  userId: string
  userEmail: string
  initialSettings: UserSettings | null
}

export function SettingsForm({ userId, userEmail, initialSettings }: SettingsFormProps) {
  const supabase = createClient()
  const [emailNotifications, setEmailNotifications] = useState(initialSettings?.email_notifications ?? true)
  const [notificationEmail, setNotificationEmail] = useState(initialSettings?.notification_email ?? userEmail)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: userId, email_notifications: emailNotifications, notification_email: notificationEmail || null },
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
      <Card>
        <CardHeader>
          <CardTitle>Agent Match Emails</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={e => setEmailNotifications(e.target.checked)}
              className="w-4 h-4 text-green-700 rounded"
            />
            <span className="text-sm text-gray-700">Email me the jobs my AI agent finds, with a tailored resume</span>
          </label>
          {emailNotifications && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Send them to</label>
              <input
                type="email"
                value={notificationEmail}
                onChange={e => setNotificationEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Your agent runs on a schedule and only emails you jobs you haven&apos;t seen. Manage the agent on the AI Agent page.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        {saveError && <span className="text-sm text-red-500">{saveError}</span>}
      </div>
    </div>
  )
}
