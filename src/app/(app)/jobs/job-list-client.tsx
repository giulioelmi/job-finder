'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Building2, Clock, ExternalLink, CheckCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Job {
  id: string
  title: string
  company: string | null
  location: string | null
  url: string
  posted_at: string | null
  found_at: string
}

interface JobListClientProps {
  jobs: { notified_at: string; jobs: Job | null }[]
  userId: string
  appliedJobIds: Set<string>
}

export function JobListClient({ jobs, userId, appliedJobIds: initial }: JobListClientProps) {
  const supabase = createClient()
  const [applied, setApplied] = useState<Set<string>>(initial)

  async function handleViewJob(job: Job) {
    if (!applied.has(job.id)) {
      await supabase.from('applications').upsert(
        { user_id: userId, job_id: job.id, status: 'applied' },
        { onConflict: 'user_id,job_id', ignoreDuplicates: true }
      )
      setApplied(prev => new Set(prev).add(job.id))
    }
    window.open(job.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-3">
      {jobs.map((notif, i) => {
        const job = notif.jobs
        if (!job) return null
        const isApplied = applied.has(job.id)
        const timestamp = job.posted_at ?? job.found_at

        return (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-base truncate">{job.title}</h3>
                  <div className="flex items-center flex-wrap gap-3 mt-1.5 text-sm text-gray-500">
                    {job.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {job.company}
                      </span>
                    )}
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {job.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Posted {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleViewJob(job)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isApplied
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isApplied ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Applied
                    </>
                  ) : (
                    <>
                      View Job
                      <ExternalLink className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
