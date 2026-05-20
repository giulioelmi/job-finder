// =============================================================================
// CONFIGURATION — fill in your values before loading the extension
// =============================================================================
const SUPABASE_URL = 'https://tlbbsffehzmoqyrfotau.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_N7uqXU5l44f0uRIVNFXjLw_8LyAvlBQ'
const APP_URL = 'https://www.jobbamboo.com'
// =============================================================================

// MV3 service workers can restart unexpectedly; guard against transient init errors
if (!chrome?.runtime?.onMessage) {
  console.error('[Bamboo] chrome.runtime not available — service worker may be reinitializing')
} else {
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'LOGIN') {
    handleLogin(message.email, message.password).then(sendResponse)
    return true
  }
  if (message.type === 'LOGOUT') {
    chrome.storage.local.remove(['access_token', 'refresh_token', 'user_email', 'token_expires_at'])
    sendResponse({ success: true })
  }
  if (message.type === 'GET_AUTH') {
    getValidToken().then(sendResponse)
    return true
  }
  if (message.type === 'TRACK_APPLICATION') {
    trackApplication(message.data).then(sendResponse)
    return true
  }
  if (message.type === 'SAVE_CONTACT') {
    saveContact(message.data).then(sendResponse)
    return true
  }
  if (message.type === 'EXTRACT_JOB') {
    extractJob(message.data).then(sendResponse)
    return true
  }
  if (message.type === 'GET_PROFILES') {
    getProfiles().then(sendResponse)
    return true
  }
  if (message.type === 'AUTOFILL') {
    autofill(message.data).then(sendResponse)
    return true
  }
  if (message.type === 'COVER_LETTER') {
    generateCoverLetter(message.data).then(sendResponse)
    return true
  }
  if (message.type === 'GET_RESUME') {
    getResume(message.data).then(sendResponse)
    return true
  }
  if (message.type === 'OPEN_COVER_LETTER') {
    openCoverLetter(message.data).then(sendResponse)
    return true
  }
  if (message.type === 'AGENT_FILL') {
    agentFill(message.data).then(sendResponse)
    return true
  }
})
} // end chrome.runtime.onMessage guard

async function handleLogin(email, password) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (data.access_token) {
      await chrome.storage.local.set({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_email: data.user?.email,
        token_expires_at: Date.now() + data.expires_in * 1000,
      })
      return { success: true, email: data.user?.email }
    }
    return { success: false, error: data.error_description || data.msg || 'Login failed' }
  } catch (e) {
    return { success: false, error: 'Network error — check your connection' }
  }
}

async function getValidToken() {
  const data = await chrome.storage.local.get(['access_token', 'refresh_token', 'token_expires_at', 'user_email'])
  if (!data.access_token) return { token: null, email: null }

  // Refresh if expiring in less than 5 minutes
  if (data.token_expires_at && Date.now() > data.token_expires_at - 5 * 60 * 1000) {
    return refreshToken(data.refresh_token)
  }

  return { token: data.access_token, email: data.user_email }
}

async function refreshToken(refreshToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const data = await res.json()
    if (data.access_token) {
      await chrome.storage.local.set({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_email: data.user?.email,
        token_expires_at: Date.now() + data.expires_in * 1000,
      })
      return { token: data.access_token, email: data.user?.email }
    }
  } catch (_) {}

  // Refresh failed — clear session so user is prompted to log in again
  await chrome.storage.local.remove(['access_token', 'refresh_token', 'user_email', 'token_expires_at'])
  return { token: null, email: null }
}

async function saveContact({ name, company, role, linkedin_url, notes }) {
  const { token } = await getValidToken()
  if (!token) return { success: false, error: 'NOT_LOGGED_IN' }

  try {
    const res = await fetch(`${APP_URL}/api/networking/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, company, role, linkedin_url, notes }),
    })

    if (res.ok) return { success: true }
    const err = await res.json().catch(() => ({}))
    return { success: false, error: err.error || `Server error (${res.status})` }
  } catch (e) {
    return { success: false, error: 'Network error — check your connection' }
  }
}

async function extractJob({ text, url }) {
  const { token } = await getValidToken()
  if (!token) return { error: 'NOT_LOGGED_IN' }

  try {
    const res = await fetch(`${APP_URL}/api/extension/extract-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ text, url }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { error: body.error || 'REQUEST_FAILED', detail: body.detail || `HTTP ${res.status}` }
    }
    return body
  } catch (e) {
    return { error: 'NETWORK_ERROR', detail: String(e?.message || e) }
  }
}

async function getProfiles() {
  const { token } = await getValidToken()
  if (!token) return { error: 'NOT_LOGGED_IN' }

  try {
    const res = await fetch(`${APP_URL}/api/profiles`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { error: body.error || `Server error (${res.status})` }
    return { profiles: body.profiles }
  } catch (e) {
    return { error: 'Network error — check your connection' }
  }
}

async function autofill({ profileId, formFields, jobTitle, company, profileOverrides }) {
  const { token } = await getValidToken()
  if (!token) return { error: 'NOT_LOGGED_IN' }

  try {
    const res = await fetch(`${APP_URL}/api/extension/autofill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        profile_id: profileId,
        form_fields: formFields,
        job_title: jobTitle,
        company,
        profile_overrides: profileOverrides || {},
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { error: body.error || `Server error (${res.status})` }
    return { fields: body.fields }
  } catch (e) {
    return { error: 'Network error — check your connection' }
  }
}

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

async function generateCoverLetter({ profileId, jobTitle, company, jobContext, customPrompt }) {
  const { token } = await getValidToken()
  if (!token) return { error: 'NOT_LOGGED_IN' }

  try {
    const res = await fetch(`${APP_URL}/api/extension/cover-letter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        profile_id: profileId,
        job_title: jobTitle,
        company,
        job_context: jobContext,
        custom_prompt: customPrompt,
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { error: body.error || `Server error (${res.status})` }
    return { cover_letter: body.cover_letter }
  } catch (e) {
    return { error: 'Network error — check your connection' }
  }
}

async function getResume({ profileId }) {
  const { token } = await getValidToken()
  if (!token) return { error: 'NOT_LOGGED_IN' }

  try {
    const metaRes = await fetch(`${APP_URL}/api/profiles/${profileId}/resume`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const meta = await metaRes.json().catch(() => ({}))
    if (!metaRes.ok) return { error: meta.error || `Server error (${metaRes.status})` }

    const { signed_url, filename } = meta
    const fileRes = await fetch(signed_url)
    if (!fileRes.ok) return { error: 'Failed to fetch resume file' }

    const mimeType = fileRes.headers.get('Content-Type') || 'application/octet-stream'
    const buffer = await fileRes.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)
    return { base64, mimeType, filename }
  } catch (e) {
    return { error: 'Network error — check your connection' }
  }
}

async function openCoverLetter({ profileId, jobTitle, company, jobContext, customPrompt }) {
  const result = await generateCoverLetter({ profileId, jobTitle, company, jobContext, customPrompt })
  if (result.error) return { error: result.error }

  await chrome.storage.local.set({
    cover_letter_draft: { coverLetter: result.cover_letter, jobTitle, company },
  })
  chrome.tabs.create({ url: `${APP_URL}/cover-letter` })
  return { success: true }
}

async function trackApplication({ title, company, url }) {
  const { token } = await getValidToken()
  if (!token) return { success: false, error: 'NOT_LOGGED_IN' }

  try {
    const res = await fetch(`${APP_URL}/api/applications/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ title, company, url, status: 'applied' }),
    })

    if (res.ok) return { success: true }

    const err = await res.json().catch(() => ({}))
    return { success: false, error: err.error || `Server error (${res.status})` }
  } catch (e) {
    return { success: false, error: 'Network error — check your connection' }
  }
}
