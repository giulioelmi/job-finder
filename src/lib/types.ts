export interface UserSettings {
  id: string
  user_id: string
  search_all_companies: boolean
  companies: string[]        // Greenhouse slugs
  ashby_companies: string[]  // Ashby slugs
  categories: string[]
  job_types: string[]
  experience_levels: string[]
  location: string
  email_notifications: boolean
  notification_email: string | null
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  external_id: string
  title: string
  company: string | null
  location: string | null
  url: string
  posted_at: string | null
  found_at: string
  description: string | null
}

export interface JobNotification {
  id: string
  user_id: string
  job_id: string
  notified_at: string
  jobs?: Job
}

export interface Application {
  id: string
  user_id: string
  job_id: string | null  // null for manually-added entries
  status: 'applied' | 'interview' | 'offer' | 'rejected' | 'saved'
  notes: string
  // inline fields set when job_id is null
  title: string | null
  company: string | null
  location: string | null
  url: string | null
  applied_at: string
  created_at: string
  updated_at: string
  jobs?: Job
}

export type ApplicationStatus = Application['status']

export interface NetworkingContact {
  id: string
  user_id: string
  name: string
  company: string | null
  role: string | null
  email: string | null
  linkedin_url: string | null
  notes: string | null
  last_contacted_at: string | null
  next_followup_at: string | null
  created_at: string
}
