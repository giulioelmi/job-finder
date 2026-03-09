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

interface Notification {
  id: string
  notified_at: string
  jobs: Job | null
}

interface JobListClientProps {
  jobs: Notification[]
  userId: string
  appliedJobIds: Set<string>
}

export function JobListClient({ jobs, userId, appliedJobIds: initialViewed }: JobListClientProps) {
  const supabase = createClient()
  const [viewed, setViewed] = useState<Set<string>>(initialViewed)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [markedApplied, setMarkedApplied] = useState<Set<string>>(new Set())
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const notifications = jobs.filter(n => !deletedIds.has(n.id))
  const visibleNotifications = notifications.slice(0, visibleCount)
  const hasMore = visibleCount < notifications.length

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + ITEMS_PER_PAGE, notifications.length))
  }, [notifications.length])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

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

  async function handleDelete(notificationId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await supabase
      .from('job_notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId)
    setDeletedIds(prev => new Set(prev).add(notificationId))
  }

  return (
    <div className="space-y-3">
      {visibleNotifications.map(notif => {
        const job = notif.jobs
        if (!job) return null
        const isViewed = viewed.has(job.id)
        const isApplied = markedApplied.has(job.id)
        const timestamp = job.posted_at ?? job.found_at

        return (
          <div
            key={notif.id}
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
                    onClick={(e) => handleDelete(notif.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove job"
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
