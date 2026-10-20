# Bamboo: AI job search agent

Students upload all their resumes; Claude builds one profile (saved in **Profiles**). An AI agent then
searches Greenhouse and Ashby company boards, LinkedIn and Indeed on a schedule, picks the jobs that fit,
and emails them with a tailored one-page resume. Free runs once a day, Pro every hour.

## Stack (all free tiers)

| Service | Purpose |
|---------|---------|
| Next.js 16 | Frontend + API routes |
| Supabase | Database + Auth |
| Resend | Email notifications (100/day free) |
| Vercel | Hosting |
| cron-job.org | Free cron triggers (scraper and agent) |

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL editor
3. Copy your URL, anon key, and service role key

### 2. Resend

1. Create an account at [resend.com](https://resend.com)
2. Add and verify your sending domain
3. Create an API key

### 3. Environment variables

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
CRON_SECRET=any-random-string-you-choose
ANTHROPIC_API_KEY=            # AI job agent (Claude)
STRIPE_SECRET_KEY=            # Pro plan billing
STRIPE_PRICE_ID=              # price_... of the monthly Pro subscription
STRIPE_WEBHOOK_SECRET=        # whsec_... of the /api/billing/webhook endpoint
NEXT_PUBLIC_PRO_PRICE=        # optional label shown next to Pro, e.g. "$9/month"
```

### 4. Deploy to Vercel

```bash
npx vercel --prod
```

Add all environment variables in the Vercel dashboard.

### 5. Set up the crons (free via cron-job.org)

`vercel.json` has no cron config, so both jobs are scheduled externally. Create two cron-job.org jobs:

| URL | Schedule | What it does |
|-----|----------|--------------|
| `https://your-app.vercel.app/api/cron/scrape?secret=YOUR_CRON_SECRET` | every 20-30 min | Fetches new postings from every Greenhouse/Ashby board into the `jobs` table (no emails) |
| `https://your-app.vercel.app/api/cron/agent?secret=YOUR_CRON_SECRET` | every hour | Runs each due user's agent: Pro users every hour, Free users once a day |

The scrape response lists `boards` (`ok`, `notFound`, `failed`), so a broken board API shows up in cron-job.org's history.
The scrape window is 90 minutes, so one missed call loses nothing. The agent cron runs 2 users per call
(Vercel's function time limit), taking the longest-waiting users first.

## Local development

```bash
npm install
npm run dev
```

## Pages

- **`/dashboard`**: stats (applications, agent matches, interviews, offers) and weekly activity
- **`/career-profile`** (sidebar "AI Agent"): agent on/off, run now, plan and billing, recent matches with tailored resumes
- **`/profiles`**: upload ALL your resumes, build your profile with AI, edit profiles (the extension autofills applications from them)
- **`/applications`**, **`/networking`**: track applications and contacts
- **`/settings`**: where the agent's match emails go

## AI job agent

Students upload **all** their resumes on `/profiles` and Claude builds one profile from them (saved as a
profile marked "used by your AI agent"; a rebuild only replaces what the AI fills in, never what the user typed).
The scheduled agent (`/api/cron/agent`) then reads new Greenhouse/Ashby postings from the `jobs` table, searches
LinkedIn (public guest API) and Indeed (DuckDuckGo `site:` search) with free, zero-token search tools, saves strong
matches, tailors a one-page DOCX resume for each, and emails them. Free users run once a day, Pro users every
hour (`subscriptions.plan`). The AI only sees career facts: never address, DEI answers, salary or work authorization.

Run these in the Supabase SQL editor, in order: `supabase/migration_ai_agent.sql`, then
`supabase/migration_agent_profile.sql`. Also create a private storage bucket named `resumes`.

## Billing (Stripe)

1. In Stripe, create a product "Bamboo Pro" with a recurring monthly price and copy its `price_...` id into `STRIPE_PRICE_ID`.
2. Put your API secret key in `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint `https://your-app.vercel.app/api/billing/webhook` for the events
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Enable the Customer Portal in Stripe settings so "Manage billing" works.

Check all keys at once with `npm run check:keys` (reads `.env.local`).

Use Stripe test mode and the card `4242 4242 4242 4242` to try it. The webhook is the only thing that
changes a user's plan (table `subscriptions`, read-only for users).
