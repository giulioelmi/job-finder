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
  experience_years: number | null
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

export interface EducationEntry {
  school: string
  degree: string
  field_of_study: string
  gpa: string
  start_date: string
  end_date: string
}

export interface WorkExperienceEntry {
  company: string
  title: string
  start_date: string
  end_date: string
  current: boolean
  description: string
}

export interface ProjectEntry {
  name: string
  url: string
  description: string
  technologies: string
}

export interface CustomQAEntry {
  question: string
  answer: string
}

export interface AutofillProfile {
  id: string
  user_id: string
  name: string

  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  street_address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null

  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
  website_url: string | null

  authorized_to_work: boolean | null
  requires_sponsorship: boolean | null
  visa_type: string | null

  desired_salary: number | null
  salary_type: 'hourly' | 'yearly' | null
  willing_to_relocate: boolean | null
  available_start_date: string | null

  gender: string | null
  pronouns: string | null
  ethnicity: string | null
  veteran_status: string | null
  disability_status: string | null

  education: EducationEntry[]
  work_experience: WorkExperienceEntry[]
  projects: ProjectEntry[]
  skills: string[]
  custom_qa: CustomQAEntry[]

  cover_letter_prompt: string | null
  referral_source: string | null
  resume_url: string | null

  created_at: string
  updated_at: string
}
