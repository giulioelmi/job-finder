const loginView = document.getElementById('login-view')
const loggedinView = document.getElementById('loggedin-view')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const loginBtn = document.getElementById('login-btn')
const logoutBtn = document.getElementById('logout-btn')
const errorMsg = document.getElementById('error-msg')
const userEmailEl = document.getElementById('user-email')

// ── Init: check if already logged in ────────────────────────────────────────

chrome.runtime.sendMessage({ type: 'GET_AUTH' }, (res) => {
  if (res?.token) {
    showLoggedIn(res.email)
  } else {
    showLogin()
  }
})

// ── Login ─────────────────────────────────────────────────────────────────────

loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim()
  const password = passwordInput.value

  if (!email || !password) {
    showError('Please enter your email and password.')
    return
  }

  hideError()
  loginBtn.disabled = true
  loginBtn.textContent = 'Signing in…'

  chrome.runtime.sendMessage({ type: 'LOGIN', email, password }, (res) => {
    if (res?.success) {
      showLoggedIn(res.email)
    } else {
      showError(res?.error || 'Login failed. Check your credentials.')
      loginBtn.disabled = false
      loginBtn.textContent = 'Sign in'
    }
  })
})

// Allow Enter key to submit
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click()
})
emailInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') passwordInput.focus()
})

// ── Logout ───────────────────────────────────────────────────────────────────

logoutBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
    showLogin()
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function showLogin() {
  loginView.style.display = 'block'
  loggedinView.style.display = 'none'
  emailInput.focus()
}

function showLoggedIn(email) {
  loginView.style.display = 'none'
  loggedinView.style.display = 'block'
  userEmailEl.textContent = email || ''
}

function showError(msg) {
  errorMsg.textContent = msg
  errorMsg.style.display = 'block'
}

function hideError() {
  errorMsg.style.display = 'none'
}
