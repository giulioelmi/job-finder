export interface UserSettings {
  id: string
  user_id: string
  companies: string[]
  categories: string[]
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
  job_id: string
  status: 'applied' | 'interview' | 'offer' | 'rejected' | 'saved'
  notes: string
  applied_at: string
  created_at: string
  updated_at: string
  jobs?: Job
}

export type ApplicationStatus = Application['status']
