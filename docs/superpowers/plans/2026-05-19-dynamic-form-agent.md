# Dynamic Form Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an LLM agent loop that clicks "Add" buttons in job application forms and fills the revealed fields, enabling multi-entry sections (Work Experience, Education) to be autofilled automatically.

**Architecture:** After the existing static fill pass, `handleFill()` in `content.js` runs an agent loop: stamp DOM elements with `data-bamboo-idx` attributes, send a text snapshot + profile to `/api/extension/agent-fill`, execute the returned `click`/`wait`/`fill` actions, re-snapshot, and repeat until the LLM returns `done: true` or 10 iterations are hit. All reasoning stays server-side; the extension is a dumb executor.

**Tech Stack:** Next.js 15 Edge Runtime, DeepSeek `deepseek-chat`, Chrome Extension MV3 (content.js + background.js)

---

## File Map

| File | Change |
|------|--------|
| `src/app/api/extension/agent-fill/route.ts` | **Create** — new edge API endpoint |
| `chrome-extension/background.js` | **Modify** — add `agentFill()` function + `AGENT_FILL` message handler |
| `chrome-extension/content.js` | **Modify** — add `buildAgentSnapshot()`, `runAgentFill()`, hook into `handleFill()` |

---

### Task 1: API endpoint `POST /api/extension/agent-fill`

**Files:**
- Create: `src/app/api/extension/agent-fill/route.ts`

- [ ] **Step 1: Create the file with auth + request parsing**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { AutofillProfile } from '@/lib/types'

export const runtime = 'edge'

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
    `LinkedIn: ${p.linkedin_url ?? ''}`,
    `GitHub: ${p.github_url ?? ''}`,
    `Skills: ${(p.skills ?? []).join(', ')}`,
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
      lines.push(`  - ${e.degree} in ${e.field_of_study} at ${e.school}`)
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
    history: Array<{ snapshot: string; actions: unknown[] }>
    job_context?: string
  } | null

  if (!body?.profile_id || !body?.snapshot) {
    return NextResponse.json({ error: 'profile_id and snapshot are required' }, { status: 400 })
  }

  const { data: profile } = await service
    .from('autofill_profiles')
    .select('*')
    .eq('id', body.profile_id)
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const profileText = serializeProfileForAgent(profile as AutofillProfile)

  const historyText = body.history?.length
    ? body.history.map((h, i) =>
        `Iteration ${i + 1}:\nSnapshot:\n${h.snapshot}\nActions taken: ${JSON.stringify(h.actions)}`
      ).join('\n\n')
    : null

  const userMessage = [
    body.job_context ? `Job: ${body.job_context}` : null,
    `Candidate profile:\n${profileText}`,
    `Current DOM snapshot:\n${body.snapshot}`,
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
        max_tokens: 400,
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

    const parsed = JSON.parse(raw) as { actions?: unknown[]; done?: boolean; reasoning?: string }
    return NextResponse.json({
      actions: parsed.actions ?? [{ type: 'done' }],
      done: parsed.done ?? false,
      reasoning: parsed.reasoning ?? '',
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'AGENT_FILL_FAILED', detail }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/giulioelmi/Desktop/job-finder && npx tsc --noEmit
```

Expected: no errors referencing `agent-fill/route.ts`. Any pre-existing errors in other files are fine to ignore.

- [ ] **Step 3: Test the endpoint manually with curl**

Start dev server first: `npm run dev`

```bash
# Replace TOKEN with a real bearer token from chrome.storage (open extension popup → F12 → Application → Local Storage → access_token)
# Replace PROFILE_ID with a real profile id from Supabase
curl -X POST http://localhost:3000/api/extension/agent-fill \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "profile_id": "PROFILE_ID",
    "snapshot": "[button] \"Add Work Experience\" bamboo=0\n[button] \"Add Education\" bamboo=1",
    "history": [],
    "job_context": "Software Engineer at Acme Corp"
  }'
```

Expected response shape:
```json
{
  "actions": [
    {"type": "click", "selector": "[data-bamboo-idx='0']"},
    {"type": "wait", "ms": 600}
  ],
  "done": false,
  "reasoning": "..."
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/extension/agent-fill/route.ts
git commit -m "feat: add agent-fill API endpoint for dynamic form sections"
```

---

### Task 2: `buildAgentSnapshot()` in content.js

**Files:**
- Modify: `chrome-extension/content.js` — add function after `scanFormFields()` (around line 224)

- [ ] **Step 1: Add `buildAgentSnapshot()` after `scanFormFields()`**

Find the end of `scanFormFields()` (the line that says `return fields` followed by `}`). Add the new function immediately after:

```js
  function buildAgentSnapshot() {
    // Clear previous annotations
    document.querySelectorAll('[data-bamboo-idx]').forEach(el => el.removeAttribute('data-bamboo-idx'))

    const QUERY =
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])' +
      ':not([type="image"]):not([type="file"]):not([disabled]),' +
      'select:not([disabled]),' +
      'textarea:not([disabled]),' +
      'button:not([disabled]),' +
      'a[role="button"],' +
      '[role="combobox"]:not([disabled])'

    const els = Array.from(document.querySelectorAll(QUERY)).filter(isVisible)
    const lines = []

    els.forEach((el, i) => {
      el.setAttribute('data-bamboo-idx', String(i))
      const tag   = el.tagName.toLowerCase()
      const type  = el.getAttribute('type') || el.getAttribute('role') || tag
      const label = getFieldLabel(el) || el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) || ''
      const name  = el.name || el.id || ''
      let line    = `[${type}] "${label}" bamboo=${i}`
      if (name) line += ` name="${name}"`
      lines.push(line)
    })

    return lines.join('\n')
  }
```

- [ ] **Step 2: Verify in browser console**

Load any job application page with the extension, open DevTools → Console, and run:

```js
// This won't work from console directly (shadow DOM), but you can test the snapshot logic
// by temporarily exposing it from content.js, or just proceed to Task 4 and test end-to-end
```

Since content.js runs in an isolated extension context, end-to-end testing is in Task 4. Move on.

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/content.js
git commit -m "feat: add buildAgentSnapshot to stamp and describe visible DOM elements"
```

---

### Task 3: `agentFill()` in background.js + message handler

**Files:**
- Modify: `chrome-extension/background.js`

- [ ] **Step 1: Add `agentFill()` function**

Add this function after the existing `autofill()` function (after the closing `}` on the line that ends `autofill`):

```js
async function agentFill({ profileId, snapshot, history, jobContext }) {
  const { token } = await getValidToken()
  if (!token) return { error: 'NOT_LOGGED_IN' }

  try {
    const res = await fetch(`${APP_URL}/api/extension/agent-fill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        profile_id: profileId,
        snapshot,
        history: history || [],
        job_context: jobContext || '',
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { error: body.error || `Server error (${res.status})` }
    return { actions: body.actions, done: body.done, reasoning: body.reasoning }
  } catch (e) {
    return { error: 'Network error — check your connection' }
  }
}
```

- [ ] **Step 2: Register `AGENT_FILL` in the message listener**

In `chrome.runtime.onMessage.addListener`, add this block before the closing `})` (before the `} // end chrome.runtime.onMessage guard` comment):

```js
  if (message.type === 'AGENT_FILL') {
    agentFill(message.data).then(sendResponse)
    return true
  }
```

- [ ] **Step 3: Verify no syntax errors**

Open `chrome://extensions` → find Bamboo → click "Reload". Then open the service worker DevTools (click "service worker" link). Check the console — there should be no syntax errors. If there are, fix them before proceeding.

- [ ] **Step 4: Commit**

```bash
git add chrome-extension/background.js
git commit -m "feat: add AGENT_FILL message handler and agentFill function in background.js"
```

---

### Task 4: `runAgentFill()` in content.js + integrate into `handleFill()`

**Files:**
- Modify: `chrome-extension/content.js` — add `runAgentFill()` and update `handleFill()`

- [ ] **Step 1: Add `runAgentFill()` after `handleFill()`**

Find `async function handleFill()` and locate the end of it (the closing `}` before `async function handleApply()`). Add `runAgentFill` immediately after that closing brace:

```js
  async function runAgentFill() {
    const MAX_ITER = 10
    const history = []

    for (let iter = 0; iter < MAX_ITER; iter++) {
      const snapshot = buildAgentSnapshot()

      const result = await chrome.runtime.sendMessage({
        type: 'AGENT_FILL',
        data: {
          profileId: selectedProfile.id,
          snapshot,
          history,
          jobContext: jobInfo.title
            ? `${jobInfo.title}${jobInfo.company ? ` at ${jobInfo.company}` : ''}`
            : '',
        },
      }).catch(() => null)

      if (!result?.actions?.length) break

      const fillActions = []

      for (const action of result.actions) {
        if (action.type === 'click') {
          const el = document.querySelector(action.selector)
          if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        } else if (action.type === 'wait') {
          await new Promise(r => setTimeout(r, action.ms || 500))
        } else if (action.type === 'fill') {
          fillActions.push({ selector: action.selector, value: action.value })
        }
      }

      if (fillActions.length) {
        filledCount += await fillFormFields(fillActions)
      }

      history.push({ snapshot, actions: result.actions })

      if (result.done) break

      // Let DOM settle before next snapshot
      await new Promise(r => setTimeout(r, 400))
    }
  }
```

- [ ] **Step 2: Hook `runAgentFill()` into `handleFill()`**

In `handleFill()`, find this block (around line 1088):

```js
    filledCount = await fillFormFields(autofillRes.fields)

    resumeAttached = false
```

Replace it with:

```js
    filledCount = await fillFormFields(autofillRes.fields)

    // Agent loop: handle dynamic sections (Add Experience, Add Education, etc.)
    const fillBtn2 = shadow.getElementById('af-fill')
    if (fillBtn2) fillBtn2.textContent = 'Agent filling…'
    await runAgentFill()

    resumeAttached = false
```

- [ ] **Step 3: Reload the extension and test on a form with "Add" buttons**

1. Go to `chrome://extensions` → Bamboo → Reload
2. Navigate to a job application with a Work Experience section behind an "Add" button (e.g., a Greenhouse or Lever form)
3. Open the Bamboo extension, select a profile with work experience, click "Fill form ✓"
4. Watch: the button should show "Scanning…" → "Filling…" → "Agent filling…" → the form finishes
5. Confirm the Work Experience fields were filled (job title, company, dates)
6. Open the background service worker DevTools (chrome://extensions → service worker link) and check the console — you should see no errors

- [ ] **Step 4: Test the iteration cap warning**

To test the cap without a real complex form, temporarily change `MAX_ITER = 1` in `runAgentFill`, reload, and run the agent on any form. The agent will stop after 1 iteration. There is no visible warning for the cap in this implementation — the form just stops at done. If you want to verify the cap logic works, add `console.log('[Bamboo] agent fill complete, iterations:', iter + 1)` temporarily. Remove it before committing.

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/content.js
git commit -m "feat: add agent fill loop for dynamic Add-button form sections"
```

---

## Self-Review

**Spec coverage check:**
- ✅ DOM snapshot with `data-bamboo-idx` stamps → `buildAgentSnapshot()`
- ✅ Action types: click, wait, fill, done → all handled in `runAgentFill()`
- ✅ 10-iteration cap → `MAX_ITER = 10`
- ✅ Server-side reasoning → API endpoint with DeepSeek
- ✅ History sent each iteration → `history` array built in loop
- ✅ Static pass first, agent loop after → order in `handleFill()`
- ✅ Reuses existing `fillFormFields` for fill actions → no duplication
- ✅ Auth pattern matches existing endpoints → Bearer token, service client

**Known limitation documented in spec:**
- Shadow DOM / iframes not covered — Workday will not work fully. Out of scope.
