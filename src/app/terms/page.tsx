import Link from 'next/link'
import { Leaf } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Bamboo',
  description: 'Terms of Service for Bamboo and the Bamboo Job Tracker Chrome extension.',
}

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: April 8, 2026</p>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-8">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Acceptance</h2>
            <p>
              By accessing or using Bamboo at <strong>jobbamboo.com</strong> or the{' '}
              <strong>Bamboo Job Tracker</strong> Chrome extension (together, the &ldquo;Service&rdquo;),
              you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not
              agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>
              Bamboo is a free job-alert and application-tracking tool. It monitors publicly available
              job boards at technology companies, notifies registered users by email when new matching
              roles are posted, and provides a dashboard to track job applications. The Chrome extension
              allows users to save job applications directly from employer and applicant-tracking-system
              websites.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Eligibility</h2>
            <p>
              You must be at least 13 years old to use the Service. By creating an account you
              represent that you meet this age requirement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Account</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and
              for all activity that occurs under your account. Notify us immediately at{' '}
              <strong>support@jobbamboo.com</strong> if you suspect unauthorised access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose or in violation of any applicable law.</li>
              <li>
                Attempt to reverse-engineer, scrape, or otherwise extract data from the Service in an
                automated manner beyond normal personal use.
              </li>
              <li>
                Interfere with or disrupt the integrity or performance of the Service or the servers
                and networks that host it.
              </li>
              <li>Impersonate another person or entity.</li>
              <li>Use the Service to transmit spam or unsolicited communications.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Intellectual Property</h2>
            <p>
              All content, design, code, and trademarks in the Service are owned by or licensed to
              Bamboo. You may not reproduce or distribute any part of the Service without our prior
              written consent. You retain ownership of any data you input into the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Third-Party Content</h2>
            <p>
              Job listings surfaced by Bamboo are sourced from public job boards operated by third
              parties. We do not endorse or guarantee the accuracy, completeness, or availability of
              any job listing. Applying for a job is a transaction between you and the employer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Disclaimers</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
              warranties of any kind, either express or implied, including but not limited to
              merchantability, fitness for a particular purpose, or non-infringement. We do not warrant
              that the Service will be uninterrupted, error-free, or that job alerts will be delivered
              within any specific timeframe.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Bamboo and its operators shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages, or any loss of
              profits or revenues, arising out of or related to your use of the Service, even if
              advised of the possibility of such damages. Our total liability for any claim shall not
              exceed the greater of USD&nbsp;$10 or the amount you paid us in the twelve months
              preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at our discretion, with or
              without notice, for conduct that we believe violates these Terms or is harmful to other
              users, us, or third parties. You may terminate your account at any time by contacting{' '}
              <strong>support@jobbamboo.com</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will post the updated Terms at this URL
              with a revised &ldquo;last updated&rdquo; date. Continued use of the Service after
              changes are posted constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the jurisdiction in which Bamboo is operated,
              without regard to conflict-of-law principles.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">13. Contact</h2>
            <p>
              Questions about these Terms can be sent to: <strong>support@jobbamboo.com</strong>
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
