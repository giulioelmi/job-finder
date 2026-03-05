import { Resend } from 'resend'
import { GreenhouseJob } from './greenhouse'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendJobNotificationEmail(
  to: string,
  jobs: GreenhouseJob[]
): Promise<void> {
  if (jobs.length === 0) return

  const jobListHtml = jobs
    .map(
      job => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;">
      <h3 style="margin:0 0 4px;font-size:16px;color:#111827;">${job.title}</h3>
      ${job.company ? `<p style="margin:0 0 4px;color:#6b7280;font-size:14px;">${job.company}</p>` : ''}
      ${job.location ? `<p style="margin:0 0 8px;color:#6b7280;font-size:13px;">📍 ${job.location}</p>` : ''}
      <a href="${job.url}" style="display:inline-block;padding:8px 16px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
        View Job →
      </a>
    </div>`
    )
    .join('')

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'JobFinder <noreply@yourdomain.com>',
    to,
    subject: `🔔 ${jobs.length} new job${jobs.length > 1 ? 's' : ''} found`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#111827;margin-bottom:4px;">New Jobs Found</h2>
        <p style="color:#6b7280;margin-bottom:24px;">
          We found ${jobs.length} new job${jobs.length > 1 ? 's' : ''} matching your search.
        </p>
        ${jobListHtml}
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          You're receiving this because you set up job alerts on JobFinder.
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" style="color:#2563eb;">Manage alerts</a>
        </p>
      </div>
    `,
  })
}
