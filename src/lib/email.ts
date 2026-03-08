import { Resend } from 'resend'

interface EmailJob {
  company: string
  title: string
  posted_at: string | null
  location: string | null
  url: string
}

function formatPostedAt(posted_at: string | null): string {
  if (!posted_at) return 'just now'
  const d = new Date(posted_at)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

export async function sendJobNotificationEmail(
  to: string,
  jobs: EmailJob[]
): Promise<void> {
  if (jobs.length === 0) return
  if (!process.env.RESEND_API_KEY) return
  const resend = new Resend(process.env.RESEND_API_KEY)

  const count = jobs.length
  const jobLines = jobs
    .map(job => `• ${job.company} — ${job.title}, posted ${formatPostedAt(job.posted_at)}`)
    .join('\n')

  const jobListHtml = jobs
    .map(
      job => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
          <strong style="color:#111827;">${job.company}</strong>
          <span style="color:#6b7280;font-size:14px;"> — ${job.title}</span><br/>
          <span style="color:#9ca3af;font-size:13px;">Posted ${formatPostedAt(job.posted_at)}${job.location ? ` · ${job.location}` : ''}</span><br/>
          <a href="${job.url}" style="color:#2563eb;font-size:13px;text-decoration:none;">View job →</a>
        </td>
      </tr>`
    )
    .join('')

  const subject = count === 1
    ? `1 new job just posted`
    : `${count} new jobs just posted`

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'JobFinder <noreply@yourdomain.com>',
    to,
    subject,
    text: `Hey,\n\n${count === 1 ? 'A new job has' : `${count} jobs have`} just been posted:\n\n${jobLines}\n\nManage your alerts: ${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <p style="font-size:16px;color:#111827;margin-bottom:20px;">
          Hey, ${count === 1 ? 'a new job has' : `${count} jobs have`} just been posted:
        </p>
        <table style="width:100%;border-collapse:collapse;">
          ${jobListHtml}
        </table>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          You're receiving this because you set up job alerts on JobFinder.
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" style="color:#2563eb;">Manage alerts</a>
        </p>
      </div>
    `,
  })
}
