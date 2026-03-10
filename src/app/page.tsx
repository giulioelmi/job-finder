export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Leaf, Bell, BarChart2, Filter, Mail, Zap, CheckCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bamboo — Automated Job Alerts for Tech Roles',
  description:
    'Bamboo scans 60+ top tech companies on Greenhouse every 20 minutes and emails you when matching jobs appear. Track applications, filter by role and company, and never miss an opening.',
  keywords: [
    'job alert tool',
    'automated job notifications',
    'greenhouse job board tracker',
    'tech job alerts',
    'data scientist job alerts',
    'software engineer job openings',
    'job application tracker',
    'machine learning engineer jobs',
  ],
  openGraph: {
    title: 'Bamboo — Automated Job Alerts for Tech Roles',
    description:
      'Get email alerts when your target companies post new jobs. Covers Stripe, Anthropic, OpenAI, Databricks, and 60+ more.',
    type: 'website',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Bamboo',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description:
        'Bamboo is a free job alert and application tracking tool that monitors Greenhouse job boards at 60+ top tech companies every 20 minutes. Users configure job title keywords, companies, and job types (internship or full-time) and receive email notifications when new matching positions are posted.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      featureList: [
        'Automated job scanning every 20 minutes',
        'Email alerts for new job postings',
        'Supports 60+ top tech companies via Greenhouse',
        'Filter by job title keyword',
        'Filter by internship or full-time',
        'Application status tracker (applied, interview, offer, rejected)',
        'Dashboard with application statistics',
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is Bamboo?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Bamboo is a free web app that automatically monitors job boards at top tech companies and sends you email alerts when new matching jobs are posted. It uses the Greenhouse recruiting platform API to scan 60+ companies every 20 minutes.',
          },
        },
        {
          '@type': 'Question',
          name: 'Which companies does Bamboo support?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Bamboo supports 60+ tech companies that use the Greenhouse recruiting platform, including Anthropic, OpenAI, Stripe, Databricks, Airbnb, Coinbase, Discord, Dropbox, Figma, GitLab, Lyft, MongoDB, Reddit, Robinhood, Sentry, and many more.',
          },
        },
        {
          '@type': 'Question',
          name: 'How often does Bamboo check for new jobs?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Bamboo scans all configured companies every 20 minutes and sends email notifications immediately when new matching jobs are found.',
          },
        },
        {
          '@type': 'Question',
          name: 'What job roles does Bamboo cover?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Bamboo can track any job title keyword. Pre-configured suggestions include Data Scientist, Data Engineer, Machine Learning Engineer, AI Engineer, Software Engineer, Backend Engineer, Frontend Engineer, Product Manager, Analytics Engineer, and more.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is Bamboo free?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes, Bamboo is completely free to use.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I track my job applications in Bamboo?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Bamboo includes a built-in application tracker where you can log each application and move it through statuses: saved, applied, interview, offer, or rejected.',
          },
        },
      ],
    },
  ],
}

const features = [
  {
    icon: Zap,
    title: 'Scans every 20 minutes',
    description: 'Greenhouse job boards at 60+ top tech companies are checked automatically, around the clock.',
  },
  {
    icon: Mail,
    title: 'Instant email alerts',
    description: 'Get notified the moment a matching job is posted — before it fills up.',
  },
  {
    icon: Filter,
    title: 'Precise filters',
    description: 'Target specific companies, job titles, and job types (internship or full-time).',
  },
  {
    icon: BarChart2,
    title: 'Application tracker',
    description: 'Log every application and move it through applied → interview → offer → rejected.',
  },
  {
    icon: Bell,
    title: 'No duplicate alerts',
    description: "Each job is sent to you once. You won't get spammed if you re-run a scan.",
  },
  {
    icon: CheckCircle,
    title: 'Completely free',
    description: 'No plans, no paywalls. Sign up and start tracking immediately.',
  },
]

const companies = [
  'Anthropic', 'OpenAI', 'Stripe', 'Databricks', 'Airbnb', 'Coinbase',
  'Discord', 'Dropbox', 'Figma', 'GitLab', 'Lyft', 'MongoDB',
  'Reddit', 'Robinhood', 'Sentry', 'Datadog', 'Cloudflare', 'Gusto',
]

const steps = [
  {
    number: '01',
    title: 'Set your preferences',
    description: 'Choose target companies, job title keywords, and whether you want internships, full-time roles, or both.',
  },
  {
    number: '02',
    title: 'We scan automatically',
    description: 'Bamboo polls every company\'s Greenhouse job board every 20 minutes — no action needed from you.',
  },
  {
    number: '03',
    title: 'Get email alerts',
    description: 'When a new matching job appears, you receive an email with the title, company, and a direct link to apply.',
  },
]

const faqs = [
  {
    q: 'Which companies are supported?',
    a: 'Any company that uses the Greenhouse recruiting platform. Bamboo comes pre-loaded with 60+ top US tech companies including Anthropic, OpenAI, Stripe, Databricks, Airbnb, Coinbase, Discord, Figma, GitLab, Lyft, Reddit, Robinhood, Sentry, and more.',
  },
  {
    q: 'How often are jobs checked?',
    a: 'Every 20 minutes, continuously. New jobs are sent to you immediately after being detected.',
  },
  {
    q: 'What roles can I track?',
    a: 'Any keyword-based title: Data Scientist, Machine Learning Engineer, Software Engineer, Product Manager, Analytics Engineer, Data Analyst, AI Engineer, and more.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes — completely free with no usage limits.',
  },
  {
    q: 'Can I track my applications?',
    a: 'Yes. The Applications tab lets you log jobs and track status: saved → applied → interview → offer or rejected.',
  },
]

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-white text-gray-900">

        {/* Nav */}
        <header className="border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-sm z-10">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-green-700 rounded-lg flex items-center justify-center">
                <Leaf className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-gray-900 tracking-tight">Bamboo</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="text-sm font-medium bg-green-700 text-white px-4 py-1.5 rounded-lg hover:bg-green-800 transition-colors"
              >
                Get started free
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <Zap className="w-3 h-3" />
            Scans 60+ companies every 20 minutes
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-5">
            Never miss a job opening<br className="hidden sm:block" /> at top tech companies
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8">
            Bamboo monitors Greenhouse job boards at Anthropic, Stripe, OpenAI, Databricks, and 60+ more — every 20 minutes — and emails you the moment a matching role appears.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="px-6 py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 transition-colors text-sm"
            >
              Start for free — no credit card
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors text-sm"
            >
              Sign in
            </Link>
          </div>
        </section>

        {/* Company logos (text) */}
        <section className="border-y border-gray-100 py-6 bg-gray-50">
          <div className="max-w-5xl mx-auto px-6">
            <p className="text-xs text-gray-400 text-center mb-4 uppercase tracking-wide font-medium">
              Tracks job boards at companies including
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {companies.map(c => (
                <span key={c} className="text-sm font-medium text-gray-500">{c}</span>
              ))}
              <span className="text-sm text-gray-400">+ 40 more</span>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map(step => (
              <div key={step.number} className="text-center">
                <div className="text-4xl font-black text-green-100 mb-3">{step.number}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="bg-gray-50 py-20">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">Everything you need to land the job</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map(f => (
                <div key={f.title} className="bg-white rounded-xl p-5 border border-gray-100">
                  <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mb-3">
                    <f.icon className="w-4 h-4 text-green-700" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">Frequently asked questions</h2>
          <dl className="space-y-6">
            {faqs.map(faq => (
              <div key={faq.q} className="border-b border-gray-100 pb-6">
                <dt className="font-semibold text-gray-900 mb-2">{faq.q}</dt>
                <dd className="text-sm text-gray-500 leading-relaxed">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Bottom CTA */}
        <section className="bg-green-700 py-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Start tracking jobs today</h2>
          <p className="text-green-200 text-sm mb-7 max-w-md mx-auto">
            Free, no credit card required. Get your first email alert within 20 minutes of signing up.
          </p>
          <Link
            href="/signup"
            className="inline-block px-7 py-3 bg-white text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-colors text-sm"
          >
            Create free account
          </Link>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-100 py-8">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-700 rounded flex items-center justify-center">
                <Leaf className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="font-medium text-gray-600 tracking-tight">Bamboo</span>
            </div>
            <div className="flex gap-5">
              <Link href="/login" className="hover:text-gray-600 transition-colors">Sign in</Link>
              <Link href="/signup" className="hover:text-gray-600 transition-colors">Sign up</Link>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
