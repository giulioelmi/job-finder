'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CardContent } from '@/components/ui/card'
import { MapPin, Building2, Clock, ExternalLink, Eye, Trash2, CheckCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const ITEMS_PER_PAGE = 10

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
  jobs: Job[]
  userId: string
  appliedJobIds: Set<string>
}

export function JobListClient({ jobs, userId, appliedJobIds: initialViewed }: JobListClientProps) {
  const supabase = createClient()
  const [viewed, setViewed] = useState<Set<string>>(initialViewed)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [markedApplied, setMarkedApplied] = useState<Set<string>>(new Set())
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  
  async function handleViewJob(job: Job, e: React.MouseEvent) {
    e.stopPropagation()
    if (!viewed.has(job.id)) {
      await supabase.from('applications').upsert(
        { user_id: userId, job_id: job.id, status: 'viewed' },
        { onConflict: 'user_id,job_id', ignoreDuplicates: true }
      )
      setViewed(prev => new Set(prev).add(job.id))
    }
    window.open(job.url, '_blank', 'noopener,noreferrer')
  }

  async function handleMarkApplied(job: Job, e: React.MouseEvent) {
    e.stopPropagation()
    if (markedApplied.has(job.id)) return
    await supabase.from('applications').upsert(
      { user_id: userId, job_id: job.id, status: 'applied' },
      { onConflict: 'user_id,job_id', ignoreDuplicates: false }
    )
    setMarkedApplied(prev => new Set(prev).add(job.id))
    setViewed(prev => new Set(prev).add(job.id))
  }

  function handleDismiss(jobId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDismissedIds(prev => new Set(prev).add(jobId))
  }

  return (
    <div className="space-y-3">

        const isViewed = viewed.has(job.id)
        const isApplied = markedApplied.has(job.id)
        const timestamp = job.posted_at ?? job.found_at

        return (
          <div
            key={job.id}
            className="rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow"
          >
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => handleViewJob(job, e)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isViewed
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isViewed ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        Viewed
                      </>
                    ) : (
                      <>
                        View Job
                        <ExternalLink className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                  {isViewed && (
                    <button
                      onClick={(e) => handleMarkApplied(job, e)}
                      disabled={isApplied}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isApplied
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Applied
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDismiss(job.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Dismiss job"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </div>
        )
      })}
      {hasMore && <div ref={sentinelRef} className="h-8" />}
    </div>
  )
}
