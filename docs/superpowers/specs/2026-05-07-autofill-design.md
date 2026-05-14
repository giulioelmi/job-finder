# Autofill Feature Design

**Date:** 2026-05-07
**Status:** Approved

## Overview

Add an autofill capability to the Bamboo Chrome extension. When a user visits a job application page (Greenhouse, Lever, Workday, Ashby, etc.), they can click an Autofill button, select a saved profile, optionally generate a cover letter, and have the form filled automatically using DeepSeek for field mapping.

Profiles are created and managed on jobbamboo.com. The extension reads them at fill time and sends a form snapshot to a backend endpoint that uses DeepSeek to map form fields to profile values.

---

## Profile Data Model

A new `autofill_profiles` table in Supabase. Each user can have multiple profiles (e.g. one per role type: Data Scientist, Business Analyst, Product Manager). There is no default profile — the user always selects one explicitly.

### Schema

```sql
create table autofill_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null, -- e.g. "Data Scientist"

  -- Personal info
  first_name text,
  last_name text,
  email text,
  phone text,
  street_address text,
  city text,
  state text,
  zip_code text,
  country text,

  -- Online presence
  linkedin_url text,
  github_url text,
  portfolio_url text,
  website_url text,

  -- Work authorization
  authorized_to_work boolean,
  requires_sponsorship boolean,
  visa_type text,

  -- Compensation & availability
  desired_salary integer,
  salary_type text check (salary_type in ('hourly', 'yearly')),
  willing_to_relocate boolean,
  available_start_date text, -- free text, e.g. "2 weeks notice"

  -- DEI (all nullable; null = prefer not to say)
  gender text,
  pronouns text,
  ethnicity text,
  veteran_status text,
  disability_status text,

  -- Arrays (stored as JSONB)
  education jsonb default '[]',        -- [{school, degree, field_of_study, gpa, start_date, end_date}]
  work_experience jsonb default '[]',  -- [{company, title, start_date, end_date, current, description}]
  projects jsonb default '[]',         -- [{name, url, description, technologies}]
  skills text[],                       -- ["Python", "SQL", "Tableau"]
  custom_qa jsonb default '[]',        -- [{question, answer}] for recurring custom questions

  -- Cover letter
  cover_letter_prompt text,            -- user-written AI instructions

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table autofill_profiles enable row level security;
create policy "users own their profiles"
  on autofill_profiles for all
  using (user_id = auth.uid());
```

---

## jobbamboo.com Changes

### New Profiles Section in Settings

A new "Profiles" tab in the settings page at `/settings/profiles`. Users can:

- View all their profiles in a list
- Create a new profile (full structured form)
- Edit any profile
- Delete a profile

The profile form mirrors the schema above, with:
- Simple text/number inputs for personal info, online presence, authorization, compensation, DEI
- Dynamic list editors for education, work experience, projects (add / remove entries)
- Tag input for skills
- Dynamic list for custom Q&A pairs
- Textarea for the cover letter prompt with placeholder instructions

### New API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profiles` | List all profiles for the authenticated user |
| POST | `/api/profiles` | Create a new profile |
| PATCH | `/api/profiles/:id` | Update a profile |
| DELETE | `/api/profiles/:id` | Delete a profile |
| POST | `/api/extension/autofill` | Field mapping via DeepSeek |
| POST | `/api/extension/cover-letter` | Cover letter generation via DeepSeek |

All routes require a valid Bearer token (same auth pattern as existing extension endpoints).

---

## Extension Changes

### When Autofill Appears

The autofill flow is shown on the same pages where the job card already appears (i.e. `isJobPage()` returns true). The existing job card gets an "Autofill" button alongside "Mark as Applied".

### Three-Step Card Flow

**Step 1 — Profile picker**
- Fetches the user's profiles from `GET /api/profiles` on first open; result cached in `chrome.storage.local` with a 10-minute TTL (same pattern as `extract_cache`)
- Displays each profile as a selectable card showing name and email
- "Next →" advances to step 2

**Step 2 — Review & edit**
- Shows a scrollable list of all simple fields (name, email, phone, address, LinkedIn, GitHub, work auth, compensation, DEI) as editable inputs pre-filled from the profile
- Complex fields (work experience, education, projects) show a summary ("2 entries") with an "Edit on Bamboo ↗" link — inline editing deferred to a later iteration
- Cover letter toggle (default off): when enabled, the extension calls `/api/extension/cover-letter` before filling and pastes the result into the detected cover letter field
- "← Back" returns to step 1; "Fill form ✓" triggers filling

**Step 3 — Done**
- Shows a success state: number of fields filled, whether a cover letter was pasted
- "Mark as Applied" button to log the application in the normal flow
- "Minimize" to collapse the card

### DOM Scanner

Before calling the autofill API, the extension scans the form and extracts:
- All `<input>`, `<textarea>`, `<select>` elements that are visible and not disabled
- For each: a unique CSS selector, the element type, associated label text (via `<label for>`, `aria-label`, `placeholder`, or nearest sibling label), and for `<select>` all option values

This snapshot is serialized to a compact JSON array and sent to the backend.

### Field Filler

The API returns `{ fields: [{ selector: string, value: string }] }`. The extension walks the array and:
- For `<input type="text|email|phone|url|number">`: sets `.value` and dispatches `input` + `change` events (React / Vue frameworks require synthetic events)
- For `<input type="radio">` / `<select>`: matches the closest option value to the returned string and selects it
- For `<input type="checkbox">`: sets checked state based on a truthy value string
- For `<textarea>`: sets `.value` and dispatches events

Fields that cannot be matched are skipped silently; the user reviews before submitting.

---

## Backend API Design

### POST /api/extension/autofill

**Request:**
```json
{
  "profile_id": "uuid",
  "form_fields": [
    { "selector": "#first_name", "type": "text", "label": "First Name", "placeholder": "First name" },
    { "selector": "#gender", "type": "select", "label": "Gender", "options": ["Male", "Female", "Non-binary", "Prefer not to say"] }
  ],
  "job_title": "Data Scientist",
  "company": "Stripe"
}
```

**Backend flow:**
1. Verify auth token
2. Fetch profile from Supabase
3. Serialize profile to a compact text block
4. Call DeepSeek with a prompt that includes the form fields and profile data
5. Parse and return the field → value mapping

**Response:**
```json
{
  "fields": [
    { "selector": "#first_name", "value": "Giulio" },
    { "selector": "#gender", "value": "Prefer not to say" }
  ]
}
```

### POST /api/extension/cover-letter

**Request:**
```json
{
  "profile_id": "uuid",
  "job_title": "Data Scientist",
  "company": "Stripe",
  "job_context": "...",
  "custom_prompt": "Write in a confident tone, max 3 paragraphs, emphasize ML skills."
}
```

`job_context` is the same filtered page text produced by `filterPageForLLM()` — the same text already used for job extraction. The extension passes it directly without an extra extraction step.

**Response:**
```json
{
  "cover_letter": "Dear Hiring Manager,\n\n..."
}
```

---

## LLM Integration (DeepSeek)

Both endpoints use the DeepSeek API (cheap, capable model). The system prompt instructs the model to:
- Return only valid JSON, no prose
- Match dropdown options exactly to one of the provided option strings
- Leave a field's value as `null` if the profile has no relevant data for it (those entries are omitted from the response)
- For DEI fields with "prefer not to say" as an option, use the profile's stored value or default to that option if the field is null

The cover letter prompt combines the user's `cover_letter_prompt` (their custom instructions) with the job details and a serialized summary of their work experience, education, and projects.

---

## Manifest Changes

The extension manifest needs `host_permissions` expanded to include DeepSeek's API domain — but since all LLM calls go through the Bamboo backend (not directly from the extension), no manifest changes are required.

---

## Deferred (Phase 2)

- Inline editing of work experience, education, and projects directly within the extension card
- Resume PDF upload and attachment to file upload fields
- Field-fill confidence indicators (highlight fields the model was uncertain about)
