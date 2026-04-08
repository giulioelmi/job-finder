import Link from 'next/link'
import { Leaf } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Bamboo',
  description: 'Privacy Policy for Bamboo and the Bamboo Job Tracker Chrome extension.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Nav */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-sm z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-700 rounded-lg flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 tracking-tight">Bamboo</span>
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium bg-green-700 text-white px-4 py-1.5 rounded-lg hover:bg-green-800 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: April 8, 2026</p>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-8">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Overview</h2>
            <p>
              Bamboo (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates the website at{' '}
              <strong>jobbamboo.com</strong> and the <strong>Bamboo Job Tracker</strong> Chrome extension
              (together, the &ldquo;Service&rdquo;). This Privacy Policy explains what information we
              collect, how we use it, and your rights regarding that information.
            </p>
            <p className="mt-3">
              By using the Service you agree to the practices described in this policy. If you do not
              agree, please discontinue use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Information We Collect</h2>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2a. Account information</h3>
            <p>
              When you create a Bamboo account we collect your <strong>email address</strong> and a
              hashed password. We do not collect your name, phone number, or payment information —
              Bamboo is free.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2b. User preferences</h3>
            <p>
              To send you relevant job alerts we store the preferences you configure in Settings:
              target job title keywords, target companies, preferred locations, job type
              (full-time / internship), and notification frequency.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2c. Application tracking data</h3>
            <p>
              When you log a job application — either manually on the website or via the Chrome
              extension — we store the <strong>job title</strong>, <strong>company name</strong>,{' '}
              <strong>job posting URL</strong>, <strong>application status</strong>, and the date the
              entry was created.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2d. Chrome extension</h3>
            <p>
              The Bamboo Job Tracker extension operates only on pages that appear to be job postings
              (career-related URLs and known applicant-tracking-system domains). On those pages it:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                Reads the <strong>page URL</strong>, <strong>page title / heading text</strong>, and
                structured data (JSON-LD) to extract the job title and employer name.
              </li>
              <li>
                Stores your Bamboo <strong>authentication token</strong> in{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">chrome.storage.local</code>{' '}
                so you stay logged in between browser sessions. This data lives only on your device and
                is never transmitted to any server other than Bamboo&rsquo;s own API.
              </li>
              <li>
                When you click &ldquo;Mark as Applied&rdquo;, sends the job title, company name, and
                URL to Bamboo&rsquo;s API to create an application record in your account.
              </li>
            </ul>
            <p className="mt-3">
              The extension does <strong>not</strong> read the full content of web pages, collect
              browsing history, track pages that are not job postings, or share any data with third
              parties.
            </p>

            <h3 className="font-semibold text-gray-800 mt-4 mb-2">2e. Usage data</h3>
            <p>
              We use Vercel Analytics to collect aggregate, anonymised page-view data (pages visited,
              referrer, country). This data contains no personally identifiable information and is used
              solely to understand product usage.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To create and manage your account and authenticate you.</li>
              <li>
                To scan job boards matching your preferences and send you email notifications via{' '}
                <strong>Resend</strong>.
              </li>
              <li>To display your tracked applications and networking contacts on your dashboard.</li>
              <li>To improve the Service based on anonymised usage patterns.</li>
              <li>To respond to support requests you initiate.</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell your personal data, use it for advertising, or share it
              with third parties except as described in Section&nbsp;4.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Third-Party Services</h2>
            <p>We share data with the following sub-processors only to the extent necessary to operate the Service:</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Provider</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Purpose</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-700">Data shared</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-2">Supabase</td>
                    <td className="px-4 py-2">Database &amp; authentication</td>
                    <td className="px-4 py-2">Email, hashed password, all stored application data</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Resend</td>
                    <td className="px-4 py-2">Transactional email</td>
                    <td className="px-4 py-2">Email address, job alert content</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Vercel</td>
                    <td className="px-4 py-2">Hosting &amp; analytics</td>
                    <td className="px-4 py-2">Anonymised page-view data, server request logs</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. You may delete your
              account at any time by contacting us at the address in Section&nbsp;9, after which your
              personal data will be deleted within 30 days except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Security</h2>
            <p>
              All data in transit is encrypted with TLS. Authentication tokens are stored using
              Supabase&rsquo;s secure authentication infrastructure. Row-level security policies ensure
              each user can only access their own data. No system is perfectly secure, and we cannot
              guarantee absolute security, but we take reasonable measures to protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and associated data.</li>
              <li>Object to or restrict certain processing.</li>
              <li>Withdraw consent at any time (e.g. unsubscribe from email alerts in Settings).</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us at the address below.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Children</h2>
            <p>
              The Service is not directed at children under 13. We do not knowingly collect personal
              data from children under 13. If you believe a child has provided us with personal data,
              please contact us and we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the updated policy at
              this URL with a revised &ldquo;last updated&rdquo; date. For material changes we will
              notify you by email.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Contact</h2>
            <p>
              Questions or requests regarding this Privacy Policy can be sent to:{' '}
              <strong>privacy@jobbamboo.com</strong>
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-green-700 rounded flex items-center justify-center">
              <Leaf className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="font-medium text-gray-600 tracking-tight">Bamboo</span>
          </div>
          <div className="flex gap-5">
            <Link href="/privacy-policy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
