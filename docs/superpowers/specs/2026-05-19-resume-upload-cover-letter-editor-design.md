# Resume Upload & Cover Letter Editor — Design Spec
**Date:** 2026-05-19

## Overview

Two improvements to the Bamboo Chrome extension and web app:

1. **Resume upload** — each profile can store a resume file; the extension auto-attaches it to file inputs on application forms.
2. **Cover letter editor page** — clicking "Generate cover letter" in the extension opens a new tab with a formatted, editable cover letter and a PDF download button.

Multi-page session persistence (restoring the review card on continuation pages) is already implemented and requires no changes.

---

## 1. Resume Upload

### Storage

- Supabase Storage bucket: `resumes` (private)
- Path pattern: `{user_id}/{profile_id}/resume.{ext}`
- The web app API owns all Storage access; the extension never calls Storage directly.
- `resume_url` column already exists on `autofill_profiles` (added in previous migration).

### API — `/api/profiles/[id]/resume/route.ts` (new file)

| Method | Behaviour |
|--------|-----------|
| `PUT` | Accepts `multipart/form-data` with a `file` field (PDF, DOC, DOCX, max 5 MB). Uploads to Storage, saves the path as `resume_url` on the profile row. Returns `{ resume_url }`. |
| `GET` | Returns a 1-hour signed URL for the stored file: `{ signed_url, filename }`. |
| `DELETE` | Removes the file from Storage and clears `resume_url` on the profile row. Returns `{ success: true }`. |

Auth: same `resolveUserId` pattern as `/api/profiles/[id]/route.ts` (bearer token or Supabase cookie).

### Web app — profile editor (`profile-form.tsx`)

A new **Resume** section is added at the bottom of the form, just above "Cover Letter Instructions".

- **No file uploaded:** drag-and-drop zone with a "Choose file" button. Accepted types: `.pdf`, `.doc`, `.docx`. Max 5 MB enforced client-side before upload.
- **File uploaded:** shows filename, upload date, and a "Remove" link. Clicking "Remove" immediately calls `DELETE /api/profiles/{id}/resume` and clears local state — no confirmation dialog.
- Upload calls `PUT /api/profiles/{id}/resume` with `multipart/form-data`. On success, updates local state with the returned `resume_url`.

### Extension — `background.js`

New message handler `GET_RESUME`:

```
message: { type: 'GET_RESUME', data: { profileId } }
→ calls GET /api/profiles/{profileId}/resume (bearer token)
→ fetches the signed URL, converts to base64
→ responds: { base64, mimeType, filename }
```

### Extension — `content.js` (`handleFill()`)

After filling standard form fields:

1. Query all visible `input[type="file"]` whose label (via `getFieldLabel()`) contains `resume`, `cv`, or `upload`.
2. If found and `selectedProfile.resume_url` is set:
   - Send `GET_RESUME` to background.
   - Convert `base64` → `Uint8Array` → `Blob` → `File`.
   - Inject via `DataTransfer`: set `input.files`, dispatch `change` event.
   - Increment `filledCount`.
3. The "done" card shows "resume attached" when the file was injected.

---

## 2. Cover Letter Editor Page

### Flow

1. User is on the extension review card (profile selected, fields ready).
2. The cover letter **toggle is removed**. In its place: a standalone **"✉ Generate cover letter →"** button below "Fill form ✓".
3. Clicking it shows a brief loading state on the button, then sends `OPEN_COVER_LETTER` to background.js.
4. Background.js calls the cover-letter API (same endpoint as before), stores the result in `chrome.storage.local` as `cover_letter_draft`, and opens `https://www.jobbamboo.com/cover-letter` in a new tab.
5. The extension content script (injected on jobbamboo.com) reads `cover_letter_draft` from storage and `postMessage`s the payload to the page.
6. The page populates the editor and is ready to use.

"Fill form ✓" is unchanged — it fills form fields only, no cover letter involvement.

### Extension — `background.js`

New message handler `OPEN_COVER_LETTER`:

```
message: { type: 'OPEN_COVER_LETTER', data: { profileId, jobTitle, company, jobContext, customPrompt } }
→ calls cover-letter API (bearer token)
→ on success: stores { coverLetter, jobTitle, company } in chrome.storage.local as cover_letter_draft
→ chrome.tabs.create({ url: 'https://www.jobbamboo.com/cover-letter' })
→ responds: { success: true } or { error }
```

Requires `tabs` permission in `manifest.json`.

### Extension — `manifest.json`

- Add `"tabs"` to `permissions`.
- Add a new content script entry:
  ```json
  {
    "matches": ["https://www.jobbamboo.com/cover-letter*"],
    "js": ["cover-letter-bridge.js"],
    "run_at": "document_idle"
  }
  ```

### Extension — `cover-letter-bridge.js` (new file)

Tiny content script injected only on the cover letter page:

```js
chrome.storage.local.get(['cover_letter_draft'], ({ cover_letter_draft }) => {
  if (cover_letter_draft) {
    window.postMessage({ type: 'BAMBOO_COVER_LETTER', payload: cover_letter_draft }, '*')
    chrome.storage.local.remove(['cover_letter_draft'])
  }
})
```

The draft is cleared immediately after posting to avoid stale data if the user opens the page again later.

### Cover letter API — formatting update (`/api/extension/cover-letter/route.ts`)

The system prompt is updated to instruct the AI to output a properly formatted business letter:

```
Format the letter as a standard business letter:
- Candidate name, address, email, phone (from profile)
- Date (today's date)
- Company name and address (infer from your knowledge; if unknown, use just the company name)
- Salutation
- Body (3–4 paragraphs)
- Closing and candidate name
Return only the formatted letter text, no markdown.
```

### Web app — `/cover-letter/page.tsx` (new page)

Client component. On mount, adds a `message` event listener waiting for `{ type: 'BAMBOO_COVER_LETTER' }`.

- **Loading state:** spinner + "Loading your cover letter…"
- **Loaded state:**
  - Header: Bamboo logo, job title · company name, "Download PDF" button.
  - Full-width editable `<textarea>` pre-populated with the cover letter text. User can freely edit before downloading.
  - "Download PDF" calls `window.print()`. Print CSS hides everything except the textarea content, sets 1-inch margins, Times New Roman 12pt — standard letter formatting.
- **Timeout (5 s):** if no postMessage arrives, shows "Could not load cover letter — please try again from the extension."

No authentication required on this page.

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/profiles/[id]/resume/route.ts` | New — PUT / GET / DELETE |
| `src/app/(app)/profiles/[id]/profile-form.tsx` | Add Resume upload section above Cover Letter Instructions |
| `src/app/cover-letter/page.tsx` | New — cover letter editor page |
| `src/app/api/extension/cover-letter/route.ts` | Update system prompt to include business letter formatting |
| `chrome-extension/manifest.json` | Add `tabs` permission; add `cover-letter-bridge.js` content script for jobbamboo.com |
| `chrome-extension/cover-letter-bridge.js` | New — reads `cover_letter_draft` from storage, postMessages to page |
| `chrome-extension/background.js` | Add `OPEN_COVER_LETTER` and `GET_RESUME` message handlers |
| `chrome-extension/content.js` | Replace cover letter toggle with standalone button; remove inline cover letter generation from `handleFill()`; add resume injection in `handleFill()` |
