;(function () {
  if (document.getElementById('__bamboo_root__')) return

  const STORAGE_KEY = 'bamboo-extension-state'
  const DISMISS_MS = 6 * 60 * 60 * 1000
  const APPLY_KEYWORDS = [
    'apply',
    'application',
    'candidate',
    'jobs',
    'careers',
    'greenhouse',
    'ashby',
    'lever',
    'workday',
  ]

  function toTitleCase(slug) {
    return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function cleanTitle(raw) {
    return (raw || '')
      .split(' | ')[0]
      .split(' - ')[0]
      .split(' – ')[0]
      .split(' · ')[0]
      .replace(/^Jobs? at /i, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function extractJobInfo() {
    const url = window.location.href
    const hostname = window.location.hostname.replace(/^www\./, '')

    const domainParts = hostname.split('.')
    let company = domainParts.length >= 2 ? domainParts[domainParts.length - 2] : hostname
    company = toTitleCase(company)

    if (hostname.includes('greenhouse.io')) {
      const m = url.match(/greenhouse\.io\/([^/?#]+)/)
      if (m) company = toTitleCase(m[1])
    } else if (hostname.includes('ashbyhq.com')) {
      const m = url.match(/ashbyhq\.com\/([^/?#]+)/)
      if (m) company = toTitleCase(m[1])
    } else if (hostname.includes('lever.co')) {
      const m = url.match(/lever\.co\/([^/?#]+)/)
      if (m) company = toTitleCase(m[1])
    } else if (hostname.includes('workday.com')) {
      const m = hostname.match(/([^.]+)\.myworkdayjobs/)
      if (m) company = toTitleCase(m[1])
    }

    const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    for (const script of jsonLdScripts) {
      try {
        const parsed = JSON.parse(script.textContent || '{}')
        const records = Array.isArray(parsed) ? parsed : [parsed]
        for (const record of records) {
          if (record?.['@type'] === 'JobPosting') {
            const title = cleanTitle(record.title)
            const hiringOrg = record.hiringOrganization?.name?.trim()
            return {
              title,
              company: hiringOrg || company,
              url,
            }
          }
        }
      } catch {}
    }

    const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || ''
    const twitter = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || ''
    const h1 = document.querySelector('h1')?.textContent?.trim() || ''
    let title = cleanTitle(og || twitter || h1 || document.title || '')

    if (hostname.includes('linkedin.com') && title.includes(' at ')) {
      const parts = title.split(' at ')
      title = cleanTitle(parts[0])
      const rest = parts.slice(1).join(' at ')
      company = rest.split(' | ')[0].split(' - ')[0].trim() || company
    }

    return { title, company, url }
  }

  function hasApplicationSignals() {
    const urlText = `${window.location.href} ${document.title}`.toLowerCase()
    const keywordMatch = APPLY_KEYWORDS.some((keyword) => urlText.includes(keyword))

    const form = document.querySelector('form')
    const fileInput = document.querySelector('input[type="file"]')
    const submitButton = Array.from(document.querySelectorAll('button, input[type="submit"]')).find((el) => {
      const text = (el.textContent || el.value || '').toLowerCase()
      return /apply|submit application|send application|finish application/.test(text)
    })

    const atsHostMatch = /greenhouse\.io|ashbyhq\.com|lever\.co|myworkdayjobs\.com|icims\.com|jobvite\.com/.test(
      window.location.hostname
    )

    return Boolean(atsHostMatch || (keywordMatch && form) || fileInput || submitButton)
  }

  function getSessionState() {
    try {
      const allState = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}')
      return allState[window.location.href] || {}
    } catch {
      return {}
    }
  }

  function setSessionState(nextState) {
    try {
      const allState = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}')
      allState[window.location.href] = {
        ...(allState[window.location.href] || {}),
        ...nextState,
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(allState))
    } catch {}
  }

  const host = document.createElement('div')
  host.id = '__bamboo_root__'
  Object.assign(host.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '2147483647',
  })
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })

  const jobInfo = extractJobInfo()
  const isLikelyApplicationPage = hasApplicationSignals()
  const sessionState = getSessionState()
  const recentlyDismissed = Boolean(sessionState.dismissedAt && Date.now() - sessionState.dismissedAt < DISMISS_MS)

  let expanded = isLikelyApplicationPage && !recentlyDismissed
  let dismissed = recentlyDismissed

  function esc(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function getSummaryLabel() {
    if (jobInfo.title && jobInfo.company) return `${jobInfo.title} - ${jobInfo.company}`
    return jobInfo.title || jobInfo.company || 'Track this application'
  }

  function renderCollapsed() {
    shadow.innerHTML = `
      <button id="toggle" style="
        display:flex;align-items:center;justify-content:center;
        width:44px;height:44px;border-radius:999px;
        background:#15803d;border:none;cursor:pointer;
        box-shadow:0 2px 10px rgba(0,0,0,0.2);
        font-size:20px;line-height:1;
        transition:transform 0.15s,box-shadow 0.15s;
      " title="${esc(getSummaryLabel())}">🎋</button>
    `
    const btn = shadow.getElementById('toggle')
    btn.onmouseenter = () =>
      Object.assign(btn.style, { transform: 'scale(1.08)', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' })
    btn.onmouseleave = () => Object.assign(btn.style, { transform: 'scale(1)', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' })
    btn.onclick = () => {
      dismissed = false
      expanded = true
      setSessionState({ dismissedAt: null })
      render()
    }
  }

  function renderExpanded() {
    shadow.innerHTML = `
      <div id="card" style="
        background:#fff;border-radius:14px;padding:18px;width:320px;
        box-shadow:0 8px 28px rgba(0,0,0,0.16);border:1px solid #e5e7eb;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:13px;color:#111827;
      ">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;gap:12px;">
          <div>
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
              <span style="font-size:20px;line-height:1;">🎋</span>
              <span style="font-weight:700;font-size:14px;color:#111827;letter-spacing:-0.01em;">Bamboo Tracker</span>
            </div>
            <div style="font-size:12px;color:#4b5563;line-height:1.45;">${esc(getSummaryLabel())}</div>
          </div>
          <button id="close" style="
            background:none;border:none;cursor:pointer;
            color:#9ca3af;font-size:20px;line-height:1;padding:0;
            display:flex;align-items:center;justify-content:center;
            width:24px;height:24px;border-radius:4px;
          " title="Dismiss">×</button>
        </div>

        <div style="margin-bottom:10px;padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;color:#166534;line-height:1.45;">
          ${isLikelyApplicationPage ? 'Application page detected. Mark it applied when you finish.' : 'Confirm the job details, then save it to Bamboo.'}
        </div>

        <div style="margin-bottom:10px;">
          <label style="display:block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Job Title</label>
          <input id="title-input" value="${esc(jobInfo.title)}" placeholder="e.g. Software Engineer" style="
            width:100%;box-sizing:border-box;border:1.5px solid #d1d5db;border-radius:8px;
            padding:7px 10px;font-size:13px;color:#111827;outline:none;
            font-family:inherit;transition:border-color 0.15s;
          " />
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Company</label>
          <input id="company-input" value="${esc(jobInfo.company)}" placeholder="e.g. Stripe" style="
            width:100%;box-sizing:border-box;border:1.5px solid #d1d5db;border-radius:8px;
            padding:7px 10px;font-size:13px;color:#111827;outline:none;
            font-family:inherit;transition:border-color 0.15s;
          " />
        </div>

        <div id="msg" style="display:none;font-size:12px;margin-bottom:10px;padding:7px 10px;border-radius:7px;"></div>

        <button id="apply-btn" style="
          width:100%;padding:10px;background:#15803d;color:#fff;
          border:none;border-radius:9px;font-size:13px;font-weight:600;
          cursor:pointer;font-family:inherit;letter-spacing:0.01em;
          transition:background 0.15s;
        ">Applied</button>

        <button id="minimize" style="
          width:100%;padding:6px;background:none;color:#9ca3af;
          border:none;border-radius:7px;font-size:12px;cursor:pointer;
          margin-top:6px;font-family:inherit;
        ">Minimize</button>
      </div>
    `

    const inputs = shadow.querySelectorAll('input')
    inputs.forEach((inp) => {
      inp.onfocus = () => (inp.style.borderColor = '#15803d')
      inp.onblur = () => (inp.style.borderColor = '#d1d5db')
    })

    shadow.getElementById('close').onclick = () => {
      dismissed = true
      setSessionState({ dismissedAt: Date.now() })
      render()
    }
    shadow.getElementById('minimize').onclick = () => {
      expanded = false
      render()
    }
    shadow.getElementById('apply-btn').onclick = handleApply
  }

  function render() {
    if (dismissed) {
      shadow.innerHTML = ''
      return
    }

    if (expanded) {
      renderExpanded()
      return
    }

    renderCollapsed()
  }

  async function handleApply() {
    const btn = shadow.getElementById('apply-btn')
    const title = shadow.getElementById('title-input').value.trim()
    const company = shadow.getElementById('company-input').value.trim()

    if (!title) {
      showMsg('Please enter a job title.', 'error')
      return
    }

    btn.disabled = true
    btn.textContent = 'Saving…'
    btn.style.opacity = '0.7'

    let response
    try {
      response = await chrome.runtime.sendMessage({
        type: 'TRACK_APPLICATION',
        data: { title, company, url: window.location.href },
      })
    } catch {
      showMsg('Could not reach the extension. Try reloading the page.', 'error')
      resetBtn(btn)
      return
    }

    if (response.success) {
      btn.style.background = '#16a34a'
      btn.style.opacity = '1'
      btn.textContent = '✓ Added to Bamboo!'
      showMsg(`"${title}" saved to your applications.`, 'success')
      setSessionState({ dismissedAt: Date.now() })
      setTimeout(() => {
        expanded = false
        dismissed = true
        render()
      }, 2200)
    } else if (response.error === 'NOT_LOGGED_IN') {
      showMsg('Log in first — click the 🎋 extension icon in your toolbar.', 'error')
      resetBtn(btn)
    } else {
      showMsg(response.error || 'Something went wrong. Please try again.', 'error')
      resetBtn(btn)
    }
  }

  function resetBtn(btn) {
    btn.disabled = false
    btn.textContent = 'Applied'
    btn.style.opacity = '1'
  }

  function showMsg(text, type) {
    const el = shadow.getElementById('msg')
    el.style.display = 'block'
    el.textContent = text
    if (type === 'error') {
      el.style.background = '#fef2f2'
      el.style.color = '#dc2626'
    } else {
      el.style.background = '#f0fdf4'
      el.style.color = '#15803d'
    }
  }

  render()
})()
