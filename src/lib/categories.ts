export const JOB_TYPES = [
  { id: 'internship', label: 'Internship', linkedinCode: 'I' },
  { id: 'fulltime',   label: 'Full-time',  linkedinCode: 'F' },
] as const

export type JobTypeId = (typeof JOB_TYPES)[number]['id']

// Suggested job titles for the settings search autocomplete
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
