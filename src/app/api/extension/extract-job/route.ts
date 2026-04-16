import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'edge'

const SYSTEM_PROMPT = `You extract the job title and hiring company from the text of a job-posting web page.

Return STRICT JSON with this shape:
{"is_job_page": boolean, "title": string, "company": string}

- is_job_page: true ONLY if the text describes a single, specific job opening that a person could apply to. A generic "Careers" landing page, a list of many roles, a company homepage, or an unrelated page is NOT a job page.
- title: the job title (e.g. "Senior Software Engineer"). Empty string if unknown or not a job page.
- company: the hiring company's name (e.g. "Stripe"). Empty string if unknown or not a job page.

Never invent values. If unsure, return empty strings.`

type ExtractResult = { is_job_page: boolean; title: string; company: string }

const EMPTY: ExtractResult = { is_job_page: false, title: '', company: '' }

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!bearerToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(bearerToken)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })

  const body = await req.json().catch(() => null) as { text?: string; url?: string } | null
  const text = (body?.text || '').slice(0, 6000)
  const url = (body?.url || '').slice(0, 500)
  if (!text) return NextResponse.json(EMPTY)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 120,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `URL: ${url}\n\n${text}` },
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return NextResponse.json(
        { error: 'OPENAI_ERROR', detail: `${res.status}: ${body.slice(0, 200)}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content
    if (!raw) return NextResponse.json(EMPTY)

    const parsed = JSON.parse(raw) as Partial<ExtractResult>
    const result: ExtractResult = {
      is_job_page: Boolean(parsed.is_job_page),
      title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
      company: typeof parsed.company === 'string' ? parsed.company.trim() : '',
    }
    if (!result.is_job_page) return NextResponse.json(EMPTY)
    return NextResponse.json(result)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'EXTRACTION_FAILED', detail }, { status: 500 })
  }
}
