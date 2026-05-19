import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { AutofillProfile } from '@/lib/types'

export const runtime = 'edge'

const SYSTEM_PROMPT = `You are a professional cover letter writer. Format every letter as a standard business letter with no markdown:

1. Candidate block: full name, street address, city/state/zip, email, phone — each on its own line
2. Date: today's date (e.g. May 19, 2026)
3. Blank line
4. Company block: company name and mailing address — infer the address from your knowledge; if unknown, use just the company name on one line
5. Blank line
6. Salutation (e.g. Dear Hiring Manager,)
7. Body: 3–4 paragraphs
8. Closing (e.g. Sincerely,) followed by the candidate's full name

Return only the formatted letter text. No markdown, no headings, no bullet points outside the letter body.`

const DEFAULT_INSTRUCTIONS = `Write a confident, concise cover letter highlighting relevant experience and skills tailored to the role.`

function summarizeProfileForCoverLetter(p: AutofillProfile): string {
  const addressParts = [p.street_address, p.city, p.state && p.zip_code ? `${p.state} ${p.zip_code}` : (p.state ?? p.zip_code)].filter(Boolean)
  const lines: string[] = [
    `Candidate: ${[p.first_name, p.last_name].filter(Boolean).join(' ')}`,
    addressParts.length ? `Address: ${addressParts.join(', ')}` : null,
    p.country ? `Country: ${p.country}` : null,
    `Email: ${p.email ?? ''}`,
    p.phone ? `Phone: ${p.phone}` : null,
    `LinkedIn: ${p.linkedin_url ?? ''}`,
    `GitHub: ${p.github_url ?? ''}`,
    `Skills: ${(p.skills ?? []).join(', ')}`,
  ].filter((l): l is string => l !== null)

  if (p.work_experience?.length) {
    lines.push('Work Experience:')
    for (const w of p.work_experience) {
      lines.push(`  - ${w.title} at ${w.company} (${w.start_date} – ${w.current ? 'Present' : w.end_date})`)
      if (w.description) lines.push(`    ${w.description}`)
    }
  }

  if (p.education?.length) {
    lines.push('Education:')
    for (const e of p.education) {
      lines.push(`  - ${e.degree} in ${e.field_of_study} at ${e.school}`)
    }
  }

  if (p.projects?.length) {
    lines.push('Projects:')
    for (const pr of p.projects) {
      lines.push(`  - ${pr.name}: ${pr.description}`)
    }
  }

  return lines.filter(l => !l.endsWith(': ')).join('\n')
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!bearerToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(bearerToken)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })

  const body = await req.json().catch(() => null) as {
    profile_id: string
    job_title?: string
    company?: string
    job_context?: string
    custom_prompt?: string
  } | null

  if (!body?.profile_id) {
    return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })
  }

  const { data: profile } = await service
    .from('autofill_profiles')
    .select('*')
    .eq('id', body.profile_id)
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const instructions = body.custom_prompt?.trim() ||
    (profile as AutofillProfile).cover_letter_prompt?.trim() ||
    DEFAULT_INSTRUCTIONS

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const userMessage = [
    `Today's date: ${today}`,
    `Role: ${body.job_title ?? 'the position'} at ${body.company ?? 'the company'}`,
    body.job_context ? `Job context:\n${body.job_context.slice(0, 3000)}` : null,
    `Candidate profile:\n${summarizeProfileForCoverLetter(profile as AutofillProfile)}`,
    `Additional instructions: ${instructions}`,
  ].filter(Boolean).join('\n\n')

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.4,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json(
        { error: 'DEEPSEEK_ERROR', detail: `${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    const coverLetter = data?.choices?.[0]?.message?.content?.trim() ?? ''
    return NextResponse.json({ cover_letter: coverLetter })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'COVER_LETTER_FAILED', detail }, { status: 500 })
  }
}
