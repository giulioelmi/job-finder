export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Leaf, Bell, BarChart2, Filter, Mail, Zap } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bamboo — Automated Job Alerts for Tech Roles',
  description:
    'Bamboo scans 500+ top tech companies every 20 minutes and emails you when matching jobs appear. Track applications, filter by role and company, and never miss an opening.',
  keywords: [
    'job alert tool',
    'automated job notifications',
    'tech job alerts',
    'data scientist job alerts',
    'software engineer job openings',
    'job application tracker',
    'machine learning engineer jobs',
  ],
  openGraph: {
    title: 'Bamboo — Automated Job Alerts for Tech Roles',
    description:
      'Get email alerts when your target companies post new jobs. Covers Stripe, Anthropic, OpenAI, Databricks, and 500+ more.',
    type: 'website',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Bamboo',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Bamboo is a free job alert and application tracking tool that monitors 500+ top tech company websites every 20 minutes. Users configure job title keywords, companies, and job types and receive email notifications when new matching positions are posted.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

const features = [
  {
    icon: Zap,
    title: 'Scans every 20 minutes',
    description: '500+ tech company websites checked automatically, around the clock.',
  },
  {
    icon: Mail,
    title: 'Instant email alerts',
    description: 'Get notified the moment a matching job is posted — before it fills up.',
  },
  {
    icon: Filter,
    title: 'Precise filters',
    description: 'Target specific companies, job titles, and internship or full-time roles.',
  },
  {
    icon: BarChart2,
    title: 'Application tracker',
    description: 'Log every application and move it through applied → interview → offer.',
  },
]

const companies = [
  'Anthropic', 'OpenAI', 'Stripe', 'Databricks', 'Airbnb', 'Coinbase',
  'Discord', 'Figma', 'GitLab', 'Reddit', 'Datadog', 'Cloudflare',
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
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
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
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <Zap className="w-3 h-3" />
            Scans 500+ companies every 20 minutes
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-5">
            Never miss a job opening.
          </h1>
          <p className="text-lg text-gray-500 max-w-lg mx-auto mb-8">
            Bamboo monitors 500+ tech company websites every 20 minutes and emails you the moment a matching role appears.
          </p>
          <Link
            href="/signup"
            className="inline-block px-7 py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 transition-colors text-sm"
          >
            Start for free — no credit card
          </Link>
        </section>

        {/* Company strip */}
        <section className="border-y border-gray-100 py-6 bg-gray-50">
          <div className="max-w-4xl mx-auto px-6">
            <p className="text-xs text-gray-400 text-center mb-4 uppercase tracking-wide font-medium">
              Tracks job boards at companies including
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {companies.map(c => (
                <span key={c} className="text-sm font-medium text-gray-500">{c}</span>
              ))}
              <span className="text-sm text-gray-400">+ 490 more</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-4xl mx-auto px-6 py-20">
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map(f => (
              <div key={f.title} className="flex gap-4 p-5 rounded-xl border border-gray-100">
                <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-green-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
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
          <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
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
