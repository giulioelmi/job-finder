# Autofill Improvements — Design Spec
**Date:** 2026-05-14

## Overview

Five improvements to the Bamboo Chrome extension autofill feature, identified from real-world testing:

1. Answer "how did you hear about us" questions
2. Support custom (non-native) dropdown menus
3. Keep the autofill widget open across multi-page application flows
4. Automatically attach the user's resume
5. Generate cover letters from the original job description page, not the application form

---

## 1. Data Layer

### DB migrations (`autofill_profiles` table)

| Column | Type | Default | Purpose |
|---|---|---|---|
| `referral_source` | `text` | `null` | Default answer for "how did you hear about us" questions |
| `resume_url` | `text` | `null` | Supabase Storage path for the user's uploaded resume |

### TypeScript (`src/lib/types.ts`)

Add to `AutofillProfile`:
```ts
referral_source: string | null
resume_url: string | null
```

### Supabase Storage

- Bucket: `resumes` (private)
- Path pattern: `{user_id}/{profile_id}/resume.{ext}`
- The web app API handles all Storage access; the extension never calls Storage directly

---

## 2. "How Did You Hear About Us"

### `serializeProfile()` in `autofill/route.ts`

Add line:
```
Referral source (how did you hear about us): ${p.referral_source}
```

### System prompt addition

```
- For "how did you hear about" / "how did you find this role" / "how did you learn about this position" questions, use the referral_source field.
```

### Web app — profile editor

Add a single text input labeled **"How did you hear about us (default answer)"** (e.g. `"LinkedIn"`, `"Company website"`, `"Referred by a friend"`).

---

## 3. Custom Dropdown Support

Targets `[role="combobox"]` + `[role="listbox"]` + `[role="option"]` patterns used by Workday, Lever, Ashby, and similar ATSes.

### `scanFormFields()` in `content.js`

After the existing native-element pass, add a second pass:
- Query all visible `[role="combobox"]` not already covered by a native `<select>`
- Record `type: "combobox"`, label via `getFieldLabel()`
- Attempt to pre-read options from the element referenced by `aria-controls`, or from a nearby `[role="listbox"]` → `[role="option"]` descendants
- If options are not yet visible, send `options: []` — the LLM will match on label alone

### `fillFormFields()` in `content.js` — becomes async

New branch for `type === "combobox"`:
1. Click the trigger element to open the dropdown
2. Poll for `[role="option"]` to appear (max 800 ms, 50 ms intervals)
3. Find option whose `textContent` matches `value` (case-insensitive; partial match as fallback)
4. Click matching option
5. If no option found: type `value` into the combobox input and press Enter (handles autocomplete-style fields like Workday city/state)

`handleFill()` already `await`s fill, so making `fillFormFields` async is a clean change.

---

## 4. Stay Open Across Pages

### New storage key: `autofill_session`

```js
{
  profileId: string,
  editedFields: Record<string, string>,
  savedAt: number   // TTL: 30 min, matching active_job
}
```

### Lifecycle

| Event | Action |
|---|---|
| User selects profile → clicks "Next →" | Write `autofill_session` |
| User edits a field in review card | Update `autofill_session.editedFields` |
| User clicks × (dismiss) | Clear `autofill_session` |
| Autofill reaches "done" state | Clear `autofill_session` |
| Confirmation page detected | Clear `autofill_session` |

### On page init (continuation pages)

After `getActiveJob()` resolves and the page is identified as a continuation:
1. Call `getAutofillSession()`
2. If valid session exists:
   - Send `GET_PROFILES` to fetch profiles (or reuse cached)
   - Find profile by `profileId`
   - Restore `selectedProfile`, `editedFields`, `autofillStep = 'review'`
   - Set `expanded = true`
3. Widget renders directly into the review card — user just clicks "Fill form ✓"

---

## 5. Cover Letter from Job Landing Page

### `setActiveJob()` in `content.js`

Store the filtered page content alongside job metadata:
```js
active_job: {
  title, company, url, origin, extractedAt,
  jobDescription: filterPageForLLM()   // ← new field
}
```

### `handleFill()` in `content.js`

When generating a cover letter, use `active_job.jobDescription` if present; fall back to `filterPageForLLM()` on the current page only when nothing is stored. This ensures the cover letter is always based on the actual job description, even when the user is 3 pages deep in a multi-step form.

---

## 6. Resume Attachment

### Web app — upload API (`/api/profiles/[id]/resume`)

- `PUT`: accepts `multipart/form-data` with a `file` field (`.pdf`, `.doc`, `.docx`). Uploads to Supabase Storage at `resumes/{user_id}/{profile_id}/resume.{ext}`, saves path as `resume_url` on the profile row. Returns `{ resume_url }`.
- `GET`: returns a short-lived signed URL (e.g. 1 hour) for the stored file.
- `DELETE`: removes the file from Storage and clears `resume_url` on the profile.

### Web app — profile editor UI

File input (accept `.pdf,.doc,.docx`) labeled **"Resume"**. On upload shows filename + "Remove" link. Uses the PUT endpoint above.

### `background.js` — new message handler `GET_RESUME`

```js
// message: { type: 'GET_RESUME', data: { profileId } }
// Calls GET /api/profiles/{profileId}/resume → signed URL
// Fetches the file, converts to base64
// Responds: { base64: string, mimeType: string, filename: string }
```

### `content.js` — file injection in `handleFill()`

After the standard field fill:
1. Query `input[type="file"]` whose label (via `getFieldLabel()`) contains `resume`, `cv`, or `upload`
2. If found and `selectedProfile.resume_url` is set:
   - Send `GET_RESUME` to background
   - Convert `base64` → `Uint8Array` → `Blob` → `File`
   - Inject via DataTransfer:
     ```js
     const dt = new DataTransfer()
     dt.items.add(new File([blob], filename, { type: mimeType }))
     input.files = dt.files
     input.dispatchEvent(new Event('change', { bubbles: true }))
     ```
   - Increment `filledCount`; show "resume attached" in the done card

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/types.ts` | Add `referral_source`, `resume_url` to `AutofillProfile` |
| `src/app/api/extension/autofill/route.ts` | `serializeProfile` + system prompt |
| `src/app/api/profiles/[id]/resume/route.ts` | New — PUT / GET / DELETE |
| Web app profile editor page | `referral_source` text input + resume file upload |
| `chrome-extension/content.js` | Custom dropdowns, stay-open, cover letter cache, resume injection |
| `chrome-extension/background.js` | `GET_RESUME` handler |
| Supabase migration | Add `referral_source`, `resume_url` columns |
