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

// Full list of companies known to use Greenhouse, searched when "all companies" mode is on.
// Slugs match boards.greenhouse.io/{slug}
// Only includes slugs verified to work at boards.greenhouse.io/{slug}
export const ALL_GREENHOUSE_COMPANIES = [
  'airbnb',
  'amplitude',
  'anthropic',
  'asana',
  'brex',
  'cloudflare',
  'coinbase',
  'datadog',
  'databricks',
  'discord',
  'dropbox',
  'duolingo',
  'figma',
  'fivetran',
  'gitlab',
  'gusto',
  'hubspot',
  'intercom',
  'lattice',
  'launchdarkly',
  'lyft',
  'mercury',
  'mixpanel',
  'mongodb',
  'pagerduty',
  'pinterest',
  'reddit',
  'robinhood',
  'stripe',
  'twilio',
  'verkada',
]

// Subset shown as autocomplete suggestions in "specific companies" mode
export const COMPANY_SUGGESTIONS = ALL_GREENHOUSE_COMPANIES
