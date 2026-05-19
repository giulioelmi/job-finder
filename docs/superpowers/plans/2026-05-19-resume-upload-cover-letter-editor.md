# Resume Upload & Cover Letter Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-profile resume upload with auto-attachment in the extension, and replace the inline cover letter toggle with a standalone button that opens a new tab with an editable, downloadable cover letter.

**Architecture:** The resume upload API stores files in Supabase Storage; the extension fetches a signed URL at fill time, converts the file to base64, and injects it via DataTransfer. The cover letter flow moves out of `handleFill()` — a new standalone button calls the existing cover-letter API via a new `OPEN_COVER_LETTER` background handler, stores the result in `chrome.storage`, opens `jobbamboo.com/cover-letter`, and a new bridge content script relays the draft to the page via `postMessage`.

**Tech Stack:** Next.js 15 App Router, Supabase Storage, Chrome Extension MV3, React, Tailwind CSS

---

### Task 1: Supabase Storage bucket + Resume API route

**Files:**
- Create: `src/app/api/profiles/[id]/resume/route.ts`

- [ ] **Step 1: Create the `resumes` bucket in Supabase**

  Open the Supabase dashboard → Storage → New bucket.
  - Name: `resumes`
  - Public: **No** (private)
  - Click "Create bucket"

- [ ] **Step 2: Create the resume API route**

  Create `src/app/api/profiles/[id]/resume/route.ts`:

  ```typescript
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

    const { id } = await params
    const formData = await req.formData().catch(() => null)
    const file = formData?.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['pdf', 'doc', 'docx'].includes(ext))
      return NextResponse.json({ error: 'Invalid file type. Use PDF, DOC, or DOCX.' }, { status: 400 })

    if (file.size > 5 * 1024 * 1024)
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })

    const service = createServiceClient()
    const path = `${userId}/${id}/resume.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await service.storage
      .from('resumes')
      .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

    if (uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { error: updateError } = await service
      .from('autofill_profiles')
      .update({ resume_url: path, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ resume_url: path })
  }

  export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const userId = await resolveUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const service = createServiceClient()

    const { data: profile } = await service
      .from('autofill_profiles')
      .select('resume_url')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (!profile?.resume_url)
      return NextResponse.json({ error: 'No resume uploaded' }, { status: 404 })

    const { data, error } = await service.storage
      .from('resumes')
      .createSignedUrl(profile.resume_url, 3600)

    if (error || !data)
      return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 500 })

    const filename = profile.resume_url.split('/').pop() ?? 'resume'
    return NextResponse.json({ signed_url: data.signedUrl, filename })
  }

  export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const userId = await resolveUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const service = createServiceClient()

    const { data: profile } = await service
      .from('autofill_profiles')
      .select('resume_url')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (profile?.resume_url) {
      await service.storage.from('resumes').remove([profile.resume_url])
    }

    await service
      .from('autofill_profiles')
      .update({ resume_url: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    return NextResponse.json({ success: true })
  }
  ```

- [ ] **Step 3: Test the endpoints manually**

  Start the dev server: `npm run dev`

  Get a valid bearer token from the extension popup (logged-in user → open DevTools on the popup → `chrome.storage.local.get(['access_token'], console.log)`).

  Test PUT:
  ```bash
  curl -X PUT http://localhost:3000/api/profiles/<profile-id>/resume \
    -H "Authorization: Bearer <token>" \
    -F "file=@/path/to/resume.pdf"
  # Expected: {"resume_url":"<user_id>/<profile_id>/resume.pdf"}
  ```

  Test GET:
  ```bash
  curl http://localhost:3000/api/profiles/<profile-id>/resume \
    -H "Authorization: Bearer <token>"
  # Expected: {"signed_url":"https://...","filename":"resume.pdf"}
  ```

  Test DELETE:
  ```bash
  curl -X DELETE http://localhost:3000/api/profiles/<profile-id>/resume \
    -H "Authorization: Bearer <token>"
  # Expected: {"success":true}
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add "src/app/api/profiles/[id]/resume/route.ts"
  git commit -m "feat: add resume upload/get/delete API route with Supabase Storage"
  ```

---

### Task 2: Profile form resume upload UI

**Files:**
- Modify: `src/app/(app)/profiles/[id]/profile-form.tsx`

- [ ] **Step 1: Add resume state variables**

  After the `const [coverLetterPrompt, setCoverLetterPrompt] = useState(...)` line (around line 102), add:

  ```tsx
  const [resumeUrl, setResumeUrl] = useState<string | null>(initialProfile?.resume_url ?? null)
  const [resumeFilename, setResumeFilename] = useState<string | null>(
    initialProfile?.resume_url ? (initialProfile.resume_url.split('/').pop() ?? null) : null
  )
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)
  ```

- [ ] **Step 2: Add upload and remove handler functions**

  After the `removeQA` function (around line 151), add:

  ```tsx
  async function handleResumeUpload(file: File) {
    if (!initialProfile?.id) return
    if (file.size > 5 * 1024 * 1024) { setResumeError('File too large (max 5 MB)'); return }
    setResumeUploading(true)
    setResumeError(null)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/profiles/${initialProfile.id}/resume`, { method: 'PUT', body: form })
    setResumeUploading(false)
    if (res.ok) {
      const data = await res.json()
      setResumeUrl(data.resume_url)
      setResumeFilename(file.name)
    } else {
      const data = await res.json().catch(() => ({}))
      setResumeError(data.error ?? 'Upload failed')
    }
  }

  async function handleResumeRemove() {
    if (!initialProfile?.id) return
    setResumeUploading(true)
    setResumeError(null)
    const res = await fetch(`/api/profiles/${initialProfile.id}/resume`, { method: 'DELETE' })
    setResumeUploading(false)
    if (res.ok) {
      setResumeUrl(null)
      setResumeFilename(null)
    } else {
      setResumeError('Failed to remove resume')
    }
  }
  ```

- [ ] **Step 3: Add the Resume section to the JSX**

  In the return JSX, insert this block between the closing `</div>` of the `{/* Custom Q&A */}` section and the opening `<div>` of the `{/* Cover letter prompt */}` section:

  ```tsx
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
        <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${resumeUploading ? 'opacity-50 cursor-not-allowed border-gray-300' : 'border-gray-300 hover:border-green-600 hover:bg-green-50'}`}>
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
  ```

- [ ] **Step 4: Test the UI manually**

  Navigate to an existing profile at `http://localhost:3000/profiles/<id>`.
  - Confirm the Resume section appears above "Cover Letter Instructions".
  - Upload a PDF — the filename should appear with a "Remove" button.
  - Click "Remove" — the upload zone should reappear.
  - Navigate to `/profiles/new` — confirm "Save this profile first" text appears.

- [ ] **Step 5: Commit**

  ```bash
  git add "src/app/(app)/profiles/[id]/profile-form.tsx"
  git commit -m "feat: add resume upload/remove UI to profile editor"
  ```

---

### Task 3: Update cover letter API system prompt

**Files:**
- Modify: `src/app/api/extension/cover-letter/route.ts`

- [ ] **Step 1: Replace the DEFAULT_INSTRUCTIONS constant**

  In `src/app/api/extension/cover-letter/route.ts`, replace lines 7–9:

  ```typescript
  const DEFAULT_INSTRUCTIONS = `Write a professional cover letter. Be concise (3–4 paragraphs).
  Highlight relevant experience and skills. Do not start with "Dear Hiring Manager" unless
  the user's custom prompt requests it. Return only the cover letter text.`
  ```

  With:

  ```typescript
  const DEFAULT_INSTRUCTIONS = `Write a professional cover letter formatted as a standard business letter.
  Structure it exactly as follows:
  1. Candidate full name, street address, city/state/zip, email, phone — each on its own line
  2. A blank line, then today's date (e.g. May 19, 2026)
  3. A blank line, then the company name and mailing address (infer from your knowledge; if the address is unknown use just the company name and city)
  4. A blank line, then the salutation ("Dear Hiring Team," unless the job description names a specific contact)
  5. Body: 3–4 concise paragraphs highlighting relevant experience and why the candidate fits this role
  6. Closing: "Sincerely," followed by the candidate's full name
  Return only the formatted letter text. No markdown. No subject line.`
  ```

- [ ] **Step 2: Test the updated format**

  Trigger a cover letter generation (via the extension or curl) and confirm the response contains:
  - Candidate contact block at the top
  - Date line
  - Company block
  - Salutation
  - Body paragraphs
  - Closing with name

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/extension/cover-letter/route.ts
  git commit -m "feat: format cover letter output as a standard business letter"
  ```

---

### Task 4: Extension manifest + cover-letter-bridge.js

**Files:**
- Modify: `chrome-extension/manifest.json`
- Create: `chrome-extension/cover-letter-bridge.js`

- [ ] **Step 1: Update manifest.json**

  Replace the entire content of `chrome-extension/manifest.json` with:

  ```json
  {
    "manifest_version": 3,
    "name": "Bamboo Job Tracker",
    "version": "1.1.2",
    "description": "Track job applications directly from any company website or ATS. One click to save the role, company, and URL to your Bamboo dashboard.",

    "icons": {
      "16": "icon-16.png",
      "48": "icon-48.png",
      "128": "icon-128.png"
    },

    "homepage_url": "https://www.jobbamboo.com",

    "permissions": ["storage", "tabs"],
    "host_permissions": [
      "https://tlbbsffehzmoqyrfotau.supabase.co/*",
      "https://www.jobbamboo.com/*"
    ],

    "action": {
      "default_popup": "popup.html",
      "default_title": "Bamboo Job Tracker",
      "default_icon": {
        "16": "icon-16.png",
        "48": "icon-48.png",
        "128": "icon-128.png"
      }
    },

    "background": {
      "service_worker": "background.js"
    },

    "content_scripts": [
      {
        "matches": ["https://*/*", "http://*/*"],
        "js": ["content.js"],
        "run_at": "document_idle"
      },
      {
        "matches": ["https://www.jobbamboo.com/cover-letter*"],
        "js": ["cover-letter-bridge.js"],
        "run_at": "document_idle"
      }
    ]
  }
  ```

- [ ] **Step 2: Create cover-letter-bridge.js**

  Create `chrome-extension/cover-letter-bridge.js`:

  ```js
  ;(function () {
    chrome.storage.local.get(['cover_letter_draft'], ({ cover_letter_draft }) => {
      if (cover_letter_draft) {
        window.postMessage({ type: 'BAMBOO_COVER_LETTER', payload: cover_letter_draft }, '*')
        chrome.storage.local.remove(['cover_letter_draft'])
      }
    })
  })()
  ```

- [ ] **Step 3: Reload the extension and confirm no errors**

  Go to `chrome://extensions` → Reload Bamboo.
  Open the background service worker console and confirm no errors on startup.

- [ ] **Step 4: Commit**

  ```bash
  git add chrome-extension/manifest.json chrome-extension/cover-letter-bridge.js
  git commit -m "feat: add tabs permission and cover-letter bridge content script"
  ```

---

### Task 5: Extension background.js — GET_RESUME + OPEN_COVER_LETTER handlers

**Files:**
- Modify: `chrome-extension/background.js`

- [ ] **Step 1: Register the two new message handlers**

  Inside the `chrome.runtime.onMessage.addListener` callback, add these two blocks after the existing `if (message.type === 'COVER_LETTER')` block (around line 48):

  ```js
  if (message.type === 'GET_RESUME') {
    getResume(message.data).then(sendResponse)
    return true
  }
  if (message.type === 'OPEN_COVER_LETTER') {
    openCoverLetter(message.data).then(sendResponse)
    return true
  }
  ```

- [ ] **Step 2: Add the getResume function**

  Add after the `generateCoverLetter` function (end of the file, before the closing of the guard block):

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

      const { signed_url, filename } = body
      const fileRes = await fetch(signed_url)
      if (!fileRes.ok) return { error: 'Failed to fetch resume file' }

      const arrayBuffer = await fileRes.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)
      const mimeType = fileRes.headers.get('content-type') || 'application/octet-stream'

      return { base64, mimeType, filename }
    } catch (e) {
      return { error: 'Network error — check your connection' }
    }
  }
  ```

- [ ] **Step 3: Add the openCoverLetter function**

  Add directly after `getResume`:

  ```js
  async function openCoverLetter({ profileId, jobTitle, company, jobContext, customPrompt }) {
    const clRes = await generateCoverLetter({ profileId, jobTitle, company, jobContext, customPrompt })
    if (clRes.error) return { error: clRes.error }

    await chrome.storage.local.set({
      cover_letter_draft: {
        coverLetter: clRes.cover_letter,
        jobTitle: jobTitle || '',
        company: company || '',
      },
    })

    await chrome.tabs.create({ url: `${APP_URL}/cover-letter` })
    return { success: true }
  }
  ```

- [ ] **Step 4: Reload and verify**

  Reload the extension at `chrome://extensions`.
  Open the service worker console — confirm no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add chrome-extension/background.js
  git commit -m "feat: add GET_RESUME and OPEN_COVER_LETTER background handlers"
  ```

---

### Task 6: Extension content.js — replace cover letter toggle with standalone button

**Files:**
- Modify: `chrome-extension/content.js`

- [ ] **Step 1: Remove coverLetterOn and coverLetterPasted state variables**

  Find these three lines in the state block (around lines 615–617):

  ```js
  let coverLetterOn     = false
  let filledCount       = 0
  let coverLetterPasted = false
  ```

  Replace with:

  ```js
  let filledCount    = 0
  let resumeAttached = false
  ```

- [ ] **Step 2: Replace the cover letter toggle div in renderAutofillReview()**

  Find and remove this entire block from the `renderAutofillReview()` HTML template string (around lines 951–960):

  ```js
        <div style="display:flex;align-items:center;justify-content:space-between;
          background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:8px;padding:8px 10px;margin-bottom:10px;">
          <span style="font-size:11px;font-weight:600;color:#374151;">Generate cover letter</span>
          <div id="cl-toggle" style="
            width:32px;height:18px;background:${coverLetterOn ? '#15803d' : '#d1d5db'};
            border-radius:9px;position:relative;cursor:pointer;">
            <div style="width:14px;height:14px;background:#fff;border-radius:50%;position:absolute;
              top:2px;${coverLetterOn ? 'right:2px' : 'left:2px'};transition:left 0.15s,right 0.15s;"></div>
          </div>
        </div>
  ```

  Insert this button in its place (just before `${msgHtml()}`):

  ```js
        <button id="cl-btn" style="
          width:100%;padding:8px;background:#fff;color:#15803d;border:1.5px solid #15803d;
          border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;
          font-family:inherit;letter-spacing:0.01em;margin-bottom:10px;">✉ Generate cover letter →</button>
  ```

- [ ] **Step 3: Remove the cl-toggle handler; add the cl-btn handler**

  In `renderAutofillReview()`, find and remove the `cl-toggle` onclick handler:

  ```js
    shadow.getElementById('cl-toggle').onclick = () => {
      saveCurrentFields()   // preserve in-progress edits before re-render
      coverLetterOn = !coverLetterOn
      render()
    }
  ```

  Add in its place:

  ```js
    shadow.getElementById('cl-btn').onclick = async () => {
      saveCurrentFields()
      const btn = shadow.getElementById('cl-btn')
      btn.disabled = true
      btn.textContent = 'Generating…'
      btn.style.opacity = '0.7'
      const activeJobForCL = await getActiveJob()
      const res = await chrome.runtime.sendMessage({
        type: 'OPEN_COVER_LETTER',
        data: {
          profileId: selectedProfile.id,
          jobTitle: jobInfo.title || '',
          company: jobInfo.company || '',
          jobContext: activeJobForCL?.jobDescription || filterPageForLLM(),
          customPrompt: selectedProfile.cover_letter_prompt || '',
        },
      }).catch(() => null)
      if (res?.error) {
        btn.disabled = false
        btn.textContent = '✉ Generate cover letter →'
        btn.style.opacity = '1'
        showMsg('Could not generate cover letter. Try again.', 'error')
      }
      // On success the new tab opens; button stays visually disabled until user closes card
    }
  ```

- [ ] **Step 4: Remove cover letter generation from handleFill()**

  In `handleFill()`, find and remove the cover letter text generation block (around lines 1037–1053):

  ```js
    let coverLetterText = null

    if (coverLetterOn) {
      if (fillBtn) fillBtn.textContent = 'Generating cover letter…'
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
      if (clRes?.cover_letter) coverLetterText = clRes.cover_letter
    }
  ```

  Also find and remove the cover letter pasting block (around lines 1076–1094):

  ```js
    coverLetterPasted = false
    if (coverLetterText) {
      // Find a visible textarea that likely is the cover letter field
      const textareas = Array.from(document.querySelectorAll('textarea:not([disabled])'))
        .filter(el => {
          const label = getFieldLabel(el).toLowerCase()
          return label.includes('cover') || label.includes('letter') || label.includes('why') || label.includes('motivation')
        })
      if (textareas.length > 0) {
        const proto = window.HTMLTextAreaElement.prototype
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set
        nativeSetter.call(textareas[0], coverLetterText)
        textareas[0].dispatchEvent(new Event('input', { bubbles: true }))
        textareas[0].dispatchEvent(new Event('change', { bubbles: true }))
        coverLetterPasted = true
        filledCount++
      }
    }
  ```

- [ ] **Step 5: Update the done card to use resumeAttached**

  In `renderAutofillDone()`, find:

  ```js
            ${filledCount} field${filledCount !== 1 ? 's' : ''} filled
            ${coverLetterPasted ? '· cover letter pasted' : ''}
  ```

  Replace with:

  ```js
            ${filledCount} field${filledCount !== 1 ? 's' : ''} filled
            ${resumeAttached ? '· resume attached' : ''}
  ```

- [ ] **Step 6: Reload and smoke-test**

  Reload the extension. Open a job application page, click the Bamboo widget, select a profile.
  - Confirm the cover letter toggle is gone.
  - Confirm "✉ Generate cover letter →" button appears below "Fill form ✓".
  - Click "Fill form ✓" — confirm form fills normally with no cover letter behavior.

- [ ] **Step 7: Commit**

  ```bash
  git add chrome-extension/content.js
  git commit -m "feat: replace cover letter toggle with standalone generate button"
  ```

---

### Task 7: Extension content.js — resume injection in handleFill()

**Files:**
- Modify: `chrome-extension/content.js`

- [ ] **Step 1: Add resume injection block in handleFill()**

  In `handleFill()`, find the line:

  ```js
    filledCount = await fillFormFields(autofillRes.fields)
  ```

  Immediately after it, add:

  ```js
    resumeAttached = false
    if (selectedProfile.resume_url) {
      const fileInputs = Array.from(document.querySelectorAll('input[type="file"]:not([disabled])'))
        .filter(el => {
          if (!isVisible(el)) return false
          const label = getFieldLabel(el).toLowerCase()
          return label.includes('resume') || label.includes('cv') || label.includes('upload')
        })
      if (fileInputs.length > 0) {
        const resumeRes = await chrome.runtime.sendMessage({
          type: 'GET_RESUME',
          data: { profileId: selectedProfile.id },
        }).catch(() => null)
        if (resumeRes?.base64) {
          try {
            const bytes = Uint8Array.from(atob(resumeRes.base64), c => c.charCodeAt(0))
            const blob = new Blob([bytes], { type: resumeRes.mimeType })
            const file = new File([blob], resumeRes.filename, { type: resumeRes.mimeType })
            const dt = new DataTransfer()
            dt.items.add(file)
            fileInputs[0].files = dt.files
            fileInputs[0].dispatchEvent(new Event('change', { bubbles: true }))
            resumeAttached = true
            filledCount++
          } catch (_) {}
        }
      }
    }
  ```

- [ ] **Step 2: Test resume injection end-to-end**

  1. Upload a PDF to a profile via the web app resume section.
  2. Navigate to a job application page that has a file input labelled "Resume" or "CV".
  3. Run autofill with that profile.
  4. Confirm the done card shows "X fields filled · resume attached".
  5. Confirm the file input on the page shows the filename of the uploaded resume.

- [ ] **Step 3: Commit**

  ```bash
  git add chrome-extension/content.js
  git commit -m "feat: auto-attach resume to file inputs during autofill"
  ```

---

### Task 8: Web app cover letter page

**Files:**
- Create: `src/app/cover-letter/page.tsx`

- [ ] **Step 1: Create the cover letter page**

  Create `src/app/cover-letter/page.tsx`:

  ```tsx
  'use client'

  import { useEffect, useRef, useState } from 'react'

  interface CoverLetterPayload {
    coverLetter: string
    jobTitle: string
    company: string
  }

  export default function CoverLetterPage() {
    const [payload, setPayload] = useState<CoverLetterPayload | null>(null)
    const [timedOut, setTimedOut] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
      const timeout = setTimeout(() => setTimedOut(true), 5000)

      function handleMessage(e: MessageEvent) {
        if (e.data?.type === 'BAMBOO_COVER_LETTER') {
          clearTimeout(timeout)
          setPayload(e.data.payload as CoverLetterPayload)
        }
      }

      window.addEventListener('message', handleMessage)
      return () => {
        window.removeEventListener('message', handleMessage)
        clearTimeout(timeout)
      }
    }, [])

    function handleDownload() {
      const text = textareaRef.current?.value ?? ''
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      const win = window.open('', '_blank')
      if (!win) return
      win.document.write(`<!DOCTYPE html>
  <html>
  <head>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      margin: 1in;
      white-space: pre-wrap;
      line-height: 1.5;
      color: #000;
    }
  </style>
  </head>
  <body>${escaped}</body>
  </html>`)
      win.document.close()
      win.focus()
      win.print()
      win.close()
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-green-700 rounded-lg flex-shrink-0" />
            <span className="font-bold text-gray-900 text-sm">Bamboo</span>
            {payload && (
              <span className="text-sm text-gray-400">
                {payload.jobTitle}{payload.jobTitle && payload.company ? ' · ' : ''}{payload.company}
              </span>
            )}
          </div>
          {payload && (
            <button
              onClick={handleDownload}
              className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 transition-colors"
            >
              ↓ Download PDF
            </button>
          )}
        </div>

        <div className="max-w-3xl mx-auto px-6 py-8">
          {payload ? (
            <textarea
              ref={textareaRef}
              defaultValue={payload.coverLetter}
              className="w-full min-h-[600px] border border-gray-200 rounded-xl p-6 text-sm text-gray-900 leading-relaxed font-mono resize-y focus:outline-none focus:ring-2 focus:ring-green-600 bg-white shadow-sm"
            />
          ) : timedOut ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-lg font-medium mb-2">Could not load cover letter</p>
              <p className="text-sm">Please try again from the extension.</p>
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm">Loading your cover letter…</p>
            </div>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Test the full cover letter flow end-to-end**

  1. Navigate to a job page with the extension loaded.
  2. Click the Bamboo widget → select a profile → click "✉ Generate cover letter →".
  3. Confirm the button shows "Generating…" while in-flight.
  4. Confirm a new tab opens at `jobbamboo.com/cover-letter`.
  5. Confirm the letter loads with the business letter format (candidate block, date, company block, body, closing).
  6. Edit the text — confirm the textarea is freely editable.
  7. Click "↓ Download PDF" — confirm the browser print dialog opens with the letter in a clean serif layout (1-inch margins, Times New Roman 12pt).

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/cover-letter/page.tsx
  git commit -m "feat: add cover letter editor page with PDF download"
  ```
