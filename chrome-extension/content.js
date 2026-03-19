;(function () {
  if (document.getElementById('__bamboo_root__')) return

  const STORAGE_KEY = 'bamboo-extension-state'
  const DISMISS_MS = 6 * 60 * 60 * 1000
  const ATS_HOST_PATTERN = /greenhouse\.io|ashbyhq\.com|lever\.co|myworkdayjobs\.com|icims\.com|jobvite\.com/
  const GENERIC_TITLE_PATTERN = /^(build your career|careers?( at)?|search jobs|job search|join our team|apply now|opportunities?)(\b|$)/i
  const TITLE_SELECTOR_CANDIDATES = [
    'main h1',
    'article h1',
    '[data-testid*="job"] h1',
    '[class*="job"] h1',
    '[class*="posting"] h1',
    'h1',
    'main h2',
    'article h2',
  ]
  const COMPANY_SELECTORS = [
    '[data-testid*="company"]',
    '[class*="company"]',
    '[class*="employer"]',
    '[data-qa*="company"]',
  ]

  let state = analyzePage()
  if (!state.shouldInject) return

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

  let expanded = state.autoOpen && !state.recentlyDismissed
  let dismissed = state.recentlyDismissed
  let reevaluateTimer = null

  function toTitleCase(slug) {
    return (slug || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function cleanText(raw) {
    return (raw || '').replace(/\s+/g, ' ').trim()
  }

  function cleanTitle(raw) {
    return cleanText(
      (raw || '')
        .split(' | ')[0]
        .split(' – ')[0]
        .split(' · ')[0]
        .replace(/^Jobs? at /i, '')
        .replace(/\s+-\s+(Remote|Hybrid|Onsite|On-site)$/i, '')
    )
  }

  function isVisible(el) {
    if (!el) return false
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden' && el.getBoundingClientRect().height > 0
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

  function esc(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function parseJsonLdRecords() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    const records = []

    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent || '{}')
        const stack = Array.isArray(parsed) ? [...parsed] : [parsed]
        while (stack.length > 0) {
          const value = stack.shift()
          if (!value || typeof value !== 'object') continue
          if (Array.isArray(value)) {
            stack.push(...value)
            continue
          }
          if (value['@graph']) stack.push(value['@graph'])
          records.push(value)
        }
      } catch {}
    }

    return records
  }

  function detectCompanyFromHost(hostname, url) {
    const normalizedHost = hostname.replace(/^www\./, '')
    const domainParts = normalizedHost.split('.')
    let company = domainParts.length >= 2 ? domainParts[domainParts.length - 2] : normalizedHost

    if (normalizedHost.includes('greenhouse.io')) {
      const match = url.match(/greenhouse\.io\/([^/?#]+)/)
      if (match) company = match[1]
    } else if (normalizedHost.includes('ashbyhq.com')) {
      const match = url.match(/ashbyhq\.com\/([^/?#]+)/)
      if (match) company = match[1]
    } else if (normalizedHost.includes('lever.co')) {
      const match = url.match(/lever\.co\/([^/?#]+)/)
      if (match) company = match[1]
    } else if (normalizedHost.includes('workday.com')) {
      const match = normalizedHost.match(/([^.]+)\.myworkdayjobs/)
      if (match) company = match[1]
    }

    return toTitleCase(company)
  }

  function collectTitleCandidates() {
    const candidates = []
    const jsonLd = parseJsonLdRecords()

    for (const record of jsonLd) {
      const type = Array.isArray(record['@type']) ? record['@type'].join(' ') : record['@type']
      if (typeof type === 'string' && type.includes('JobPosting') && record.title) {
        candidates.push({ text: record.title, source: 'jsonld', score: 120 })
      }
    }

    TITLE_SELECTOR_CANDIDATES.forEach((selector, index) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (!isVisible(el)) return
        const text = cleanTitle(el.textContent)
        if (!text) return
        const withinMain = el.closest('main, article, [role="main"]') ? 12 : 0
        const headingBonus = el.tagName === 'H1' ? 18 : 10
        candidates.push({ text, source: selector, score: 95 - index * 3 + withinMain + headingBonus })
      })
    })

    const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
    const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')
    const documentTitle = document.title

    ;[
      { text: metaTitle, source: 'og:title', score: 72 },
      { text: twitterTitle, source: 'twitter:title', score: 70 },
      { text: documentTitle, source: 'document.title', score: 62 },
    ].forEach((candidate) => {
      const text = cleanTitle(candidate.text)
      if (text) candidates.push({ ...candidate, text })
    })

    return candidates
  }

  function pickBestTitle() {
    const seen = new Set()
    const ranked = collectTitleCandidates()
      .filter((candidate) => {
        const text = cleanTitle(candidate.text)
        if (!text) return false
        if (GENERIC_TITLE_PATTERN.test(text)) return false
        if (text.length < 4) return false
        const key = text.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => b.score - a.score)

    return ranked[0]?.text || ''
  }

  function pickBestCompany(defaultCompany) {
    const jsonLd = parseJsonLdRecords()
    for (const record of jsonLd) {
      const type = Array.isArray(record['@type']) ? record['@type'].join(' ') : record['@type']
      if (typeof type === 'string' && type.includes('JobPosting')) {
        const company = cleanText(record.hiringOrganization?.name)
        if (company) return company
      }
    }

    for (const selector of COMPANY_SELECTORS) {
      const el = Array.from(document.querySelectorAll(selector)).find((node) => isVisible(node))
      const text = cleanText(el?.textContent)
      if (text && text.length <= 80 && !GENERIC_TITLE_PATTERN.test(text)) return text
    }

    const metaSite = cleanText(document.querySelector('meta[property="og:site_name"]')?.getAttribute('content'))
    if (metaSite && !/careers|jobs/i.test(metaSite)) return metaSite

    return defaultCompany
  }

  function detectJobSignals(jobInfo) {
    const url = window.location.href.toLowerCase()
    const text = document.body?.innerText?.slice(0, 4000).toLowerCase() || ''
    const hasJsonLdJob = parseJsonLdRecords().some((record) => {
      const type = Array.isArray(record['@type']) ? record['@type'].join(' ') : record['@type']
      return typeof type === 'string' && type.includes('JobPosting')
    })
    const applyButtons = getApplyButtons()
    const hasJobHeading = Boolean(jobInfo.title && jobInfo.title.length >= 6)
    const jobKeywords = /job description|responsibilities|qualifications|req\.? id|apply now|what you'll do|what you’ll do/.test(text)
    const urlSignals = /\/jobs?\b|\/careers?\b|\/job\/|\/position\//.test(url)
    const atsHost = ATS_HOST_PATTERN.test(window.location.hostname)

    return {
      hasJsonLdJob,
      hasJobHeading,
      hasApplyButtons: applyButtons.length > 0,
      jobKeywords,
      urlSignals,
      atsHost,
    }
  }

  function getApplyButtons() {
    return Array.from(document.querySelectorAll('a, button, input[type="submit"], input[type="button"]')).filter((el) => {
      if (!isVisible(el)) return false
      const text = cleanText(el.textContent || el.value || '').toLowerCase()
      if (!text) return false
      return /^(apply|apply now|apply for job|submit application|continue application|start application)$/.test(text)
    })
  }

  function detectApplicationSignals() {
    const forms = Array.from(document.querySelectorAll('form')).filter((form) => isVisible(form))
    const inputs = Array.from(document.querySelectorAll('input, textarea, select')).filter((el) => isVisible(el))
    const meaningfulInputs = inputs.filter((el) => {
      const type = (el.getAttribute('type') || '').toLowerCase()
      return !['hidden', 'search', 'submit', 'button', 'reset'].includes(type)
    })
    const applicantFields = meaningfulInputs.filter((el) => {
      const haystack = `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase()
      return /name|email|phone|resume|cv|cover|linkedin|portfolio|website|work authorization|salary/.test(haystack)
    })
    const hasResumeUpload = inputs.some((el) => (el.getAttribute('type') || '').toLowerCase() === 'file')
    const submitButtons = getApplyButtons().concat(
      Array.from(document.querySelectorAll('button, input[type="submit"]')).filter((el) => {
        if (!isVisible(el)) return false
        const text = cleanText(el.textContent || el.value || '').toLowerCase()
        return /submit application|finish application|review application|send application/.test(text)
      })
    )
    const formText = forms.map((form) => cleanText(form.innerText).toLowerCase()).join(' ')
    const currentStepText = cleanText(document.body?.innerText?.slice(0, 2500)).toLowerCase()
    const url = window.location.href.toLowerCase()
    const atsHost = ATS_HOST_PATTERN.test(window.location.hostname)

    const isActualApplicationForm =
      hasResumeUpload ||
      applicantFields.length >= 2 ||
      (forms.length > 0 && meaningfulInputs.length >= 4 && /resume|cover letter|phone|email/.test(formText)) ||
      /\/apply\b|\/application\b|\/candidate\b/.test(url) ||
      /submit application|review your application|contact information|work experience|education/.test(currentStepText)

    return {
      forms: forms.length,
      meaningfulInputs: meaningfulInputs.length,
      applicantFields: applicantFields.length,
      hasResumeUpload,
      submitButtons: submitButtons.length,
      atsHost,
      isActualApplicationForm,
    }
  }

  function analyzePage() {
    const url = window.location.href
    const hostname = window.location.hostname
    const defaultCompany = detectCompanyFromHost(hostname, url)
    const title = pickBestTitle()
    const company = pickBestCompany(defaultCompany)
    const jobInfo = { title, company, url }
    const sessionState = getSessionState()
    const recentlyDismissed = Boolean(sessionState.dismissedAt && Date.now() - sessionState.dismissedAt < DISMISS_MS)
    const jobSignals = detectJobSignals(jobInfo)
    const applicationSignals = detectApplicationSignals()

    const shouldInject =
      applicationSignals.isActualApplicationForm ||
      jobSignals.hasJsonLdJob ||
      (jobSignals.hasJobHeading && jobSignals.hasApplyButtons) ||
      (jobSignals.atsHost && (jobSignals.hasJobHeading || jobSignals.hasApplyButtons || applicationSignals.meaningfulInputs > 0)) ||
      (jobSignals.urlSignals && jobSignals.hasJobHeading)

    const autoOpen = applicationSignals.isActualApplicationForm && Boolean(title)

    return {
      shouldInject,
      autoOpen,
      recentlyDismissed,
      isLikelyApplicationPage: autoOpen,
      jobInfo,
    }
  }

  function getSummaryLabel() {
    if (state.jobInfo.title && state.jobInfo.company) return `${state.jobInfo.title} - ${state.jobInfo.company}`
    return state.jobInfo.title || state.jobInfo.company || 'Track this application'
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
          ${state.isLikelyApplicationPage ? 'Application form detected. Mark it applied after you submit.' : 'Job detected. Open this after you apply to save it to Bamboo.'}
        </div>

        <div style="margin-bottom:10px;">
          <label style="display:block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Job Title</label>
          <input id="title-input" value="${esc(state.jobInfo.title)}" placeholder="e.g. Software Engineer" style="
            width:100%;box-sizing:border-box;border:1.5px solid #d1d5db;border-radius:8px;
            padding:7px 10px;font-size:13px;color:#111827;outline:none;
            font-family:inherit;transition:border-color 0.15s;
          " />
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Company</label>
          <input id="company-input" value="${esc(state.jobInfo.company)}" placeholder="e.g. Stripe" style="
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
    if (!state.shouldInject) {
      host.style.display = 'none'
      shadow.innerHTML = ''
      return
    }

    host.style.display = 'block'

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

  function reevaluatePage() {
    const nextState = analyzePage()
    const wasVisible = state.shouldInject && !dismissed
    const shouldAutoOpen = nextState.autoOpen && !nextState.recentlyDismissed && !dismissed

    state = nextState

    if (!state.shouldInject) {
      expanded = false
      render()
      return
    }

    if (!wasVisible && shouldAutoOpen) {
      expanded = true
    } else if (shouldAutoOpen && !expanded) {
      expanded = true
    }

    render()
  }

  function scheduleReevaluation(delay = 250) {
    window.clearTimeout(reevaluateTimer)
    reevaluateTimer = window.setTimeout(reevaluatePage, delay)
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('a, button, input[type="submit"], input[type="button"]') : null
    if (!target) return
    const text = cleanText(target.textContent || target.value || '').toLowerCase()
    if (/apply|continue application|start application/.test(text)) {
      scheduleReevaluation(600)
    }
  }, true)

  const observer = new MutationObserver(() => {
    scheduleReevaluation(300)
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  render()
})()
