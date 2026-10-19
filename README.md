# JobFinder — LinkedIn Job Tracker

A web app that scrapes LinkedIn for new jobs every 30 minutes and notifies you via email.

## Stack (all free tiers)

| Service | Purpose |
|---------|---------|
| Next.js 14 | Frontend + API routes |
| Supabase | Database + Auth |
| Resend | Email notifications (100/day free) |
| Vercel | Hosting |
| cron-job.org | Free cron trigger (every 30 min) |

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

### 5. Set up cron (free via cron-job.org)

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create a cron job:
   - URL: `https://your-app.vercel.app/api/cron/scrape?secret=YOUR_CRON_SECRET`
   - Schedule: every 30 minutes
3. This is free and unlimited

> If you have Vercel Pro, the `vercel.json` cron config already handles this.

## Local development

```bash
npm install
npm run dev
```

## Pages

- **`/dashboard`** — Stats overview: applications, recent notifications
- **`/jobs`** — Jobs found in the last 24 hours + manual scan button
- **`/applications`** — Track applications (applied / interview / offer / rejected)
- **`/settings`** — Keywords, location, email preferences, LinkedIn URL preview

## How scraping works

1. Cron hits `/api/cron/scrape` every 30 min
2. Reads each user's settings (keywords, location, time window)
3. Fetches LinkedIn's public guest jobs API with `f_TPR=r1800` (last 30 min)
4. Saves new jobs to Supabase, skipping duplicates via `linkedin_id`
5. Notifies users only about jobs they haven't seen before

## AI job agent

Students upload resumes at `/career-profile`; Claude builds a career profile. A scheduled agent
(`/api/cron/agent?secret=...`, call it **hourly** from cron-job.org) then searches the Greenhouse/Ashby
catalog, LinkedIn (public guest API) and Indeed (DuckDuckGo `site:` search) with free, zero-token search
tools, saves strong matches, tailors a one-page DOCX resume for each, and emails them.
Free users run every 12 hours, Pro users every hour (`user_settings.plan`).
Run `supabase/migration_ai_agent.sql` to create the tables.

## Billing (Stripe)

1. In Stripe, create a product "Bamboo Pro" with a recurring monthly price and copy its `price_...` id into `STRIPE_PRICE_ID`.
2. Put your API secret key in `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint `https://your-app.vercel.app/api/billing/webhook` for the events
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Enable the Customer Portal in Stripe settings so "Manage billing" works.

Use Stripe test mode and the card `4242 4242 4242 4242` to try it. The webhook is the only thing that
changes a user's plan (table `subscriptions`, read-only for users).
