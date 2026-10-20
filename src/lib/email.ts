import { Resend } from 'resend'

interface EmailJob {
  company: string
  title: string
  posted_at: string | null
  location: string | null
  url: string
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
    subject: jobs.length === 1 ? `${jobs[0].company} is hiring: ${jobs[0].title}` : `${jobs[0].company} is hiring: ${jobs[0].title} (+${jobs.length - 1} more matches)`,
    text: `${greeting}\n\nYour Bamboo AI agent found these matches:\n\n${jobLines}${resumeLine}\n\nSee all matches: ${appUrl}/career-profile`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <p style="font-size:16px;color:#111827;margin-bottom:4px;">${greeting}</p>
        <p style="font-size:16px;color:#111827;margin-top:0;margin-bottom:20px;">Your Bamboo AI agent found these matches:</p>
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
