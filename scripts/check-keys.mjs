// Run after adding your keys: node --env-file=.env.local scripts/check-keys.mjs
// Calls each live service once with a trivial request and says what is missing or wrong.
const env = process.env
let failed = 0
const check = async (name, vars, run) => {
  const missing = vars.filter(v => !env[v])
  if (missing.length) { console.log(`SKIP  ${name}: set ${missing.join(', ')}`); failed++; return }
  try { console.log(`PASS  ${name}: ${await run()}`) } catch (e) { console.log(`FAIL  ${name}: ${e.message}`); failed++ }
}
const get = async (url, headers = {}, init = {}) => {
  const res = await fetch(url, { headers, ...init })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`)
  return res.json()
}

await check('Supabase tables', ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'], async () => {
  const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  for (const table of ['career_profiles', 'subscriptions', 'agent_matches']) await get(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?limit=1`, h).catch(e => { throw new Error(`${table}: ${e.message} (did you run supabase/migration_ai_agent.sql?)`) })
  const buckets = await get(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/bucket`, h)
  if (!buckets.some(b => b.name === 'resumes')) throw new Error('storage bucket "resumes" is missing (create it as a private bucket)')
  return 'career_profiles, subscriptions, agent_matches and the resumes bucket exist'
})

await check('Anthropic', ['ANTHROPIC_API_KEY'], async () => {
  const r = await get(`${env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com'}/v1/messages`, { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    { method: 'POST', body: JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 16, messages: [{ role: 'user', content: 'Say ok' }] }) })
  return `claude-opus-5-5 replied (${r.usage?.input_tokens} in / ${r.usage?.output_tokens} out tokens)`
})

await check('Stripe', ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET'], async () => {
  const price = await get(`${env.STRIPE_API_BASE ?? 'https://api.stripe.com'}/v1/prices/${env.STRIPE_PRICE_ID}`, { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` })
  if (!price.recurring) throw new Error('that price is not recurring: create a monthly subscription price')
  if (!env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) throw new Error('STRIPE_WEBHOOK_SECRET should start with whsec_')
  return `price ${price.unit_amount / 100} ${price.currency}/${price.recurring.interval}, key is ${env.STRIPE_SECRET_KEY.startsWith('sk_test') ? 'TEST' : 'LIVE'} mode`
})

await check('Resend', ['RESEND_API_KEY'], async () => {
  const r = await get('https://api.resend.com/domains', { Authorization: `Bearer ${env.RESEND_API_KEY}` })
  const verified = (r.data ?? []).filter(d => d.status === 'verified').map(d => d.name)
  if (!verified.length) throw new Error('no verified sending domain yet (verify one in Resend)')
  return `verified domains: ${verified.join(', ')}; RESEND_FROM_EMAIL must use one of them`
})

await check('Cron', ['CRON_SECRET', 'NEXT_PUBLIC_APP_URL'], async () => {
  const r = await get(`${env.NEXT_PUBLIC_APP_URL}/api/cron/agent?secret=${env.CRON_SECRET}`)
  return `/api/cron/agent answered ${JSON.stringify(r)}`
})

console.log(failed ? `\n${failed} check(s) need attention` : '\nAll keys work')
process.exit(failed ? 1 : 0)
