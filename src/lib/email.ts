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
  const diffMs = Date.now() - new Date(posted_at).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} min ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

export async function sendJobNotificationEmail(
  to: string,
  jobs: EmailJob[],
  name?: string
): Promise<void> {
  if (jobs.length === 0) return
  if (!process.env.RESEND_API_KEY) {
    console.error('[email] RESEND_API_KEY is not set — email not sent')
    return
  }
  const resend = new Resend(process.env.RESEND_API_KEY)

  const MAX_JOBS = 5
  const displayedJobs = jobs.slice(0, MAX_JOBS)
  const extraCount = jobs.length - displayedJobs.length

  const greeting = name ? `Hi ${name},` : 'Hi,'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobbamboo.com'

  // Plain text
  const jobLines = displayedJobs
    .map(job => `• ${job.title} - ${job.company} - posted ${formatPostedAt(job.posted_at)}`)
    .join('\n')
  const extraLine = extraCount > 0
    ? `\nAnd ${extraCount} more job${extraCount === 1 ? '' : 's'} on jobbamboo.com`
    : ''

  // HTML rows
  const jobListHtml = displayedJobs
    .map(
      job => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
          <strong style="color:#111827;">${job.title}</strong>
          <span style="color:#6b7280;font-size:14px;"> - ${job.company}</span><br/>
          <span style="color:#9ca3af;font-size:13px;">posted ${formatPostedAt(job.posted_at)}${job.location ? ` · ${job.location}` : ''}</span><br/>
          <a href="${job.url}" style="color:#2563eb;font-size:13px;text-decoration:none;">View job →</a>
        </td>
      </tr>`
    )
    .join('')

  const extraHtml = extraCount > 0
    ? `<p style="font-size:14px;color:#6b7280;margin-top:16px;">
        And <a href="${appUrl}" style="color:#2563eb;">${extraCount} more job${extraCount === 1 ? '' : 's'}</a> on jobbamboo.com
      </p>`
    : ''

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'JobBamboo <noreply@jobbamboo.com>',
    to,
    subject: 'New jobs just posted!',
    text: `${greeting}\n\nLog into jobbamboo.com to see these new jobs:\n\n${jobLines}${extraLine}\n\nManage your alerts: ${appUrl}/settings`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <p style="font-size:16px;color:#111827;margin-bottom:4px;">${greeting}</p>
        <p style="font-size:16px;color:#111827;margin-top:0;margin-bottom:20px;">
          Log into <a href="${appUrl}" style="color:#2563eb;">jobbamboo.com</a> to see these new jobs:
        </p>
        <table style="width:100%;border-collapse:collapse;">
          ${jobListHtml}
        </table>
        ${extraHtml}
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          You're receiving this because you set up job alerts on JobBamboo.
          <a href="${appUrl}/settings" style="color:#2563eb;">Manage alerts</a>
        </p>
      </div>
    `,
  })
  if (error) {
    console.error('[email] Resend send failed:', error)
  }
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

interface AgentMatchEmailJob extends EmailJob {
  reason: string
  score: number
}

export async function sendAgentMatchEmail(
  to: string,
  jobs: AgentMatchEmailJob[],
  attachments: { filename: string; content: Buffer }[],
  name?: string
): Promise<void> {
  if (jobs.length === 0) return
  if (!process.env.RESEND_API_KEY) {
    console.error('[email] RESEND_API_KEY is not set — email not sent')
    return
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobbamboo.com'
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,'
  const resumeLine = attachments.length > 0 ? '\n\nA tailored resume for each job is attached. Review it before you apply.' : ''

  const jobLines = jobs
    .map(job => `• ${job.title} - ${job.company} (${job.score}% fit)\n  ${job.reason}\n  ${job.url}`)
    .join('\n\n')

  const jobListHtml = jobs
    .map(
      job => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
          <strong style="color:#111827;">${escapeHtml(job.title)}</strong>
          <span style="color:#6b7280;font-size:14px;"> - ${escapeHtml(job.company)}</span>
          <span style="color:#15803d;font-size:13px;"> · ${job.score}% fit</span><br/>
          <span style="color:#374151;font-size:14px;">${escapeHtml(job.reason)}</span><br/>
          <span style="color:#9ca3af;font-size:13px;">${escapeHtml(job.location ?? '')}</span><br/>
          <a href="${escapeHtml(job.url)}" style="color:#2563eb;font-size:13px;text-decoration:none;">View job →</a>
        </td>
      </tr>`
    )
    .join('')

  const resumeNote = attachments.length > 0
    ? `<p style="font-size:14px;color:#6b7280;margin-top:16px;">A tailored resume for each job is attached. Review it before you apply.</p>`
    : ''

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'JobBamboo <noreply@jobbamboo.com>',
    to,
    subject: `Your AI agent found ${jobs.length} job${jobs.length === 1 ? '' : 's'} for you`,
    text: `${greeting}\n\nYour Bamboo AI agent found these matches:\n\n${jobLines}${resumeLine}\n\nSee all matches: ${appUrl}/career-profile`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <p style="font-size:16px;color:#111827;margin-bottom:20px;">${greeting} your Bamboo AI agent found these matches:</p>
        <table style="width:100%;border-collapse:collapse;">
          ${jobListHtml}
        </table>
        ${resumeNote}
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          <a href="${appUrl}/career-profile" style="color:#2563eb;">Manage your AI agent</a>
        </p>
      </div>
    `,
    attachments,
  })
  if (error) {
    console.error('[email] Resend send failed:', error)
  }
}
