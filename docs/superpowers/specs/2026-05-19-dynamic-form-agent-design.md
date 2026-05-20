# Dynamic Form Agent Design

## Goal

Enable the autofill extension to handle job application forms that hide fields behind "Add" buttons (e.g., Work Experience, Education, Projects). Instead of hard-coding click patterns per ATS, an LLM agent iteratively inspects the DOM, decides what to click or fill next, and repeats until the section is complete.

## Background

The existing `scanFormFields` + `fillFormFields` pipeline only fills fields that are already visible in the DOM. ATS platforms like Greenhouse, Lever, and Workday render work experience and education as empty states with an "Add" button; fields appear only after the button is clicked. A single-pass scanner misses these entirely.

## Architecture

```
content.js                           Next.js API
─────────────────────                ─────────────────────
annotate DOM with selectors   ──►    POST /api/extension/agent-fill
                                       body: { snapshot, profile, history }
execute actions               ◄──    { actions, done, reasoning }

repeat until done:true or 10 iterations
```

All agent reasoning lives server-side. `content.js` is a dumb executor: stamp selectors → snapshot → send → execute → repeat.

## DOM Snapshot Format

Before each snapshot, `content.js` walks all visible interactive elements and stamps a unique `data-bamboo-idx` attribute on each. The snapshot is a plain-text string, one element per line:

```
[button] "Add Work Experience"  bamboo=0
[button] "Add Education"  bamboo=1
[input:text] label="Job Title"  name="exp[0][title]"  bamboo=2
[input:text] label="Company"  name="exp[0][company]"  bamboo=3
[select] label="Start Month"  name="exp[0][start_month]"  bamboo=4
[input:checkbox] label="I currently work here"  name="exp[0][current]"  bamboo=5
[button] "Save"  bamboo=6
```

Elements are included if: not hidden (`display:none`, `visibility:hidden`, `aria-hidden=true`), and one of: `input`, `select`, `textarea`, `button`, `a[role=button]`, `[role=combobox]`.

The `bamboo=N` index is used in action selectors (`[data-bamboo-idx="N"]`), guaranteeing stability across DOM mutations.

## Action Schema

The API returns:

```json
{
  "reasoning": "Work experience section is closed — clicking Add to reveal fields",
  "actions": [
    { "type": "click",  "selector": "[data-bamboo-idx='0']" },
    { "type": "wait",   "ms": 700 },
    { "type": "fill",   "selector": "[data-bamboo-idx='2']", "value": "Software Engineer" },
    { "type": "fill",   "selector": "[data-bamboo-idx='3']", "value": "Acme Corp" }
  ],
  "done": false
}
```

Action types:

| Type    | Fields                        | Behaviour                                                    |
|---------|-------------------------------|--------------------------------------------------------------|
| `click` | `selector`                    | Dispatches real `MouseEvent` (trusted: false, bubbles: true) |
| `fill`  | `selector`, `value`           | Uses existing native-event injection (input + change events) |
| `wait`  | `ms`                          | `await new Promise(r => setTimeout(r, ms))`                  |
| `done`  | —                             | Terminates the agent loop                                    |

`reasoning` is logged to the console for debugging; never shown to the user.

## Agent Loop (content.js)

Triggered inside `handleFill()` after the existing static `fillFormFields` pass, once per "Fill" button press:

```
MAX_ITERATIONS = 10

for i in 1..MAX_ITERATIONS:
  annotate visible elements with data-bamboo-idx (fresh each iteration)
  snapshot = buildSnapshot()
  result = await callAgentFill({ snapshot, profileSummary, history })
  history.push({ snapshot, actions: result.actions })

  for action in result.actions:
    if action.type == 'click': dispatchClick(querySelector(action.selector))
    if action.type == 'fill':  nativeFill(querySelector(action.selector), action.value)
    if action.type == 'wait':  await sleep(action.ms)

  if result.done: break

if i == MAX_ITERATIONS and not done:
  showUserWarning("Some fields may not have been filled — the form is more complex than expected.")
```

The static pass runs first to fill all already-visible fields. The agent loop handles only the dynamic sections.

`history` carries prior snapshots + actions so the LLM can see what it already tried and avoid loops.

## API Endpoint

`POST /api/extension/agent-fill`

**Auth:** Bearer token (same pattern as `/api/extension/autofill`).

**Request body:**
```ts
{
  profile_id: string
  snapshot: string          // plain-text DOM snapshot (current iteration)
  history: Array<{          // prior iterations
    snapshot: string
    actions: Action[]
  }>
  job_context?: string      // job title + company for grounding
}
```

**Response:**
```ts
{
  actions: Action[]
  done: boolean
  reasoning: string
}
```

**System prompt (server-side):**

> You are an agent that fills job application forms. You receive a snapshot of visible form elements and a candidate profile. Return a JSON object with `actions` (array), `done` (boolean), and `reasoning` (string). Use `click` to open collapsed sections, `wait` after clicking to let fields render, and `fill` to enter values. When all relevant sections are filled, return `done: true`. Never fill fields the profile doesn't have data for. Prefer small batches of actions per iteration so you can observe the result.

**Model:** `deepseek-chat`, temperature 0.1, max_tokens 400.

## Error Handling

- **Selector not found**: skip that action, log warning, continue loop
- **API error (non-2xx)**: abort loop, show user "Agent fill failed — please fill manually"
- **Iteration cap hit**: show warning toast, don't block the user
- **LLM returns invalid JSON**: retry once with an explicit format reminder appended to the prompt; if still invalid, abort

## Known Limitations

- **Shadow DOM / iframes**: elements inside shadow roots or cross-origin iframes are not included in the snapshot. This affects Workday (iframe-heavy). Out of scope for this iteration.
- **CAPTCHA / verification steps**: the agent will hit the cap and warn the user.
- **Multi-entry sections**: the agent can click "Add" multiple times (each iteration re-snapshots), but will only fill as many entries as the profile contains.

## Cost

~$0.005–0.007 per full form fill (3–5 API calls at ~300–500 tokens each using DeepSeek pricing).
