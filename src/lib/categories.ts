// Fallback company boards, used only when the greenhouse_slugs / ashby_slugs tables are empty.
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

// Full list of companies known to use Ashby, searched when "all companies" mode is on.
// Slugs match api.ashbyhq.com/posting-api/job-board/{slug}
// Slugs that return 404 are skipped automatically at runtime — safe to add candidates.
export const ALL_ASHBY_COMPANIES: string[] = [
  // Populated via the ashby_slugs table in Supabase.
  // Add slugs by uploading a CSV with: node scripts/import-slugs.mjs --table ashby_slugs <path-to-csv>
]

// Subset shown as autocomplete suggestions in "specific Ashby companies" mode
