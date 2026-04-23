// Suggested job title keywords for filtering Greenhouse results
export const JOB_TITLE_SUGGESTIONS = [
  'Data Scientist',
  'Data Engineer',
  'Machine Learning Engineer',
  'AI Engineer',
  'ML Engineer',
  'Data Analyst',
  'Business Analyst',
  'Business Intelligence Engineer',
  'BI Developer',
  'BI Analyst',
  'Product Manager',
  'Product Analyst',
  'Analytics Engineer',
  'Quantitative Analyst',
  'Research Scientist',
  'Applied Scientist',
  'Data Science Manager',
  'Software Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Full Stack Engineer',
  'DevOps Engineer',
  'Cloud Engineer',
  'Site Reliability Engineer',
  'Platform Engineer',
  'Solutions Architect',
]

// Job type options (mirrors the internship/fulltime toggle in the UI)
export const JOB_TYPES = [
  { id: 'internship', label: 'Internship' },
  { id: 'fulltime',   label: 'Full-time' },
] as const

export type JobTypeId = (typeof JOB_TYPES)[number]['id']

export const EXPERIENCE_LEVELS = [
  { id: 'entry', label: 'Entry / New Grad' },
  { id: 'mid', label: 'Mid-level' },
  { id: 'senior', label: 'Senior+' },
] as const

export type ExperienceLevelOptionId = (typeof EXPERIENCE_LEVELS)[number]['id']

// Full list of companies known to use Greenhouse, searched when "all companies" mode is on.
// Slugs match boards.greenhouse.io/{slug}
// Best-effort list of US tech companies that use Greenhouse.
// Slugs that return 404 are skipped automatically at runtime — safe to add candidates.
export const ALL_GREENHOUSE_COMPANIES = [
  'airtable',
  'airbnb',
  'amplitude',
  'anthropic',
  'asana',
  'box',
  'brex',
  'checkr',
  'chime',
  'cloudflare',
  'coinbase',
  'confluent',
  'contentful',
  'coreweave',
  'datadog',
  'databricks',
  'deel',
  'descript',
  'discord',
  'dropbox',
  'duolingo',
  'faire',
  'figma',
  'fivetran',
  'flexport',
  'gem',
  'gitlab',
  'gusto',
  'heap',
  'hubspot',
  'intercom',
  'ironclad',
  'lattice',
  'launchdarkly',
  'lob',
  'lyft',
  'marqeta',
  'masterclass',
  'mercury',
  'mixpanel',
  'moderntreasury',
  'mongodb',
  'navan',
  'openai',
  'pagerduty',
  'persona',
  'pinterest',
  'productboard',
  'reddit',
  'robinhood',
  'sentry',
  'snyk',
  'stripe',
  'substack',
  'twilio',
  'vanta',
  'verkada',
  'webflow',
  'workos',
  'zapier',
]

// Subset shown as autocomplete suggestions in "specific companies" mode
export const COMPANY_SUGGESTIONS = ALL_GREENHOUSE_COMPANIES

// Full list of companies known to use Ashby, searched when "all companies" mode is on.
// Slugs match api.ashbyhq.com/posting-api/job-board/{slug}
// Slugs that return 404 are skipped automatically at runtime — safe to add candidates.
export const ALL_ASHBY_COMPANIES: string[] = [
  // Populated via the ashby_slugs table in Supabase.
  // Add slugs by uploading a CSV with: node scripts/import-slugs.mjs --table ashby_slugs <path-to-csv>
]

// Subset shown as autocomplete suggestions in "specific Ashby companies" mode
export const ASHBY_COMPANY_SUGGESTIONS = ALL_ASHBY_COMPANIES
