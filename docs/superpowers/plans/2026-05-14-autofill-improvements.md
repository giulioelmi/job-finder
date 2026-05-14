# Autofill Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five improvements to the Bamboo Chrome extension autofill feature: "how did you hear about us" answers, custom dropdown support, stay-open across multi-page flows, automatic resume attachment, and cover letters generated from the original job description page.

**Architecture:** Hybrid — the LLM handles semantic field mapping (including the new `referral_source` field); custom dropdown interaction and resume file injection are deterministic scripts in `content.js`; multi-page state persists via a new `autofill_session` key in `chrome.storage.local`.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Storage), DeepSeek API, Chrome Extension MV3, Vanilla JS (content/background scripts)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260514_autofill_improvements.sql` | Create | Add `referral_source`, `resume_url` columns |
| `src/lib/types.ts` | Modify | Add two fields to `AutofillProfile` |
| `src/app/api/extension/autofill/route.ts` | Modify | `serializeProfile` + system prompt for referral_source |
| `src/app/api/profiles/[id]/resume/route.ts` | Create | PUT/GET/DELETE for Supabase Storage resume files |
| `src/app/(app)/profiles/[id]/profile-form.tsx` | Modify | `referral_source` input + resume upload UI |
| `chrome-extension/content.js` | Modify | Custom dropdowns, stay-open session, cover letter cache, resume injection |
| `chrome-extension/background.js` | Modify | `GET_RESUME` message handler |

---

## Task 1: DB migration + TypeScript types

**Files:**
- Create: `supabase/migrations/20260514_autofill_improvements.sql`
- Modify: `src/lib/types.ts:101-146`

- [ ] **Step 1: Create the migration SQL file**

```sql
-- supabase/migrations/20260514_autofill_improvements.sql
ALTER TABLE autofill_profiles
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS resume_url      text;
```

- [ ] **Step 2: Run the migration**

Go to the Supabase dashboard → SQL Editor → paste and run the SQL above.
Verify: run `SELECT column_name FROM information_schema.columns WHERE table_name = 'autofill_profiles' AND column_name IN ('referral_source', 'resume_url');` — expect 2 rows returned.

- [ ] **Step 3: Update `src/lib/types.ts`**

Find the `AutofillProfile` interface (line ~101). After the `cover_letter_prompt` line add:

```ts
  referral_source: string | null
  resume_url: string | null
```

Full block after edit (lines 101–147):
```ts
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
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514_autofill_improvements.sql src/lib/types.ts
git commit -m "feat: add referral_source and resume_url to AutofillProfile"
```

---

## Task 2: Autofill API — referral_source support

**Files:**
- Modify: `src/app/api/extension/autofill/route.ts`

- [ ] **Step 1: Update `serializeProfile` to include referral_source**

In `serializeProfile()` (line ~20), add after the `Skills` line:

```ts
  `Referral source (how did you hear about us): ${p.referral_source ?? ''}`,
```

The full updated `lines` array in `serializeProfile` should end with:
```ts
  `Skills: ${(p.skills ?? []).join(', ')}`,
  `Referral source (how did you hear about us): ${p.referral_source ?? ''}`,
]
```

- [ ] **Step 2: Update the system prompt**

In `SYSTEM_PROMPT` (line ~7), add a new rule after the DEI rule:

```ts
const SYSTEM_PROMPT = `You map job application form fields to a user's profile.
Given a JSON array of form fields and a user profile, return STRICT JSON:
{"fields": [{"selector": "...", "value": "..."}]}

Rules:
- Only include fields where the profile has a clear match.
- For select/radio fields the value MUST exactly match one of the provided option strings.
- For checkboxes use "true" or "false".
- For DEI fields where profile value is null, use "Prefer not to say" if that option exists, otherwise skip.
- For "how did you hear about" / "how did you find this role" / "how did you learn about this position" questions, use the referral_source field.
- Never invent values not in the profile.
- Omit fields you are uncertain about.
- Return valid JSON only, no prose, no markdown.`
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/extension/autofill/route.ts
git commit -m "feat: add referral_source to autofill profile serialization and system prompt"
```

---

## Task 3: Content.js — cover letter from job page

**Files:**
- Modify: `chrome-extension/content.js`

- [ ] **Step 1: Update `setActiveJob` to store the job description**

Find `setActiveJob` (around line 472). Replace:

```js
async function setActiveJob({ title, company }) {
  if (!chrome?.storage?.local) return
  await chrome.storage.local.set({
    active_job: {
      title, company,
      url:         window.location.href,
      origin:      window.location.origin,
      extractedAt: Date.now(),
    },
  })
}
```

With:

```js
async function setActiveJob({ title, company, jobDescription }) {
  if (!chrome?.storage?.local) return
  await chrome.storage.local.set({
    active_job: {
      title, company,
      url:          window.location.href,
      origin:       window.location.origin,
      extractedAt:  Date.now(),
      jobDescription: jobDescription || '',
    },
  })
}
```

- [ ] **Step 2: Pass jobDescription at all `setActiveJob` call sites in `startExtraction`**

In `startExtraction` (around line 1277), find the JSON-LD fast path call:
```js
await setActiveJob(ld)
```
Replace with:
```js
await setActiveJob({ ...ld, jobDescription: filterPageForLLM() })
```

Find the LLM result path call (the `text` variable already holds the filtered page):
```js
await setActiveJob(result)
```
Replace with:
```js
await setActiveJob({ ...result, jobDescription: text })
```

- [ ] **Step 3: Use stored job description in `handleFill` for cover letter generation**

In `handleFill` (around line 938), find the cover letter block:
```js
const clRes = await chrome.runtime.sendMessage({
  type: 'COVER_LETTER',
  data: {
    profileId: selectedProfile.id,
    jobTitle: jobInfo.title || '',
    company: jobInfo.company || '',
    jobContext: filterPageForLLM(),
    customPrompt: selectedProfile.cover_letter_prompt || '',
  },
}).catch(() => null)
```

Replace with:
```js
const activeJobForCL = await getActiveJob()
const clRes = await chrome.runtime.sendMessage({
  type: 'COVER_LETTER',
  data: {
    profileId: selectedProfile.id,
    jobTitle: jobInfo.title || '',
    company: jobInfo.company || '',
    jobContext: activeJobForCL?.jobDescription || filterPageForLLM(),
    customPrompt: selectedProfile.cover_letter_prompt || '',
  },
}).catch(() => null)
```

- [ ] **Step 4: Commit**

```bash
git add chrome-extension/content.js
git commit -m "feat: cache job description on first page visit for cover letter generation"
```

---

## Task 4: Content.js — custom dropdown support

**Files:**
- Modify: `chrome-extension/content.js`

- [ ] **Step 1: Add combobox scanning in `scanFormFields`**

In `scanFormFields` (around line 138), just before the final `return fields` line, add:

```js
  // ── Custom dropdowns — [role="combobox"] ──────────────────────────────
  const comboboxEls = document.querySelectorAll('[role="combobox"]:not([disabled])')
  for (const el of comboboxEls) {
    if (!isVisible(el)) continue
    if (el.tagName === 'SELECT') continue   // already covered above

    const selector = getFieldSelector(el)
    if (seen.has(selector)) continue
    seen.add(selector)

    const field = { selector, type: 'combobox', label: getFieldLabel(el), options: [] }

    // Try aria-controls → listbox
    const controlsId = el.getAttribute('aria-controls')
    if (controlsId) {
      const listbox = document.getElementById(controlsId)
      if (listbox) {
        field.options = Array.from(listbox.querySelectorAll('[role="option"]'))
          .map(o => o.textContent.trim()).filter(Boolean)
      }
    }

    // Fallback: nearest ancestor that might contain a hidden listbox
    if (!field.options.length) {
      const ancestor = el.closest('[role="group"], [class*="select"], [class*="dropdown"]')
        || el.parentElement?.parentElement
      if (ancestor) {
        const listbox = ancestor.querySelector('[role="listbox"]')
        if (listbox) {
          field.options = Array.from(listbox.querySelectorAll('[role="option"]'))
            .map(o => o.textContent.trim()).filter(Boolean)
        }
      }
    }

    fields.push(field)
  }
```

- [ ] **Step 2: Make `fillFormFields` async and add combobox branch**

Find `function fillFormFields(mappings)` (line ~189). Change the signature and add the combobox branch before the `else` block:

```js
async function fillFormFields(mappings) {
  let filled = 0

  for (const { selector, value } of mappings) {
    if (!value) continue
    try {
      const el = document.querySelector(selector)
      if (!el) continue

      const tag  = el.tagName
      const type = (el.getAttribute('type') || el.getAttribute('role') || el.tagName.toLowerCase()).toLowerCase()

      if (tag === 'SELECT') {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
        const options = Array.from(el.options)
        const match = options.find(o => o.text.trim() === value) ||
                      options.find(o => o.text.trim().toLowerCase() === value.toLowerCase())
        if (!match) continue
        nativeSetter.call(el, match.value)
        el.dispatchEvent(new Event('change', { bubbles: true }))
        filled++
      } else if (type === 'combobox') {
        el.click()
        const found = await new Promise((resolve) => {
          let elapsed = 0
          const iv = setInterval(() => {
            elapsed += 50
            const opts = document.querySelectorAll('[role="option"]')
            for (const opt of opts) {
              const text = (opt.textContent || '').trim()
              if (text.toLowerCase() === value.toLowerCase() ||
                  text.toLowerCase().startsWith(value.toLowerCase())) {
                clearInterval(iv)
                opt.click()
                resolve(true)
                return
              }
            }
            if (elapsed >= 800) {
              clearInterval(iv)
              // Fallback: type value + Enter (autocomplete-style fields)
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
              nativeSetter.call(el, value)
              el.dispatchEvent(new Event('input', { bubbles: true }))
              el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
              resolve(false)
            }
          }, 50)
        })
        if (found) filled++
      } else if (type === 'radio') {
        const radios = document.querySelectorAll(selector)
        for (const radio of radios) {
          const label = radio.id
            ? document.querySelector(`label[for="${CSS.escape(radio.id)}"]`)?.textContent?.trim()
            : radio.closest('label')?.textContent?.trim()
          const text = label || radio.value
          if (text.toLowerCase() === value.toLowerCase() || radio.value.toLowerCase() === value.toLowerCase()) {
            radio.click()
            filled++
            break
          }
        }
      } else if (type === 'checkbox') {
        const shouldCheck = value === 'true' || value === '1' || value.toLowerCase() === 'yes'
        if (el.checked !== shouldCheck) { el.click(); filled++ }
      } else {
        const proto = tag === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set
        nativeSetter.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        filled++
      }
    } catch (_) {}
  }

  return filled
}
```

- [ ] **Step 3: Await `fillFormFields` in `handleFill`**

In `handleFill` (around line 980), find:
```js
filledCount = fillFormFields(autofillRes.fields)
```
Replace with:
```js
filledCount = await fillFormFields(autofillRes.fields)
```

- [ ] **Step 4: Commit**

```bash
git add chrome-extension/content.js
git commit -m "feat: add custom ARIA combobox support to autofill scanner and filler"
```

---

## Task 5: Content.js — autofill session persistence (stay open)

**Files:**
- Modify: `chrome-extension/content.js`

- [ ] **Step 1: Add session TTL constant and helper functions**

Add right after the `EXTRACT_TTL_MS` constant (around line 384):

```js
  const AUTOFILL_SESSION_TTL_MS = 30 * 60 * 1000

  async function getAutofillSession() {
    if (!chrome?.storage?.local) return null
    const { autofill_session } = await chrome.storage.local.get(['autofill_session'])
    if (!autofill_session) return null
    if (Date.now() - autofill_session.savedAt > AUTOFILL_SESSION_TTL_MS) return null
    return autofill_session
  }

  async function setAutofillSession(profileId, editedFields) {
    if (!chrome?.storage?.local) return
    await chrome.storage.local.set({
      autofill_session: { profileId, editedFields, savedAt: Date.now() },
    })
  }

  async function clearAutofillSession() {
    if (!chrome?.storage?.local) return
    await chrome.storage.local.remove(['autofill_session'])
  }
```

- [ ] **Step 2: Save session when profile is selected**

In `renderAutofillPicker`, find the `shadow.getElementById('next-btn').addEventListener('click', ...)` handler (around line 809). After `autofillStep = 'review'` and before `render()`, add:

```js
    shadow.getElementById('next-btn').addEventListener('click', () => {
      if (selectedIdx < 0) return
      selectedProfile = autofillProfiles[selectedIdx]
      editedFields = {}
      coverLetterOn = false
      autofillStep = 'review'
      setAutofillSession(selectedProfile.id, {})   // ← add this
      render()
    })
```

- [ ] **Step 3: Update session on field edits in review card**

In `renderAutofillReview`, find the `inp.addEventListener('input', ...)` loop (around line 889). Update it to also persist the session:

```js
    simpleFields.forEach(([key]) => {
      const inp = shadow.getElementById(`af-${key}`)
      if (inp) inp.addEventListener('input', () => {
        editedFields[key] = inp.value
        setAutofillSession(selectedProfile.id, editedFields)   // ← add this
      })
    })
```

- [ ] **Step 4: Clear session on dismiss and done**

Find every place `dismissed = true` is set and add `clearAutofillSession()` after each. There are several — in `renderJobCard`, `renderAutofillPicker`, `renderAutofillReview`, `renderAutofillDone`. For example:

```js
shadow.getElementById('close').onclick = () => { dismissed = true; clearAutofillSession(); render() }
```

Apply this pattern to all close button handlers in autofill-related render functions.

Also, at the end of `handleFill()`, before `autofillStep = 'done'` and `render()`, add:

```js
    await clearAutofillSession()
    autofillStep = 'done'
    render()
```

And in `renderConfirmation` dismiss handlers (clearActiveJob calls), also call `clearAutofillSession()`:
```js
    async function dismiss() {
      await clearActiveJob()
      clearAutofillSession()
      render()
    }
```

- [ ] **Step 5: Restore session on continuation pages in `init`**

In `init()` (around line 1366), find:

```js
    render()                  // show minimized button immediately
    startExtraction()         // resolve jobInfo in parallel (may re-render)
```

Replace with:

```js
    // Restore autofill session on multi-page flows
    const session = await getAutofillSession()
    if (session && activeJob) {
      const profilesRes = await chrome.runtime.sendMessage({ type: 'GET_PROFILES' }).catch(() => null)
      if (profilesRes?.profiles) {
        const profile = profilesRes.profiles.find(p => p.id === session.profileId)
        if (profile) {
          autofillProfiles = profilesRes.profiles
          selectedProfile  = profile
          editedFields     = session.editedFields || {}
          autofillStep     = 'review'
          expanded         = true
        }
      }
    }

    render()                  // show minimized button (or restored review card)
    startExtraction()         // resolve jobInfo in parallel (may re-render)
```

- [ ] **Step 6: Commit**

```bash
git add chrome-extension/content.js
git commit -m "feat: persist autofill session across multi-page application flows"
```

---

## Task 6: Resume API route + Supabase bucket

**Files:**
- Create: `src/app/api/profiles/[id]/resume/route.ts`

- [ ] **Step 1: Create the Supabase Storage bucket**

In the Supabase dashboard → Storage → New bucket:
- Name: `resumes`
- Public: **off** (private)
- File size limit: 10 MB
- Allowed MIME types: `application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Alternatively run this SQL:
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes', 'resumes', false, 10485760,
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Create `src/app/api/profiles/[id]/resume/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (bearerToken) {
    const service = createServiceClient()
    const { data: { user } } = await service.auth.getUser(bearerToken)
    return user?.id ?? null
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: profileId } = await params
  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, DOC, DOCX allowed' }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() ?? 'pdf').toLowerCase()
  const path = `${userId}/${profileId}/resume.${ext}`
  const buffer = await file.arrayBuffer()

  const service = createServiceClient()
  const { error: uploadError } = await service.storage
    .from('resumes')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { error: updateError } = await service
    .from('autofill_profiles')
    .update({ resume_url: path, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .eq('user_id', userId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ resume_url: path })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: profileId } = await params
  const service = createServiceClient()

  const { data: profile } = await service
    .from('autofill_profiles')
    .select('resume_url')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single()

  if (!profile?.resume_url) return NextResponse.json({ error: 'No resume' }, { status: 404 })

  const { data: signed, error } = await service.storage
    .from('resumes')
    .createSignedUrl(profile.resume_url, 3600)

  if (error || !signed) return NextResponse.json({ error: 'Could not create signed URL' }, { status: 500 })

  return NextResponse.json({ signed_url: signed.signedUrl, resume_url: profile.resume_url })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: profileId } = await params
  const service = createServiceClient()

  const { data: profile } = await service
    .from('autofill_profiles')
    .select('resume_url')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single()

  if (profile?.resume_url) {
    await service.storage.from('resumes').remove([profile.resume_url])
  }

  await service
    .from('autofill_profiles')
    .update({ resume_url: null, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .eq('user_id', userId)

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/profiles/[id]/resume/route.ts
git commit -m "feat: add resume upload/download/delete API route with Supabase Storage"
```

---

## Task 7: Profile form — referral_source + resume upload UI

**Files:**
- Modify: `src/app/(app)/profiles/[id]/profile-form.tsx`

- [ ] **Step 1: Add `referralSource` state**

In `ProfileForm`, after the `coverLetterPrompt` state (around line 103), add:

```tsx
  const [referralSource, setReferralSource] = useState(initialProfile?.referral_source ?? '')
```

- [ ] **Step 2: Add `referral_source` to `handleSave` payload**

In the `payload` object inside `handleSave` (around line 159), add after `cover_letter_prompt`:

```ts
      referral_source: referralSource.trim() || null,
```

- [ ] **Step 3: Add resume state and handlers**

After `referralSource` state, add:

```tsx
  const [resumeFileName, setResumeFileName] = useState<string | null>(
    initialProfile?.resume_url ? (initialProfile.resume_url.split('/').pop() ?? null) : null
  )
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !initialProfile?.id) return
    setResumeUploading(true)
    setResumeError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/profiles/${initialProfile.id}/resume`, { method: 'PUT', body: fd })
    setResumeUploading(false)
    if (res.ok) {
      setResumeFileName(file.name)
    } else {
      const data = await res.json().catch(() => ({}))
      setResumeError(data.error ?? 'Upload failed')
    }
  }

  async function handleResumeDelete() {
    if (!initialProfile?.id) return
    await fetch(`/api/profiles/${initialProfile.id}/resume`, { method: 'DELETE' })
    setResumeFileName(null)
  }
```

- [ ] **Step 4: Add Application Preferences card to JSX**

In the JSX, add a new card after the "Cover Letter Instructions" card and before the error/save buttons:

```tsx
      {/* Application Preferences */}
      <Card>
        <CardHeader><CardTitle>Application Preferences</CardTitle></CardHeader>
        <CardContent>
          <Field label='How did you hear about us (default answer)'>
            <input
              className={inputCls}
              value={referralSource}
              onChange={e => setReferralSource(e.target.value)}
              placeholder='e.g. LinkedIn, Company website, Referred by a friend'
            />
          </Field>
        </CardContent>
      </Card>

      {/* Resume */}
      <Card>
        <CardHeader>
          <CardTitle>Resume</CardTitle>
          <p className='text-sm text-gray-500 mt-1'>Used by the extension to auto-attach your resume when applying.</p>
        </CardHeader>
        <CardContent>
          {!initialProfile?.id ? (
            <p className='text-sm text-gray-400'>Save the profile first to upload a resume.</p>
          ) : resumeFileName ? (
            <div className='flex items-center gap-3'>
              <span className='text-sm text-gray-700 truncate max-w-xs'>{resumeFileName}</span>
              <button
                type='button'
                onClick={handleResumeDelete}
                className='text-xs text-red-500 hover:text-red-700 flex-shrink-0'
              >
                Remove
              </button>
            </div>
          ) : (
            <label className='cursor-pointer'>
              <div className={inputCls + ' py-2 text-center text-gray-500 cursor-pointer select-none'}>
                {resumeUploading ? 'Uploading…' : 'Upload PDF, DOC, or DOCX'}
              </div>
              <input
                type='file'
                accept='.pdf,.doc,.docx'
                className='hidden'
                onChange={handleResumeUpload}
                disabled={resumeUploading}
              />
            </label>
          )}
          {resumeError && <p className='text-xs text-red-500 mt-1'>{resumeError}</p>}
        </CardContent>
      </Card>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Verify the profile form renders correctly**

Start the dev server (`npm run dev`) and navigate to `/profiles/new` and an existing profile edit page. Confirm:
- "Application Preferences" card appears with the referral source field
- "Resume" card appears; on new profiles shows "Save the profile first…"; on existing profiles shows upload UI

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/profiles/[id]/profile-form.tsx
git commit -m "feat: add referral_source field and resume upload UI to profile form"
```

---

## Task 8: Background.js GET_RESUME + content.js resume injection

**Files:**
- Modify: `chrome-extension/background.js`
- Modify: `chrome-extension/content.js`

- [ ] **Step 1: Add `GET_RESUME` message handler in `background.js`**

In the `chrome.runtime.onMessage.addListener` block (around line 13), add after the `COVER_LETTER` handler:

```js
  if (message.type === 'GET_RESUME') {
    getResume(message.data).then(sendResponse)
    return true
  }
```

- [ ] **Step 2: Implement the `getResume` function in `background.js`**

Add after `generateCoverLetter`:

```js
async function getResume({ profileId }) {
  const { token } = await getValidToken()
  if (!token) return { error: 'NOT_LOGGED_IN' }

  try {
    const res = await fetch(`${APP_URL}/api/profiles/${profileId}/resume`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { error: body.error || `Server error (${res.status})` }

    const { signed_url, resume_url } = body

    const fileRes = await fetch(signed_url)
    if (!fileRes.ok) return { error: 'Could not fetch resume file' }

    const buffer = await fileRes.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)

    const mimeType = fileRes.headers.get('content-type') || 'application/octet-stream'
    const filename = resume_url.split('/').pop() || 'resume.pdf'

    return { base64, mimeType, filename }
  } catch (e) {
    return { error: 'Network error — check your connection' }
  }
}
```

- [ ] **Step 3: Add `resumeAttached` state variable in `content.js`**

In the State section (around line 514), after `coverLetterPasted`:

```js
  let resumeAttached   = false
```

- [ ] **Step 4: Add resume injection at the end of `handleFill` in `content.js`**

In `handleFill`, after the cover letter paste block and before `autofillStep = 'done'`, add:

```js
    resumeAttached = false
    if (selectedProfile.resume_url) {
      const resumeInputs = Array.from(document.querySelectorAll('input[type="file"]:not([disabled])'))
        .filter(el => {
          if (!isVisible(el)) return false
          const lbl = getFieldLabel(el).toLowerCase()
          return lbl.includes('resume') || lbl.includes('cv') || lbl.includes('upload')
        })

      if (resumeInputs.length > 0) {
        const resumeRes = await chrome.runtime.sendMessage({
          type: 'GET_RESUME',
          data: { profileId: selectedProfile.id },
        }).catch(() => null)

        if (resumeRes?.base64) {
          const bytes = Uint8Array.from(atob(resumeRes.base64), c => c.charCodeAt(0))
          const blob  = new Blob([bytes], { type: resumeRes.mimeType })
          const file  = new File([blob], resumeRes.filename, { type: resumeRes.mimeType })
          const dt    = new DataTransfer()
          dt.items.add(file)
          resumeInputs[0].files = dt.files
          resumeInputs[0].dispatchEvent(new Event('change', { bubbles: true }))
          resumeInputs[0].dispatchEvent(new Event('input',  { bubbles: true }))
          resumeAttached = true
          filledCount++
        }
      }
    }
```

- [ ] **Step 5: Update the done card to show resume status**

In `renderAutofillDone` (around line 910), find:

```js
          <div style="font-size:11px;color:#6b7280;line-height:1.6;">
            ${filledCount} field${filledCount !== 1 ? 's' : ''} filled
            ${coverLetterPasted ? '· cover letter pasted' : ''}
          </div>
```

Replace with:

```js
          <div style="font-size:11px;color:#6b7280;line-height:1.6;">
            ${filledCount} field${filledCount !== 1 ? 's' : ''} filled
            ${coverLetterPasted ? '· cover letter pasted' : ''}
            ${resumeAttached ? '· resume attached' : ''}
          </div>
```

- [ ] **Step 6: Manual verification in the browser**

1. Open any job application page (e.g. a Greenhouse job)
2. Load the extension (chrome://extensions → Load unpacked)
3. Click the Bamboo button → Autofill → select profile → Fill form
4. Confirm: standard fields are filled, custom dropdowns are handled, resume file input is populated (check DevTools → the file input's `.files` property)
5. Navigate to page 2 of a multi-step application → confirm the review card auto-opens
6. Enable cover letter toggle → confirm the generated letter uses the original job description (not the application form)

- [ ] **Step 7: Commit**

```bash
git add chrome-extension/background.js chrome-extension/content.js
git commit -m "feat: add resume auto-attachment via GET_RESUME background handler"
```
