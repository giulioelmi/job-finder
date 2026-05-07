'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import type { AutofillProfile } from '@/lib/types'

export function ProfilesClient({ initialProfiles }: { initialProfiles: AutofillProfile[] }) {
  const router = useRouter()
  const [profiles, setProfiles] = useState(initialProfiles)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Delete this profile?')) return
    setDeletingId(id)
    const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setProfiles(prev => prev.filter(p => p.id !== id))
    }
    setDeletingId(null)
  }

  if (profiles.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="mb-4">No profiles yet.</p>
        <Link href="/profiles/new"><Button>Create your first profile</Button></Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {profiles.map(profile => (
        <Card key={profile.id}>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-semibold text-gray-900">{profile.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {[profile.first_name, profile.last_name].filter(Boolean).join(' ')}
                {profile.email ? ` · ${profile.email}` : ''}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {profile.work_experience?.length ?? 0} jobs · {profile.education?.length ?? 0} education · {profile.skills?.length ?? 0} skills
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/profiles/${profile.id}`}>
                <Button variant="secondary" size="sm"><Pencil className="w-4 h-4" /></Button>
              </Link>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(profile.id)}
                disabled={deletingId === profile.id}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
