;(function () {
  // Don't inject twice
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

    return false
  }

  if (!isJobPage()) return

  // ─── Job info extraction ───────────────────────────────────────────────────

  function extractJobInfo() {
    const url = window.location.href
    const hostname = window.location.hostname.replace(/^www\./, '')

    const toTitleCase = (slug) =>
      slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    // ── 1. JSON-LD JobPosting schema (most reliable) ──────────────────────────
    let ldTitle = ''
    let ldCompany = ''
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]')
      for (const s of scripts) {
        const data = JSON.parse(s.textContent)
        // Handle arrays and nested @graph
        const entries = Array.isArray(data) ? data : (data['@graph'] || [data])
        for (const entry of entries) {
          if (entry['@type'] === 'JobPosting') {
            ldTitle = entry.title || entry.name || ''
            ldCompany = entry.hiringOrganization?.name || ''
            break
          }
        }
        if (ldTitle) break
      }
    } catch (_) { /* malformed JSON-LD — skip */ }

    // ── 2. Company name ───────────────────────────────────────────────────────
    let company = ldCompany

    if (!company) {
      // ATS-specific: extract company slug from the URL
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
      } else if (hostname.includes('smartrecruiters.com')) {
        const m = url.match(/smartrecruiters\.com\/([^/?#]+)/)
        if (m) company = toTitleCase(m[1])
      } else if (hostname.includes('jobvite.com')) {
        const m = hostname.match(/([^.]+)\.jobvite\.com/)
        if (m) company = toTitleCase(m[1])
      }
    }

    if (!company) {
      // Fall back to domain second-level label (e.g. careers.stripe.com → "Stripe")
      const domainParts = hostname.split('.')
      const raw = domainParts.length >= 2 ? domainParts[domainParts.length - 2] : hostname
      company = raw.charAt(0).toUpperCase() + raw.slice(1)
    }

    // ── 3. Job title ──────────────────────────────────────────────────────────
    let title = ldTitle

    if (!title) {
      title = findATSTitle(hostname) || findMainH1() || ''
    }

    // Strip common site-name suffixes from whatever we got
    title = title
      .split(' | ')[0]
      .split(' - ')[0]
      .split(' – ')[0]
      .split(' · ')[0]
      .replace(/^Jobs? at /i, '')
      .trim()

    return { title, company, url }
  }

  // ATS-specific title selectors for the most common platforms
  function findATSTitle(hostname) {
    const selectors = []

    if (hostname.includes('greenhouse.io')) {
      selectors.push('.app-title', '[class*="posting-title"]', 'h1')
    } else if (hostname.includes('lever.co')) {
      selectors.push('.posting-headline h2', '.posting-title h2', 'h2')
    } else if (hostname.includes('ashbyhq.com')) {
      selectors.push('[class*="JobPosting"] h1', 'h1')
    } else if (hostname.includes('workday.com')) {
      selectors.push(
        '[data-automation-id="jobPostingHeader"]',
        '[data-automation-id="jobTitle"]',
      )
    } else if (hostname.includes('smartrecruiters.com')) {
      selectors.push('.job-title h1', '[class*="jobTitle"]')
    } else if (hostname.includes('bamboohr.com')) {
      selectors.push('#BambooHR-ATS h2', '.BambooHR-ATS-Jobs-Item h2')
    } else if (hostname.includes('rippling.com')) {
      selectors.push('[class*="job"] h1', '[class*="position"] h1')
    } else if (hostname.includes('workable.com')) {
      selectors.push('[class*="posting-header"] h1', 'h1')
    } else if (hostname.includes('recruitee.com')) {
      selectors.push('[class*="job-header"] h1', '.offer-title', 'h1')
    } else if (hostname.includes('breezy.hr')) {
      selectors.push('.position-title h1', 'h1')
    }

    for (const sel of selectors) {
      const el = document.querySelector(sel)
      const text = el?.textContent.trim()
      if (text && text.length > 2 && text.length < 200) return text
    }
    return ''
  }

  function findMainH1() {
    // Semantic job-title selectors first
    const semantic = document.querySelector('[data-job-title], .job-title, [itemprop="title"]')
    if (semantic) {
      const t = semantic.textContent.trim()
      if (t.length > 2 && t.length < 200) return t
    }

    // Walk all h1s, skip nav/header/aside
    const mainH1 = Array.from(document.querySelectorAll('h1')).find((el) => {
      if (el.closest('header, nav, aside, [role="navigation"], [role="banner"]')) return false
      const text = el.textContent.trim()
      return text.length > 4 && text.length < 200
    })
    if (mainH1) return mainH1.textContent.trim()

    // First heading inside <main>
    const mainEl = document.querySelector('main, [role="main"]')
    if (mainEl) {
      const h = mainEl.querySelector('h1, h2')
      if (h) return h.textContent.trim()
    }

    // Last resort
    return document.querySelector('h1')?.textContent.trim() || ''
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

  // ─── State ────────────────────────────────────────────────────────────────

  let expanded = false
  let dismissed = false
  let jobInfo = {}

  // ─── Render ───────────────────────────────────────────────────────────────

  function esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function render() {
    if (dismissed) {
      shadow.innerHTML = ''
      return
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
            <button id="close" style="
              background:none;border:none;cursor:pointer;
              color:#9ca3af;font-size:20px;line-height:1;padding:0;
              display:flex;align-items:center;justify-content:center;
              width:24px;height:24px;border-radius:4px;
            " title="Dismiss">×</button>
          </div>

          <!-- Job Title -->
          <div style="margin-bottom:10px;">
            <label style="display:block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Job Title</label>
            <input id="title-input" value="${esc(jobInfo.title)}" placeholder="e.g. Software Engineer" style="
              width:100%;box-sizing:border-box;border:1.5px solid #d1d5db;border-radius:8px;
              padding:7px 10px;font-size:13px;color:#111827;outline:none;
              font-family:inherit;transition:border-color 0.15s;
            " />
          </div>

          <!-- Company -->
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Company</label>
            <input id="company-input" value="${esc(jobInfo.company)}" placeholder="e.g. Stripe" style="
              width:100%;box-sizing:border-box;border:1.5px solid #d1d5db;border-radius:8px;
              padding:7px 10px;font-size:13px;color:#111827;outline:none;
              font-family:inherit;transition:border-color 0.15s;
            " />
          </div>

          <!-- Error / success message -->
          <div id="msg" style="display:none;font-size:12px;margin-bottom:10px;padding:7px 10px;border-radius:7px;"></div>

          <!-- Apply button -->
          <button id="apply-btn" style="
            width:100%;padding:10px;background:#15803d;color:#fff;
            border:none;border-radius:9px;font-size:13px;font-weight:600;
            cursor:pointer;font-family:inherit;letter-spacing:0.01em;
            transition:background 0.15s;
          ">✓ Mark as Applied</button>

          <!-- Minimize -->
          <button id="minimize" style="
            width:100%;padding:6px;background:none;color:#9ca3af;
            border:none;border-radius:7px;font-size:12px;cursor:pointer;
            margin-top:6px;font-family:inherit;
          ">Minimize</button>
        </div>
      `

      // Focus styles
      const inputs = shadow.querySelectorAll('input')
      inputs.forEach((inp) => {
        inp.onfocus = () => (inp.style.borderColor = '#15803d')
        inp.onblur = () => (inp.style.borderColor = '#d1d5db')
      })

      shadow.getElementById('close').onclick = () => { dismissed = true; render() }
      shadow.getElementById('minimize').onclick = () => { expanded = false; render() }
      shadow.getElementById('apply-btn').onclick = handleApply
    }
  }

  // ─── Handle apply ──────────────────────────────────────────────────────────

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
    } catch (_) {
      showMsg('Could not reach the extension. Try reloading the page.', 'error')
      resetBtn(btn)
      return
    }

    if (response.success) {
      btn.style.background = '#16a34a'
      btn.style.opacity = '1'
      btn.textContent = '✓ Added to Bamboo!'
      showMsg(`"${title}" saved to your applications.`, 'success')
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
    btn.textContent = '✓ Mark as Applied'
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

  // ─── Init ─────────────────────────────────────────────────────────────────

  render()
})()
