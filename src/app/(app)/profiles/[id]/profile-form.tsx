'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, Plus } from 'lucide-react'
import type {
  AutofillProfile,
  EducationEntry,
  WorkExperienceEntry,
  ProjectEntry,
  CustomQAEntry,
} from '@/lib/types'

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Genderqueer', 'Two-Spirit', 'Other', 'Prefer not to answer']
const ETHNICITY_OPTIONS = [
  'Hispanic or Latino',
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Two or more races',
  'Decline to self identify',
]
const VETERAN_OPTIONS = [
  'I am not a protected veteran',
  'I identify as one or more classifications of a protected veteran',
  "I don't wish to answer",
]
const DISABILITY_OPTIONS = [
  'Yes, I have a disability (or previously had a disability)',
  'No, I do not have a disability',
  "I don't wish to answer",
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600'
const selectCls = inputCls

interface ProfileFormProps {
  initialProfile?: AutofillProfile | null
}

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const router = useRouter()
  const isEditing = !!initialProfile?.id

  const [name, setName] = useState(initialProfile?.name ?? '')
  const [firstName, setFirstName] = useState(initialProfile?.first_name ?? '')
  const [lastName, setLastName] = useState(initialProfile?.last_name ?? '')
  const [email, setEmail] = useState(initialProfile?.email ?? '')
  const [phone, setPhone] = useState(initialProfile?.phone ?? '')
  const [street, setStreet] = useState(initialProfile?.street_address ?? '')
  const [city, setCity] = useState(initialProfile?.city ?? '')
  const [state, setState] = useState(initialProfile?.state ?? '')
  const [zip, setZip] = useState(initialProfile?.zip_code ?? '')
  const [country, setCountry] = useState(initialProfile?.country ?? '')

  const [linkedin, setLinkedin] = useState(initialProfile?.linkedin_url ?? '')
  const [github, setGithub] = useState(initialProfile?.github_url ?? '')
  const [portfolio, setPortfolio] = useState(initialProfile?.portfolio_url ?? '')
  const [website, setWebsite] = useState(initialProfile?.website_url ?? '')

  const [authorizedToWork, setAuthorizedToWork] = useState<string>(
    initialProfile?.authorized_to_work === true ? 'yes' :
    initialProfile?.authorized_to_work === false ? 'no' : ''
  )
  const [requiresSponsorship, setRequiresSponsorship] = useState<string>(
    initialProfile?.requires_sponsorship === true ? 'yes' :
    initialProfile?.requires_sponsorship === false ? 'no' : ''
  )
  const [visaType, setVisaType] = useState(initialProfile?.visa_type ?? '')
  const [desiredSalary, setDesiredSalary] = useState(initialProfile?.desired_salary?.toString() ?? '')
  const [salaryType, setSalaryType] = useState(initialProfile?.salary_type ?? '')
  const [willingToRelocate, setWillingToRelocate] = useState<string>(
    initialProfile?.willing_to_relocate === true ? 'yes' :
    initialProfile?.willing_to_relocate === false ? 'no' : ''
  )
  const [startDate, setStartDate] = useState(initialProfile?.available_start_date ?? '')

  const [gender, setGender] = useState(initialProfile?.gender ?? '')
  const [pronouns, setPronouns] = useState(initialProfile?.pronouns ?? '')
  const [ethnicity, setEthnicity] = useState(initialProfile?.ethnicity ?? '')
  const [veteranStatus, setVeteranStatus] = useState(initialProfile?.veteran_status ?? '')
  const [disabilityStatus, setDisabilityStatus] = useState(initialProfile?.disability_status ?? '')

  const [education, setEducation] = useState<EducationEntry[]>(initialProfile?.education ?? [])
  const [workExp, setWorkExp] = useState<WorkExperienceEntry[]>(initialProfile?.work_experience ?? [])
  const [projects, setProjects] = useState<ProjectEntry[]>(initialProfile?.projects ?? [])
  const [skills, setSkills] = useState<string[]>(initialProfile?.skills ?? [])
  const [skillInput, setSkillInput] = useState('')
  const [customQA, setCustomQA] = useState<CustomQAEntry[]>(initialProfile?.custom_qa ?? [])
  const [coverLetterPrompt, setCoverLetterPrompt] = useState(initialProfile?.cover_letter_prompt ?? '')
  const [resumeUrl, setResumeUrl] = useState<string | null>(initialProfile?.resume_url ?? null)
  const [resumeFilename, setResumeFilename] = useState<string | null>(
    initialProfile?.resume_url ? (initialProfile.resume_url.split('/').pop() ?? null) : null
  )
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addEducation() {
    setEducation(prev => [...prev, { school: '', degree: '', field_of_study: '', gpa: '', start_date: '', end_date: '' }])
  }
  function updateEducation(i: number, field: keyof EducationEntry, value: string) {
    setEducation(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }
  function removeEducation(i: number) {
    setEducation(prev => prev.filter((_, idx) => idx !== i))
  }

  function addWorkExp() {
    setWorkExp(prev => [...prev, { company: '', title: '', start_date: '', end_date: '', current: false, description: '' }])
  }
  function updateWorkExp(i: number, field: keyof WorkExperienceEntry, value: string | boolean) {
    setWorkExp(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }
  function removeWorkExp(i: number) {
    setWorkExp(prev => prev.filter((_, idx) => idx !== i))
  }

  function addProject() {
    setProjects(prev => [...prev, { name: '', url: '', description: '', technologies: '' }])
  }
  function updateProject(i: number, field: keyof ProjectEntry, value: string) {
    setProjects(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }
  function removeProject(i: number) {
    setProjects(prev => prev.filter((_, idx) => idx !== i))
  }

  function addSkill(skill: string) {
    const s = skill.trim()
    if (s && !skills.includes(s)) setSkills(prev => [...prev, s])
    setSkillInput('')
  }

  function addQA() {
    setCustomQA(prev => [...prev, { question: '', answer: '' }])
  }
  function updateQA(i: number, field: keyof CustomQAEntry, value: string) {
    setCustomQA(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }
  function removeQA(i: number) {
    setCustomQA(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleResumeUpload(file: File) {
    if (!initialProfile?.id) return
    if (file.size > 5 * 1024 * 1024) { setResumeError('File too large (max 5 MB)'); return }
    setResumeUploading(true)
    setResumeError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/profiles/${initialProfile.id}/resume`, { method: 'PUT', body: form })
      if (res.ok) {
        const data = await res.json()
        setResumeUrl(data.resume_url)
        setResumeFilename(file.name)
      } else {
        const data = await res.json().catch(() => ({}))
        setResumeError(data.error ?? 'Upload failed')
      }
    } catch {
      setResumeError('Network error — please check your connection')
    } finally {
      setResumeUploading(false)
    }
  }

  async function handleResumeRemove() {
    if (!initialProfile?.id) return
    setResumeUploading(true)
    setResumeError(null)
    try {
      const res = await fetch(`/api/profiles/${initialProfile.id}/resume`, { method: 'DELETE' })
      if (res.ok) {
        setResumeUrl(null)
        setResumeFilename(null)
      } else {
        setResumeError('Failed to remove resume')
      }
    } catch {
      setResumeError('Network error — please check your connection')
    } finally {
      setResumeUploading(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError('Profile name is required'); return }
    setSaving(true)
    setError(null)

    const payload = {
      name: name.trim(),
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      street_address: street.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      zip_code: zip.trim() || null,
      country: country.trim() || null,
      linkedin_url: linkedin.trim() || null,
      github_url: github.trim() || null,
      portfolio_url: portfolio.trim() || null,
      website_url: website.trim() || null,
      authorized_to_work: authorizedToWork === 'yes' ? true : authorizedToWork === 'no' ? false : null,
      requires_sponsorship: requiresSponsorship === 'yes' ? true : requiresSponsorship === 'no' ? false : null,
      visa_type: visaType.trim() || null,
      desired_salary: desiredSalary ? parseInt(desiredSalary) : null,
      salary_type: (salaryType as 'hourly' | 'yearly') || null,
      willing_to_relocate: willingToRelocate === 'yes' ? true : willingToRelocate === 'no' ? false : null,
      available_start_date: startDate.trim() || null,
      gender: gender || null,
      pronouns: pronouns.trim() || null,
      ethnicity: ethnicity || null,
      veteran_status: veteranStatus || null,
      disability_status: disabilityStatus || null,
      education,
      work_experience: workExp,
      projects,
      skills,
      custom_qa: customQA,
      cover_letter_prompt: coverLetterPrompt.trim() || null,
    }

    const url = isEditing ? `/api/profiles/${initialProfile.id}` : '/api/profiles'
    const method = isEditing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)
    if (res.ok) {
      router.push('/profiles')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to save')
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile name */}
      <Card>
        <CardHeader><CardTitle>Profile Name</CardTitle></CardHeader>
        <CardContent>
          <Field label="Name (e.g. Data Scientist, Business Analyst)">
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Data Scientist" />
          </Field>
        </CardContent>
      </Card>

      {/* Personal info */}
      <Card>
        <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="First name"><input className={inputCls} value={firstName} onChange={e => setFirstName(e.target.value)} /></Field>
          <Field label="Last name"><input className={inputCls} value={lastName} onChange={e => setLastName(e.target.value)} /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Phone"><input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} /></Field>
          <Field label="Street address"><input className={inputCls} value={street} onChange={e => setStreet(e.target.value)} /></Field>
          <Field label="City"><input className={inputCls} value={city} onChange={e => setCity(e.target.value)} /></Field>
          <Field label="State"><input className={inputCls} value={state} onChange={e => setState(e.target.value)} /></Field>
          <Field label="ZIP code"><input className={inputCls} value={zip} onChange={e => setZip(e.target.value)} /></Field>
          <Field label="Country" ><input className={inputCls} value={country} onChange={e => setCountry(e.target.value)} /></Field>
        </CardContent>
      </Card>

      {/* Online presence */}
      <Card>
        <CardHeader><CardTitle>Online Presence</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="LinkedIn URL"><input className={inputCls} value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." /></Field>
          <Field label="GitHub URL"><input className={inputCls} value={github} onChange={e => setGithub(e.target.value)} placeholder="https://github.com/..." /></Field>
          <Field label="Portfolio URL"><input className={inputCls} value={portfolio} onChange={e => setPortfolio(e.target.value)} /></Field>
          <Field label="Website URL"><input className={inputCls} value={website} onChange={e => setWebsite(e.target.value)} /></Field>
        </CardContent>
      </Card>

      {/* Work authorization & compensation */}
      <Card>
        <CardHeader><CardTitle>Work Authorization &amp; Compensation</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Authorized to work in US">
            <select className={selectCls} value={authorizedToWork} onChange={e => setAuthorizedToWork(e.target.value)}>
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Requires visa sponsorship">
            <select className={selectCls} value={requiresSponsorship} onChange={e => setRequiresSponsorship(e.target.value)}>
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Visa type (if applicable)"><input className={inputCls} value={visaType} onChange={e => setVisaType(e.target.value)} placeholder="e.g. OPT, H1B" /></Field>
          <Field label="Desired salary"><input className={inputCls} type="number" value={desiredSalary} onChange={e => setDesiredSalary(e.target.value)} placeholder="e.g. 120000" /></Field>
          <Field label="Salary type">
            <select className={selectCls} value={salaryType} onChange={e => setSalaryType(e.target.value)}>
              <option value="">—</option>
              <option value="yearly">Yearly</option>
              <option value="hourly">Hourly</option>
            </select>
          </Field>
          <Field label="Willing to relocate">
            <select className={selectCls} value={willingToRelocate} onChange={e => setWillingToRelocate(e.target.value)}>
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Available start date"><input className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} placeholder="e.g. 2 weeks notice, immediately" /></Field>
        </CardContent>
      </Card>

      {/* DEI */}
      <Card>
        <CardHeader>
          <CardTitle>DEI</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Leave blank to answer "Prefer not to say" on applications.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Gender">
            <select className={selectCls} value={gender} onChange={e => setGender(e.target.value)}>
              <option value="">—</option>
              {GENDER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Pronouns"><input className={inputCls} value={pronouns} onChange={e => setPronouns(e.target.value)} placeholder="e.g. he/him, she/her" /></Field>
          <Field label="Ethnicity">
            <select className={selectCls} value={ethnicity} onChange={e => setEthnicity(e.target.value)}>
              <option value="">—</option>
              {ETHNICITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Veteran status">
            <select className={selectCls} value={veteranStatus} onChange={e => setVeteranStatus(e.target.value)}>
              <option value="">—</option>
              {VETERAN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Disability status">
            <select className={selectCls} value={disabilityStatus} onChange={e => setDisabilityStatus(e.target.value)}>
              <option value="">—</option>
              {DISABILITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Education</CardTitle>
            <Button variant="secondary" size="sm" onClick={addEducation}><Plus className="w-4 h-4 mr-1" />Add</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {education.map((e, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3 relative">
              <button onClick={() => removeEducation(i)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
              <div className="grid grid-cols-2 gap-3">
                <Field label="School"><input className={inputCls} value={e.school} onChange={ev => updateEducation(i, 'school', ev.target.value)} /></Field>
                <Field label="Degree"><input className={inputCls} value={e.degree} onChange={ev => updateEducation(i, 'degree', ev.target.value)} placeholder="B.S., M.S., Ph.D." /></Field>
                <Field label="Field of study"><input className={inputCls} value={e.field_of_study} onChange={ev => updateEducation(i, 'field_of_study', ev.target.value)} /></Field>
                <Field label="GPA (optional)"><input className={inputCls} value={e.gpa} onChange={ev => updateEducation(i, 'gpa', ev.target.value)} placeholder="3.8" /></Field>
                <Field label="Start date"><input className={inputCls} value={e.start_date} onChange={ev => updateEducation(i, 'start_date', ev.target.value)} placeholder="Aug 2020" /></Field>
                <Field label="End date"><input className={inputCls} value={e.end_date} onChange={ev => updateEducation(i, 'end_date', ev.target.value)} placeholder="May 2024" /></Field>
              </div>
            </div>
          ))}
          {education.length === 0 && <p className="text-sm text-gray-400">No entries yet.</p>}
        </CardContent>
      </Card>

      {/* Work Experience */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Work Experience</CardTitle>
            <Button variant="secondary" size="sm" onClick={addWorkExp}><Plus className="w-4 h-4 mr-1" />Add</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {workExp.map((w, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3 relative">
              <button onClick={() => removeWorkExp(i)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company"><input className={inputCls} value={w.company} onChange={ev => updateWorkExp(i, 'company', ev.target.value)} /></Field>
                <Field label="Title"><input className={inputCls} value={w.title} onChange={ev => updateWorkExp(i, 'title', ev.target.value)} /></Field>
                <Field label="Start date"><input className={inputCls} value={w.start_date} onChange={ev => updateWorkExp(i, 'start_date', ev.target.value)} placeholder="Jan 2023" /></Field>
                <Field label="End date">
                  <input className={inputCls} value={w.end_date} onChange={ev => updateWorkExp(i, 'end_date', ev.target.value)} placeholder="Dec 2024" disabled={w.current} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={w.current} onChange={ev => updateWorkExp(i, 'current', ev.target.checked)} className="w-4 h-4" />
                Currently working here
              </label>
              <Field label="Description (bullet points)">
                <textarea className={inputCls + ' min-h-[80px]'} value={w.description} onChange={ev => updateWorkExp(i, 'description', ev.target.value)} placeholder="• Built X using Y, resulting in Z..." />
              </Field>
            </div>
          ))}
          {workExp.length === 0 && <p className="text-sm text-gray-400">No entries yet.</p>}
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Projects</CardTitle>
            <Button variant="secondary" size="sm" onClick={addProject}><Plus className="w-4 h-4 mr-1" />Add</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.map((p, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3 relative">
              <button onClick={() => removeProject(i)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name"><input className={inputCls} value={p.name} onChange={ev => updateProject(i, 'name', ev.target.value)} /></Field>
                <Field label="URL (optional)"><input className={inputCls} value={p.url} onChange={ev => updateProject(i, 'url', ev.target.value)} /></Field>
                <Field label="Technologies"><input className={inputCls} value={p.technologies} onChange={ev => updateProject(i, 'technologies', ev.target.value)} placeholder="Python, React, PostgreSQL" /></Field>
              </div>
              <Field label="Description">
                <textarea className={inputCls + ' min-h-[60px]'} value={p.description} onChange={ev => updateProject(i, 'description', ev.target.value)} />
              </Field>
            </div>
          ))}
          {projects.length === 0 && <p className="text-sm text-gray-400">No entries yet.</p>}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader><CardTitle>Skills</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {skills.map(s => (
                <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-800 text-sm font-medium rounded-full">
                  {s}
                  <button onClick={() => setSkills(prev => prev.filter(x => x !== s))} className="text-green-400 hover:text-green-700"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) } }}
              placeholder="Type a skill and press Enter"
            />
            <Button variant="secondary" onClick={() => addSkill(skillInput)} disabled={!skillInput.trim()}>Add</Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Q&A */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Custom Q&amp;A</CardTitle>
            <Button variant="secondary" size="sm" onClick={addQA}><Plus className="w-4 h-4 mr-1" />Add</Button>
          </div>
          <p className="text-sm text-gray-500 mt-1">Pre-set answers to recurring questions not covered above.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {customQA.map((qa, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <input className={inputCls} value={qa.question} onChange={ev => updateQA(i, 'question', ev.target.value)} placeholder="Question" />
                <input className={inputCls} value={qa.answer} onChange={ev => updateQA(i, 'answer', ev.target.value)} placeholder="Answer" />
              </div>
              <button onClick={() => removeQA(i)} className="mt-2 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
          ))}
          {customQA.length === 0 && <p className="text-sm text-gray-400">No entries yet.</p>}
        </CardContent>
      </Card>

      {/* Resume */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Resume</h3>
          <p className="text-sm text-gray-500 mt-1">Uploaded file will be automatically attached to job applications.</p>
        </div>
        <div className="px-6 py-4">
          {!isEditing ? (
            <p className="text-sm text-gray-400">Save this profile first, then come back to upload a resume.</p>
          ) : resumeUrl ? (
            <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
              <span className="text-2xl">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{resumeFilename}</p>
              </div>
              <button
                onClick={handleResumeRemove}
                disabled={resumeUploading}
                className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
              >
                {resumeUploading ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ) : (
            <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 transition-colors ${resumeUploading ? 'opacity-50 cursor-not-allowed pointer-events-none border-gray-300' : 'cursor-pointer border-gray-300 hover:border-green-600 hover:bg-green-50'}`}>
              <span className="text-3xl mb-2">📄</span>
              <span className="text-sm font-medium text-gray-700 mb-1">{resumeUploading ? 'Uploading…' : 'Upload your resume'}</span>
              <span className="text-xs text-gray-400 mb-4">PDF, DOC, or DOCX · max 5 MB</span>
              <span className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">Choose file</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                disabled={resumeUploading}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleResumeUpload(file)
                  e.target.value = ''
                }}
              />
            </label>
          )}
          {resumeError && <p className="text-sm text-red-500 mt-2">{resumeError}</p>}
        </div>
      </div>

      {/* Cover letter prompt */}
      <Card>
        <CardHeader>
          <CardTitle>Cover Letter Instructions</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Custom instructions for the AI when generating your cover letter.</p>
        </CardHeader>
        <CardContent>
          <textarea
            className={inputCls + ' min-h-[100px]'}
            value={coverLetterPrompt}
            onChange={e => setCoverLetterPrompt(e.target.value)}
            placeholder="e.g. Write in a confident but concise tone, max 3 paragraphs, emphasize my ML skills and open-source projects."
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Create profile'}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => router.push('/profiles')}>Cancel</Button>
      </div>
    </div>
  )
}
