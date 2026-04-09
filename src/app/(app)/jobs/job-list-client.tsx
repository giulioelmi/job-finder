'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Building2, Clock, ExternalLink, Eye, Trash2, CheckCircle, Users } from 'lucide-react'
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
  contactCompanies?: string[]
}

export function JobListClient({ jobs, userId, appliedJobIds: initialViewed, contactCompanies = [] }: JobListClientProps) {
  const supabase = createClient()
  const [viewed, setViewed] = useState<Set<string>>(initialViewed)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [markedApplied, setMarkedApplied] = useState<Set<string>>(new Set())
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  function hasNetworkingContact(company: string | null): boolean {
    if (!company || contactCompanies.length === 0) return false
    const lower = company.toLowerCase()
    return contactCompanies.some(c => lower.includes(c) || c.includes(lower))
  }

  const filteredJobs = jobs.filter(j => !dismissedIds.has(j.id))
  const visibleJobs = filteredJobs.slice(0, visibleCount)
  const hasMore = visibleCount < filteredJobs.length

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredJobs.length))
  }, [filteredJobs.length])

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

  function handleViewJob(job: Job, e: React.MouseEvent) {
    e.stopPropagation()
    setViewed(prev => new Set(prev).add(job.id))
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
      {visibleJobs.map((job) => {
        const isViewed = viewed.has(job.id)
        const isApplied = markedApplied.has(job.id)
        const timestamp = job.posted_at ?? job.found_at
        const isNetworkingContact = hasNetworkingContact(job.company)

        return (
          <Card
            key={job.id}
            className="hover:shadow-md transition-shadow"
          >
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-base truncate">{job.title}</h3>
                    {isNetworkingContact && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 flex-shrink-0">
                        <Users className="w-3 h-3" />
                        Contact
                      </span>
                    )}
                  </div>
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
                        : 'bg-green-700 text-white hover:bg-green-800'
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
          </Card>
        )
      })}
      {hasMore && <div ref={sentinelRef} className="h-8" />}
    </div>
  )
}
