# AI Job Agent — Plan

## Context
JobBamboo is the class final project. It needs an **agentic AI component** (this plan) and later a **paywall** (separate plan). Today the app scrapes 500+ Greenhouse/Ashby boards every 20 min (`src/app/api/cron/scrape/route.ts`) and emails keyword matches (`src/lib/email.ts`). Goal: recreate Giulio's personal job-scout workflow for every student:

1. Student uploads all their resumes → Claude builds one **career profile** (a master content library, same shape the `resume-tailor` skill uses) that the student can view on its own page.
2. A scheduled **agent** looks at new jobs from the existing Greenhouse/Ashby catalog **plus LinkedIn and Indeed** (found with free, no-token search: LinkedIn's public guest jobs API + DuckDuckGo HTML search), decides which are a real fit, and explains why.
3. Matches are emailed, each with a **tailored resume** built with the `resume-tailor` skill's rules (only true facts, one page, ATS-safe).
4. Schedule: **every 12 h on free, every hour on paid** (adds a `plan` column now; payment comes with the paywall work).

Note: `/superpowers` isn't installed in this session, so I'll follow the repo's existing superpowers convention instead: write the spec and plan to `docs/superpowers/specs/2026-10-19-ai-job-agent-design.md` and `docs/superpowers/plans/2026-10-19-ai-job-agent.md` as the first commit.

## Decisions (from Q&A)
- LLM: **Claude** via `@anthropic-ai/sdk` (new dep), `claude-opus-5-5`, one `MODEL` constant in `src/lib/ai/claude.ts`. Matching runs at `effort: "low"`, the profile builder and the resume tailor at `"medium"`. The existing DeepSeek extension routes stay as they are.
- Search: LinkedIn guest API + DuckDuckGo `site:indeed.com/viewjob` queries, parsed with `cheerio` (already a dependency). No keys, no tokens.
- Resume file: **DOCX**. `resume-tailor` produces a Word file, so I'll port its `build_resume.py` layout (Letter, 0.5" margins, Calibri, black, single column, right-aligned dates) to the `docx` npm package. This replaces the PDF answer; say if you'd rather have PDF.

## Data model — `supabase/migration_ai_agent.sql` (new)
- `career_profiles` — `user_id` (unique), `profile jsonb`, `resume_paths text[]`, `agent_enabled bool default true`, `send_resumes bool default true`, `last_agent_run_at timestamptz`, timestamps. RLS: own row only (pattern from `schema.sql`).
- `user_settings.plan text default 'free' check in ('free','pro')`.
- `agent_matches` — `user_id`, `url`, `title`, `company`, `location`, `source` ('greenhouse'|'ashby'|'linkedin'|'indeed'), `score int`, `reason text`, `resume_path text`, `created_at`, `unique(user_id, url)`. Prevents duplicate emails. RLS select own.
- Resumes go in the existing private `resumes` bucket under `{user_id}/career/…`, tailored ones under `{user_id}/tailored/…`.

Profile JSON (shape follows the skill's master library): `contact`, `target_titles[]`, `locations[]`, `education[]`, `skills{group: string[]}`, `entries[]` (`id`, `org`, `role`, `dates`, `tags[]`, `facts[]`, `angles[]`, `stars 1-3`), `projects[]` (same shape), `seniority`, `search_keywords[]`. Typed in `src/lib/types.ts`, validated with a Zod schema (zod is a new dep, needed by the SDK helpers).

## New code
**`src/lib/ai/claude.ts`** — `new Anthropic()`, `MODEL`, a small `parseJson(schema, system, content, effort)` helper around `client.messages.parse` + `zodOutputFormat` that checks `stop_reason` (refusal / max_tokens).

**`src/lib/ai/profile-builder.ts`** — `buildCareerProfile(pdfBuffers)`: sends every resume as a base64 `document` block in one request, uses structured output with the profile schema. The system prompt says: merge duplicates across resumes, keep numbers exactly as written, never invent, rate entries by strength, and write 2–3 angles per entry.

**`src/lib/search/linkedin.ts`** — `searchLinkedIn(keywords, location, hours)` → GET `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=…&location=…&f_TPR=r{secs}`, cheerio-parse cards (title, company, location, url, posted). `fetchLinkedInJob(id)` → `jobs-guest/jobs/api/jobPosting/{id}` description text.
**`src/lib/search/web.ts`** — `searchWeb(query)` → POST `https://html.duckduckgo.com/html/`, parse `.result__a` / `.result__snippet`; `fetchPageText(url)` → cheerio text, capped at ~6k chars. Indeed is reached through `searchWeb('site:indeed.com/viewjob "<title>" <location>')`.

**`src/lib/ai/job-agent.ts`** — `runJobAgent(profile, catalogJobs)` uses the SDK **Tool Runner** (`client.beta.messages.toolRunner` + `betaZodTool`). This is the agentic part. Tools:
- `list_catalog_jobs()` — Greenhouse/Ashby jobs from `jobs` since the last run. Code pre-filters them against `profile.target_titles`/`search_keywords` plus `isUSLocation`/`matchesJobType` (reused from `src/lib/job-utils.ts`), capped at 60.
- `search_linkedin(keywords, location)`
- `search_web(query)` (for Indeed and anything else)
- `read_job(url)` — the full description, so it can check requirements before matching
- `save_match(url, title, company, location, source, score, reason)` — collects matches in memory (score ≥ 75, max 5 per run)
The system prompt tells it to pick searches from the profile, read promising postings, match only on real fit (seniority, must-haves, location), and stop once it has done its searches. Hard caps: max ~15 tool iterations, plus `excludeUrls` (already-matched URLs) passed in.

**`src/lib/ai/resume-tailor.ts`** — a port of the `resume-tailor` skill to a non-interactive run. The system prompt carries the skill's rules verbatim: only true facts from the profile, select and re-frame, group entries into roles, pick the title the bullets earn, keep in-development work in present tense, no em dashes, no summary, one page, bullet format action → number → context. It runs the skill's review lenses (keywords → 6-second scan → narrative → **truthfulness gate last**) as instructions in a single call. Structured output = the skill's `content.json` schema. Then `renderResumeDocx(content)` → Buffer, using the `docx` package (new dep) with the skill's layout. One page is enforced with a bullet budget (≤ ~14 bullets total, ≤ 2 lines each), because there's no LibreOffice on Vercel.

**`src/lib/email.ts`** — add `sendAgentMatchEmail(to, matches, attachments)`: same HTML style as `sendJobNotificationEmail`, with the reason per job, and Resend `attachments: [{ filename, content }]`.

## Routes
- `POST /api/career-profile/resumes` (multipart, PDF ≤ 5 MB, up to 5 files) → upload to storage. `DELETE …?path=`. Same auth pattern as `src/app/api/profiles/[id]/resume/route.ts`.
- `POST /api/career-profile/build` → downloads the stored PDFs, `buildCareerProfile`, upserts `career_profiles.profile`. `PATCH /api/career-profile` → edit the profile JSON and toggles.
- `GET /api/cron/agent?secret=` (`maxDuration = 300`), called **hourly** from cron-job.org like the existing scraper. It picks due users: `agent_enabled` and (`plan='pro'` or `last_agent_run_at` older than 12 h), oldest first, max ~5 per call. For each user: `runJobAgent` → insert `agent_matches` → (if `send_resumes`) tailor + upload DOCX for each match → email → set `last_agent_run_at`. Errors are logged per user and the loop keeps going.
- `POST /api/career-profile/run-now` — runs the agent once for the current user, for the demo.

## UI
- Sidebar (`src/components/layout/sidebar.tsx`): add **"AI Profile"** → `/career-profile` (`Sparkles` icon).
- `src/app/(app)/career-profile/page.tsx` (server, loads the row) + `career-profile-client.tsx`:
  1. Resumes: drag-and-drop/multi-file upload list, then a "Build profile with AI" button.
  2. Profile view: target titles, skills chips, experience/project entries with facts and stars. A simple "Edit JSON" textarea stays for v1.
  3. Agent card: on/off, "attach tailored resume", plan badge (Free: every 12 h / Pro: hourly), "Run now".
  4. Recent matches: score, reason, link, download for the tailored resume (signed URL).
- Reuse `Card`, `Button`, `Badge` from `src/components/ui/`.

## Env / docs
`ANTHROPIC_API_KEY` added to the README env list, plus the cron-job.org entry for `/api/cron/agent` hourly. New deps: `@anthropic-ai/sdk`, `zod`, `docx`.

## Verification
1. `npm run lint` and `npx tsc --noEmit` (no test suite in the repo).
2. Search tools: a small `scripts/try-search.mjs` hits `searchLinkedIn("data analyst","Los Angeles",24)` and `searchWeb('site:indeed.com/viewjob "data analyst" Los Angeles')` and prints the parsed results (checks the HTML selectors from this container; LinkedIn/DDG may rate-limit, and the plan handles empty results).
3. With `ANTHROPIC_API_KEY` set: `npm run dev`, upload two sample resume PDFs, build the profile, and check that the profile renders and has no invented facts.
4. Click "Run now": `agent_matches` rows appear, the email arrives through Resend with the DOCX attached, and the DOCX opens on one page in Word/LibreOffice (`libreoffice --headless --convert-to pdf` + `pdfinfo` locally).
5. Hit `/api/cron/agent?secret=…` twice: the second call skips a free user (< 12 h) and re-runs a user flipped to `plan='pro'`.
6. Commit and push to `claude/wizardly-davinci-mffe4z`.
