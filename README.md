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

### 3. Stripe (Pro subscription)

1. Create an account at [stripe.com](https://stripe.com) and stay in **Test mode** while setting up
2. Run `supabase/migration_billing.sql` in the Supabase SQL editor
3. **Product catalog → Add product**: name it "Pro", give it a monthly recurring price, and copy the price ID (`price_...`)
4. **Developers → API keys**: copy the secret key (`sk_test_...`)
5. **Settings → Billing → Customer portal**: click **Activate** so users can cancel or change their card
6. **Developers → Webhooks → Add endpoint**:
   - URL: `https://your-app.vercel.app/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the signing secret (`whsec_...`)
7. Test locally with the [Stripe CLI](https://stripe.com/docs/stripe-cli):
   `stripe listen --forward-to localhost:3000/api/stripe/webhook` (it prints a local `whsec_...` to use instead), then pay with card `4242 4242 4242 4242`

Paying sets `billing.is_pro = true` for the user; cancelling sets it back to `false`.

### 4. Environment variables

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
CRON_SECRET=any-random-string-you-choose
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 5. Deploy to Vercel

```bash
npx vercel --prod
```

Add all environment variables in the Vercel dashboard.

### 6. Set up cron (free via cron-job.org)

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
