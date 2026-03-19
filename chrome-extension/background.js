// =============================================================================
// CONFIGURATION — fill in your values before loading the extension
// =============================================================================
const SUPABASE_URL = 'https://tlbbsffehzmoqyrfotau.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_N7uqXU5l44f0uRIVNFXjLw_8LyAvlBQ'
const APP_URL = 'https://www.jobbamboo.com'
// =============================================================================

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
})

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
  } catch {
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
  } catch {}

  // Refresh failed — clear session so user is prompted to log in again
  await chrome.storage.local.remove(['access_token', 'refresh_token', 'user_email', 'token_expires_at'])
  return { token: null, email: null }
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
  } catch {
    return { success: false, error: 'Network error — check your connection' }
  }
}
