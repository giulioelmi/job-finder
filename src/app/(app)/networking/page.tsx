import { createClient } from '@/lib/supabase/server'
import { isInternshipTitle } from '@/lib/job-utils'
import { NetworkingClient } from './networking-client'
import { Job, NetworkingContact } from '@/lib/types'

export default async function NetworkingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch contacts, ordered so overdue ones surface first
  const { data: contacts } = await supabase
    .from('networking_contacts')
    .select('*')
    .eq('user_id', user!.id)
    .order('next_followup_at', { ascending: true, nullsFirst: false })

  // Fetch user settings for job filtering
  const { data: settings } = await supabase
    .from('user_settings')
    .select('categories, job_types')
    .eq('user_id', user!.id)
    .single()

  const userKeywords: string[] = ((settings?.categories ?? []) as string[]).map((k: string) => k.toLowerCase())
  const userJobTypes: string[] = (settings?.job_types as string[] | null) ?? ['internship', 'fulltime']

  // Get unique contact companies (lowercase)
  const contactCompanies = [...new Set(
    ((contacts ?? []) as NetworkingContact[])
      .map(c => c.company?.toLowerCase().trim())
      .filter(Boolean) as string[]
  )]

  // Fetch recent jobs from contact companies (last 7 days)
  const contactJobsByCompany: Record<string, Job[]> = {}

  if (contactCompanies.length > 0) {
    const sevenDaysCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const companyFilter = contactCompanies.map(c => `company.ilike.%${c}%`).join(',')

    const { data: jobsData } = await supabase
      .from('jobs')
      .select('id, external_id, title, company, location, url, found_at, posted_at')
      .or(companyFilter)
      .gte('found_at', sevenDaysCutoff)
      .order('found_at', { ascending: false })
      .limit(200)

    // Apply user's keyword + job type filters
    const filteredJobs = ((jobsData ?? []) as Job[]).filter(job => {
      const titleLower = (job.title ?? '').toLowerCase()
      if (userKeywords.length > 0 && !userKeywords.some(kw => titleLower.includes(kw))) return false
      const isIntern = isInternshipTitle(job.title ?? '')
      const wantIntern = userJobTypes.includes('internship')
      const wantFull = userJobTypes.includes('fulltime')
      if (wantIntern && !wantFull && !isIntern) return false
      if (wantFull && !wantIntern && isIntern) return false
      return true
    })

    // Group by matching contact company key
    for (const job of filteredJobs) {
      const jobCompanyLower = job.company?.toLowerCase() ?? ''
      const matchKey = contactCompanies.find(c => jobCompanyLower.includes(c) || c.includes(jobCompanyLower))
      if (matchKey) {
        if (!contactJobsByCompany[matchKey]) contactJobsByCompany[matchKey] = []
        contactJobsByCompany[matchKey].push(job)
      }
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <NetworkingClient
        contacts={(contacts ?? []) as NetworkingContact[]}
        contactJobsByCompany={contactJobsByCompany}
        userId={user!.id}
      />
    </div>
  )
}
