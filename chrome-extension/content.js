;(function () {
  if (document.getElementById('__bamboo_root__')) return

  // ─── Career page detection ─────────────────────────────────────────────────

  function isJobPage() {
    const url = window.location.href.toLowerCase()
    const hostname = window.location.hostname.toLowerCase()

    // Known ATS domains → always show
    const atsDomains = [
      'greenhouse.io', 'ashbyhq.com', 'lever.co', 'workday.com',
      'smartrecruiters.com', 'jobvite.com', 'icims.com', 'taleo.net',
      'successfactors.com', 'breezy.hr', 'recruitee.com', 'workable.com',
      'bamboohr.com', 'rippling.com',
    ]
    if (atsDomains.some((d) => hostname.includes(d))) return true

    // Career-related URL path patterns
    const careerPatterns = [
      '/career', '/careers', '/job/', '/jobs/', '/apply', '/opening',
      '/position', '/vacancy', '/recruit', '/hiring', '/work-with-us',
      '/join-us', '/join-our-team', '/opportunities',
    ]
    if (careerPatterns.some((p) => url.includes(p))) return true

    // LinkedIn job pages
    if (hostname.includes('linkedin.com') && url.includes('/jobs/')) return true

    return false
  }

  if (!isJobPage()) return

  // ─── Job info extraction ───────────────────────────────────────────────────

  function extractJobInfo() {
    const url = window.location.href
    const hostname = window.location.hostname.replace(/^www\./, '')

    // Company: start from the domain, then refine for known ATSs
    const domainParts = hostname.split('.')
    let company = domainParts.length >= 2 ? domainParts[domainParts.length - 2] : hostname
    company = company.charAt(0).toUpperCase() + company.slice(1)

    const toTitleCase = (slug) =>
      slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

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

    const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || ''

    // ── Find best h1: skip navigation/header/aside elements ───────────────────
    function findMainH1() {
      // Semantic job-title selectors first
      const semantic = document.querySelector('[data-job-title], .job-title, [itemprop="title"]')
      if (semantic) return semantic.textContent.trim()

      // Walk all h1s and skip ones living inside nav/header/aside
      const mainH1 = Array.from(document.querySelectorAll('h1')).find((el) => {
        if (el.closest('header, nav, aside, [role="navigation"], [role="banner"]')) return false
        const text = el.textContent.trim()
        // Skip trivially short or suspiciously long (concatenated nav) text
        return text.length > 4 && text.length < 200
      })
      if (mainH1) return mainH1.textContent.trim()

      // Try the first heading inside <main>
      const mainEl = document.querySelector('main, [role="main"]')
      if (mainEl) {
        const h = mainEl.querySelector('h1, h2')
        if (h) return h.textContent.trim()
      }

      return document.querySelector('h1')?.textContent.trim() || ''
    }

    let title
    if (hostname.includes('linkedin.com')) {
      const raw = og || document.title || ''

      if (raw.includes(' hiring ')) {
        // New LinkedIn format: "Company hiring Job Title in Location | LinkedIn"
        const hiringParts = raw.split(' hiring ')
        company = hiringParts[0].trim()
        title = hiringParts.slice(1).join(' hiring ').split(' in ')[0].split(' | ')[0].trim()
      } else if (raw.includes(' at ')) {
        // Old LinkedIn format: "Job Title at Company | LinkedIn"
        const parts = raw.split(' at ')
        title = parts[0].trim()
        const rest = parts.slice(1).join(' at ')
        company = rest.split(' | ')[0].split(' - ')[0].trim() || company
      } else {
        // Fallback: title from raw, company from DOM
        title = raw.split(' | ')[0].split(' - ')[0].trim()
        const companyEl = document.querySelector([
          '.job-details-jobs-unified-top-card__company-name',
          '.jobs-unified-top-card__company-name',
          '.topcard__org-name-link',
          '[data-tracking-control-name="public_jobs_topcard_org_name"]',
        ].join(', '))
        if (companyEl) company = companyEl.textContent.trim()
      }
    } else {
      // All other job sites: content h1 beats generic og:title
      const h1 = findMainH1()
      title = (h1.length > 4 ? h1 : og) || og || h1 || document.title || ''
    }

    // Strip common title suffixes
    title = title
      .split(' | ')[0]
      .split(' - ')[0]
      .split(' – ')[0]
      .split(' · ')[0]
      .replace(/^Jobs? at /i, '')
      .trim()

    return { title, company, url }
  }

  // ─── Shadow DOM host ───────────────────────────────────────────────────────

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

    if (!expanded) {
      shadow.innerHTML = `
        <button id="toggle" style="
          display:flex;align-items:center;justify-content:center;
          width:40px;height:40px;border-radius:50%;
          background:#15803d;border:none;cursor:pointer;
          box-shadow:0 2px 10px rgba(0,0,0,0.2);
          transition:transform 0.15s,box-shadow 0.15s;
        " title="Track this job with Bamboo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
          </svg>
        </button>
      `
      const btn = shadow.getElementById('toggle')
      btn.onmouseenter = () => Object.assign(btn.style, { transform: 'scale(1.1)', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' })
      btn.onmouseleave = () => Object.assign(btn.style, { transform: 'scale(1)', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' })
      btn.onclick = () => {
        jobInfo = extractJobInfo()
        expanded = true
        render()
      }
    } else {
      shadow.innerHTML = `
        <div id="card" style="
          background:#fff;border-radius:14px;padding:18px;width:288px;
          box-shadow:0 8px 28px rgba(0,0,0,0.16);border:1px solid #e5e7eb;
          font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          font-size:13px;color:#111827;
        ">
          <!-- Header -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:26px;height:26px;background:#15803d;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
                  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
                </svg>
              </div>
              <span style="font-weight:700;font-size:14px;color:#111827;letter-spacing:-0.01em;">Bamboo</span>
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
