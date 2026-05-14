import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { AutofillProfile } from '@/lib/types'

export const runtime = 'edge'

const SYSTEM_PROMPT = `You map job application form fields to a user's profile.
Given a JSON array of form fields and a user profile, return STRICT JSON:
{"fields": [{"selector": "...", "value": "..."}]}

Rules:
- Only include fields where the profile has a clear match.
- For select/radio fields the value MUST exactly match one of the provided option strings.
- For checkboxes use "true" or "false".
- For DEI fields where profile value is null, use "Prefer not to say" if that option exists, otherwise skip.
- For "how did you hear about" / "how did you find this role" / "how did you learn about this position" questions, use the referral_source field.
- Never invent values not in the profile.
- Omit fields you are uncertain about.
- Return valid JSON only, no prose, no markdown.`

function serializeProfile(p: AutofillProfile): string {
  const lines: string[] = [
    `Name: ${[p.first_name, p.last_name].filter(Boolean).join(' ')}`,
    `Email: ${p.email ?? ''}`,
    `Phone: ${p.phone ?? ''}`,
    `Address: ${[p.street_address, p.city, p.state, p.zip_code, p.country].filter(Boolean).join(', ')}`,
    `LinkedIn: ${p.linkedin_url ?? ''}`,
    `GitHub: ${p.github_url ?? ''}`,
    `Portfolio: ${p.portfolio_url ?? ''}`,
    `Website: ${p.website_url ?? ''}`,
    `Authorized to work in US: ${p.authorized_to_work === true ? 'Yes' : p.authorized_to_work === false ? 'No' : ''}`,
    `Requires visa sponsorship: ${p.requires_sponsorship === true ? 'Yes' : p.requires_sponsorship === false ? 'No' : ''}`,
    `Visa type: ${p.visa_type ?? ''}`,
    `Desired salary: ${p.desired_salary ? `${p.desired_salary} (${p.salary_type ?? ''})` : ''}`,
    `Willing to relocate: ${p.willing_to_relocate === true ? 'Yes' : p.willing_to_relocate === false ? 'No' : ''}`,
    `Available start date: ${p.available_start_date ?? ''}`,
    `Gender: ${p.gender ?? 'Prefer not to say'}`,
    `Pronouns: ${p.pronouns ?? ''}`,
    `Ethnicity: ${p.ethnicity ?? 'Decline to self identify'}`,
    `Veteran status: ${p.veteran_status ?? "I don't wish to answer"}`,
    `Disability status: ${p.disability_status ?? "I don't wish to answer"}`,
    `Skills: ${(p.skills ?? []).join(', ')}`,
    `Referral source (how did you hear about us): ${p.referral_source ?? ''}`,
  ]

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
      lines.push(`  - ${e.degree} in ${e.field_of_study} at ${e.school} (${e.start_date} – ${e.end_date})${e.gpa ? `, GPA: ${e.gpa}` : ''}`)
    }
  }

  if (p.projects?.length) {
    lines.push('Projects:')
    for (const pr of p.projects) {
      lines.push(`  - ${pr.name}: ${pr.description} (${pr.technologies})${pr.url ? ` – ${pr.url}` : ''}`)
    }
  }

  if (p.custom_qa?.length) {
    lines.push('Custom Q&A:')
    for (const qa of p.custom_qa) {
      lines.push(`  Q: ${qa.question}`)
      lines.push(`  A: ${qa.answer}`)
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
    form_fields: { selector: string; type: string; label: string; placeholder?: string; options?: string[] }[]
    job_title?: string
    company?: string
    profile_overrides?: Partial<AutofillProfile>
  } | null

  if (!body?.profile_id || !body?.form_fields?.length) {
    return NextResponse.json({ error: 'profile_id and form_fields are required' }, { status: 400 })
  }

  const { data: profile } = await service
    .from('autofill_profiles')
    .select('*')
    .eq('id', body.profile_id)
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Merge any inline edits the user made in the extension review card
  const mergedProfile = { ...profile, ...(body.profile_overrides ?? {}) }
  const profileText = serializeProfile(mergedProfile as AutofillProfile)
  const fieldsJson = JSON.stringify(body.form_fields.slice(0, 120))

  const userMessage = [
    body.job_title || body.company
      ? `Job: ${body.job_title ?? ''} at ${body.company ?? ''}`
      : null,
    `Profile:\n${profileText}`,
    `Form fields:\n${fieldsJson}`,
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
        temperature: 0,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
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
    const raw = data?.choices?.[0]?.message?.content
    if (!raw) return NextResponse.json({ fields: [] })

    const parsed = JSON.parse(raw) as { fields?: { selector: string; value: string }[] }
    return NextResponse.json({ fields: parsed.fields ?? [] })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'AUTOFILL_FAILED', detail }, { status: 500 })
  }
}
