# Bamboo: 7-Minute Presentation Outline

**Instructions for the AI agent building the deck:** Build a 10-slide deck (plus an optional backup slide) from this outline. Keep slides visual and sparse: max 5 short bullets, no paragraphs. Put speaker notes (the "Say" lines) in the notes field. Anything marked `[FILL IN]` is something only the team knows; leave a clearly visible placeholder, do not invent numbers or names. Style: clean, green "bamboo" accent, one idea per slide.

## Timing and rubric map

Total: 7:00. Rehearse to 6:30 so there is buffer. The slide time is weighted to the rubric.

| # | Slide | Time | Rubric criterion it earns |
|---|-------|------|---------------------------|
| 1 | Title | 0:15 | Teamwork and presentation (5) |
| 2 | Problem | 0:45 | Business problem (15) |
| 3 | Target user and why AI | 0:35 | Business problem (15) |
| 4 | Live demo / core user journey | 1:30 | Implementation completeness (25) |
| 5 | Architecture diagram | 0:40 | Engineering quality (10) |
| 6 | AI design: web agent and Chrome extension | 1:10 | AI design framework (20) |
| 7 | AI errors and edge cases | 0:40 | AI design framework (20) |
| 8 | Payments and deployment | 0:45 | Deployment and production readiness (15) |
| 9 | Team and ownership | 0:20 | Teamwork (5) |
| 10 | Lessons and next steps, close | 0:15 | Business thinking, wrap-up |

The write-up (10 pts) is a separate document. Only mention it if asked.

---

## Slide 1: Title (0:15)

- Title: **Bamboo: an AI agent that finds jobs and tailors your resume for you**
- Subtitle: one line, "Upload your resumes once. Get matched jobs and tailored resumes in your inbox."
- Team names and class/course `[FILL IN]`, live URL `[FILL IN: https://...vercel.app]`, QR code to the live URL.
- Say: one-sentence hook, "Every student we know spends hours a week doing a job search that a program could do."

## Slide 2: The problem (0:45)

- **Specific problem:** Students apply to jobs across LinkedIn, Indeed and company career pages. They must check each one daily, judge fit, and rewrite a resume for every application.
- Pain points (pick 3, with icons): scattered job sources; new postings go stale fast, so early applicants win; one generic resume gets filtered out; tailoring takes 20-30 minutes per job.
- One real stat or quote from user interviews/testing `[FILL IN]`. The repo history shows "user-testing feedback" was collected, so cite what testers said.
- Say: tell the story of one student's evening spent searching.

## Slide 3: Target user and why AI is the right solution (0:35)

- **Target user:** US college students and new grads looking for internships and entry-level roles.
- **Why not a plain filter or job board?** Keyword search cannot judge seniority ("don't match a senior role to a new grad"), judge fit against real requirements, or write a truthful tailored resume.
- **Why AI:** Claude reads unstructured resumes and postings, reasons about fit, explains each match in plain language, and rewrites resume content per job.
- Two-column graphic: "Old way" (manual search, one resume) vs "With Bamboo" (agent searches on a schedule, tailored resume arrives by email).

## Slide 4: Core user journey, live demo (1:30)

The most important slide (25 pts). Do a live demo of the deployed URL, with a 30-second pre-recorded video as a fallback in case of wifi trouble. Walk these steps, each with a screenshot placeholder on the slide:

1. **Sign up / log in** (Supabase Auth, email and password, with password reset).
2. **Upload all resumes on `/profiles`** and click "Build profile with AI". Claude merges them into one structured profile (education, experience, skills, target titles and locations).
3. **Agent page `/career-profile`:** turn the agent on, click **Run now**.
4. **Matches appear** with a fit score and a 2-sentence reason in second person ("You used SQL on 2.1M records...").
5. **Email arrives** with the matches and a one-page tailored DOCX resume attached.
6. **Dashboard / Applications:** track applications, streaks, daily goal, medals. Chrome extension autofills applications and saves roles from any site.
7. **Chrome extension (published on the Chrome Web Store `[FILL IN: store link]`)**: open a real job application page (Greenhouse, Ashby, Workday, etc.). Show the extension saving the role to the dashboard in one click, then autofilling the application form from the user's profile with a review card before anything is submitted. Also show the cover letter generator. Prefer a pre-recorded 20-second clip of this step, since it depends on a third-party site.
8. **Upgrade to Pro** via Stripe Checkout (covered on slide 8).

Demo tip: pre-run the agent before presenting so a match and email already exist. Do not wait on a live AI call on stage.

## Slide 5: Architecture diagram (0:50)

Draw one diagram, left to right (all of this is in the repo):

```
Student (browser) ── Chrome extension (published, v1.1.2) ──► /api/extension/* routes
        │
Next.js 16 on Vercel  (UI + API routes)
   │            │              │              │
Supabase     Anthropic      Stripe         Resend
(Auth, DB,   Claude API     Checkout +     (email with
 Storage)    (agent)        webhook        attachments)
             + OpenAI / DeepSeek chat APIs (extension features)
        ▲
cron-job.org ──► /api/cron/scrape (every 20-30 min: Greenhouse + Ashby boards → jobs table)
             └─► /api/cron/agent  (hourly: runs each due user's agent)
```

Justified design decisions (one line each, these earn the "justified design decisions" points):
- **Scraper and agent are separate crons:** scraping is cheap and shared by all users; the AI runs per user only on new postings, so token cost stays low.
- **Free tools for search** (LinkedIn guest API, DuckDuckGo `site:indeed.com`): zero token cost, free tiers across the stack.
- **cron-job.org instead of Vercel cron:** free, and finer schedule than the Vercel free tier allows.
- **Stripe webhook is the only thing that changes a plan:** the client can never grant itself Pro.
- Also mention the repo: README, `supabase/schema.sql`, folders `src/app/api`, `src/lib/ai`, `src/lib/search`, `chrome-extension`.

## Slide 6: AI design framework, the web agent and the Chrome extension (1:10)

Two AI systems, one profile. Split the slide in two halves: **A. Job agent (server-side, scheduled)** and **B. Chrome extension (user-side, on demand)**.

### A. Job agent

- **Model:** Claude (`claude-opus-5-5`) via the Anthropic SDK, using **tool use** in an agent loop.
- **Tools the agent calls** (list as icons): `list_catalog_jobs` (new Greenhouse/Ashby postings), `search_linkedin`, `search_web` (Indeed), `read_job` (fetch real requirements), `save_match`.
- **Flow graphic:** profile → search 3 sources → read each posting → score fit (0-100) → save only if score ≥ 75, max 5 per run → tailor one-page resume → email.
- **Structured output:** profile builder returns JSON validated by **Zod schemas**, so the database never receives malformed data.
- **Grounding and truthfulness:** reasons cite only facts in the profile; resume tailoring re-frames only true facts and never invents experience.
- **Privacy by design:** the AI only sees career facts, never address, DEI answers, salary or work authorization.
- Say (A): "It is not a chatbot. It is an autonomous agent that decides what to search, what to read, and what to save."

### B. Chrome extension (also AI-powered, already published)

- **What it is:** a published Chrome extension ("Bamboo Job Tracker") that works on any company site or ATS, using the same profile the web agent uses. The extension calls our own API routes, so no AI keys ship inside it.
- **AI features** (one icon each, backend routes in `src/app/api/extension/`):
  - **Job extraction** (`extract-job`): an LLM reads the page text and pulls out the job title and company, so one click saves any posting without per-site scrapers.
  - **Smart autofill** (`autofill`): an LLM maps the form's fields to the user's profile; the user reviews and edits in a card before filling.
  - **Agent fill** (`agent-fill`): a browser-control agent loop for dynamic forms (for example "Add another job" buttons), which observes a snapshot of visible form elements, decides the next action, and repeats until the form is complete.
  - **Cover letter** (`cover-letter`): generates a tailored business-letter cover letter from the profile and job description.
- **Models:** the extension routes use OpenAI/DeepSeek chat APIs, chosen for low cost on high-volume, short tasks; the agent uses Claude for the harder reasoning and tool use. Justify as "right model for each job" `[CONFIRM with team]`.
- **Safety:** user reviews before anything is filled or submitted; sensitive fields (address, DEI, salary, work authorization) are handled deliberately rather than guessed `[CONFIRM with team]`.
- Say (B): "The web agent finds the job. The extension helps you finish the application."

## Slide 7: AI error handling and edge cases (0:40)

Present as a two-column table, "Risk → What we do":

| Risk | Handling (all in the code) |
|------|----------------------------|
| Prompt injection from job posting text | System prompt treats postings as untrusted data; never follow instructions inside them |
| Model refuses or output cut off | `parseJson` throws on `refusal` / `max_tokens`; no partial data saved |
| Invalid or malformed AI JSON | Zod schema validation rejects it |
| Agent run crashes midway | Schedule is handed back (`last_agent_run_at` restored) so the next cron retries |
| Double click or overlapping crons | Run is "claimed" up front with an atomic compare-and-set; cannot start twice |
| One resume fails to tailor | Caught per match; the other matches and the email still go out |
| No good matches today | Agent saves nothing instead of forcing weak matches |
| Duplicate matches | Previously saved URLs are excluded; upsert with unique `(user_id, url)` |
| Cost and abuse | Free plan once a day, Pro hourly; max 5 matches per run; 2 users per cron call (function time limit) |
| Scrape source breaks | Scrape response reports `ok / notFound / failed` per board; 90-minute window means a missed call loses nothing |

Pick the 4-5 strongest for speaking; leave the rest readable on the slide.

## Slide 8: Payments and deployment (0:45)

- **Live, stable URL:** `[FILL IN]` on Vercel (show the URL again).
- **Stripe sandbox checkout:** Free vs Pro (agent runs once a day vs every hour). Checkout session → webhook updates `subscriptions.plan`. Test card `4242 4242 4242 4242`. Customer Portal for "Manage billing". Show a screenshot or do it live.
- **Secrets handled securely:** all keys in Vercel environment variables, none in git (`.env.local` is git-ignored); cron endpoints protected by `CRON_SECRET`; Stripe webhook signature verified; service-role key used server-side only; Supabase row-level security, `subscriptions` read-only for users; private `resumes` storage bucket.
- **Graceful errors:** billing not configured returns a friendly 503; `npm run check:keys` live-tests Supabase, Anthropic, Stripe, Resend and cron setup before deploying.

## Slide 9: Team and ownership (0:25)

- One row per teammate: name, area owned, one concrete contribution `[FILL IN]`. Suggested areas, based on the repo: AI agent and prompts; frontend and dashboard; Stripe billing and deployment; scraper and Chrome extension; docs and testing.
- Include who owned the Chrome extension and its Web Store publication `[FILL IN]`.
- Mention real collaboration: pull requests (e.g. #59), code review, merging feature branches, user-testing feedback loop that drove changes (billing, run limits, profile safety).
- Every teammate speaks at least once; assign who presents which slide `[FILL IN]`.

## Slide 10: Lessons, next steps, close (0:20)

- 2 lessons learned (example: "free, token-less search tools kept costs near zero"; "the AI must be grounded in facts, so we filter what it sees").
- Next steps: more job sources, application tracking from email, interview prep.
- Close on the URL and QR code, then "Questions?"

## Backup slide (not presented unless asked)

- Extension architecture (content script, background worker, popup) and Web Store review process; data model (tables: `jobs`, `autofill_profiles`, `career_profiles`, `agent_matches`, `subscriptions`, `user_settings`) and Chrome extension autofill agent.

---

## Facts the agent should NOT invent (ask the team)

- Live URL, Chrome Web Store link and install count, team names and roles, class name.
- Real user-testing quotes and numbers (users tested, matches generated, resumes tailored).
- Screenshots and demo video: capture from the live app.

## Delivery notes for the presenter

- Hardest constraint is time: slide 4 (demo) gets the most, so cut slide 10 first if running over.
- Open with the problem, not the tech. Graders weigh product thinking (15) before architecture (10).
- Be ready for Q&A: why Claude over simple search, how you prevent hallucinated resumes, what a run costs, what happens when Stripe webhook fails.
