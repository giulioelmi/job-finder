export const JOB_CATEGORIES = [
  { id: 'data-scientist',   label: 'Data Scientist',    keywords: ['data scientist'] },
  { id: 'data-engineer',    label: 'Data Engineer',     keywords: ['data engineer'] },
  { id: 'ml-ai-engineer',   label: 'ML / AI Engineer',  keywords: ['machine learning engineer', 'AI engineer'] },
  { id: 'bi-engineer',      label: 'BI Engineer',       keywords: ['business intelligence engineer', 'BI developer'] },
  { id: 'data-analyst',     label: 'Data Analyst',      keywords: ['data analyst'] },
  { id: 'business-analyst', label: 'Business Analyst',  keywords: ['business analyst'] },
  { id: 'product-manager',  label: 'Product Manager',   keywords: ['product manager'] },
  { id: 'product-analyst',  label: 'Product Analyst',   keywords: ['product analyst'] },
] as const

export type CategoryId = (typeof JOB_CATEGORIES)[number]['id']

export const JOB_TYPES = [
  { id: 'internship', label: 'Internship', linkedinCode: 'I' },
  { id: 'fulltime',   label: 'Full-time',  linkedinCode: 'F' },
] as const

export type JobTypeId = (typeof JOB_TYPES)[number]['id']
