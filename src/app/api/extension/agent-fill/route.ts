import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { AutofillProfile } from '@/lib/types'

export const runtime = 'edge'

type AgentAction =
  | { type: 'click'; selector: string }
  | { type: 'wait'; ms: number }
  | { type: 'fill'; selector: string; value: string }
  | { type: 'done' }

const SYSTEM_PROMPT = `You are an agent that fills job application forms by controlling the browser.

You receive:
- A text snapshot of visible interactive elements (buttons, inputs, selects, etc.)
- A candidate profile
- Prior actions taken (history)

Return STRICT JSON: {"actions": [...], "done": boolean, "reasoning": "..."}

Action types:
- {"type": "click", "selector": "[data-bamboo-idx='N']"} — click a button or link
- {"type": "wait", "ms": 600} — pause for DOM to update (always follow click with wait)
- {"type": "fill", "selector": "[data-bamboo-idx='N']", "value": "..."} — fill a field
- {"type": "done"} — stop the loop (add this as last action when all sections are complete)

Rules:
- Use click+wait to open collapsed sections (Add Work Experience, Add Education, etc.)
- Only fill fields the profile has data for — never invent values
- After opening a section and filling its fields, check if more sections need opening
- Return small batches of 3-8 actions so you can observe the result before proceeding
- Never re-click a button already clicked (check history)
- When no collapsed sections remain and all visible fields are filled, set done:true and add {"type":"done"}
- If the snapshot shows only already-filled fields and no uncollapsed sections, set done:true immediately`

function serializeProfileForAgent(p: AutofillProfile): string {
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
    snapshot: string
    history: Array<{ snapshot: string; actions: AgentAction[] }>
    job_context?: string
  } | null

  if (!body?.profile_id || !body?.snapshot) {
    return NextResponse.json({ error: 'profile_id and snapshot are required' }, { status: 400 })
  }

  const snapshot = body.snapshot.slice(0, 20_000)
  const history = (body.history ?? []).slice(0, 10)
    .filter(h => h?.snapshot)
    .map(h => ({
      snapshot: h.snapshot.slice(0, 5_000),
      actions: h.actions,
    }))

  const { data: profile } = await service
    .from('autofill_profiles')
    .select('*')
    .eq('id', body.profile_id)
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const profileText = serializeProfileForAgent(profile as AutofillProfile)

  const historyText = history.length
    ? history.map((h, i) =>
        `Iteration ${i + 1}:\nSnapshot:\n${h.snapshot}\nActions taken: ${JSON.stringify(h.actions)}`
      ).join('\n\n')
    : null

  const userMessage = [
    body.job_context ? `Job: ${body.job_context}` : null,
    `Candidate profile:\n${profileText}`,
    `Current DOM snapshot:\n${snapshot}`,
    historyText ? `Prior iterations:\n${historyText}` : null,
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
        temperature: 0.1,
        max_tokens: 900,
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
    if (!raw) return NextResponse.json({ actions: [{ type: 'done' }], done: true, reasoning: 'Empty response' })

    try {
      const parsed = JSON.parse(raw) as { actions?: AgentAction[]; done?: boolean; reasoning?: string }
      return NextResponse.json({
        actions: parsed.actions ?? [{ type: 'done' }],
        done: parsed.done ?? false,
        reasoning: parsed.reasoning ?? '',
      })
    } catch {
      return NextResponse.json({ actions: [], done: false, reasoning: 'Parse error' })
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'AGENT_FILL_FAILED', detail }, { status: 500 })
  }
}
