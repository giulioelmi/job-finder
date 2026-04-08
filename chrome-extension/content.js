;(function () {
  // Don't inject twice
  if (document.getElementById('__bamboo_root__')) return

  // ─── Career page detection ─────────────────────────────────────────────────

  function isJobPage() {
    const url = window.location.href.toLowerCase()
    const hostname = window.location.hostname.toLowerCase()

    const atsDomains = [
      'greenhouse.io', 'ashbyhq.com', 'lever.co', 'workday.com',
      'smartrecruiters.com', 'jobvite.com', 'icims.com', 'taleo.net',
      'successfactors.com', 'breezy.hr', 'recruitee.com', 'workable.com',
      'bamboohr.com', 'rippling.com',
    ]
    if (atsDomains.some((d) => hostname.includes(d))) return true

    const careerPatterns = [
      '/career', '/careers', '/job/', '/jobs/', '/apply', '/opening',
      '/position', '/vacancy', '/recruit', '/hiring', '/work-with-us',
      '/join-us', '/join-our-team', '/opportunities',
    ]
    if (careerPatterns.some((p) => url.includes(p))) return true

    return false
  }

  // ─── Job info extraction ───────────────────────────────────────────────────

  function extractJobInfo() {
    const url = window.location.href
    const hostname = window.location.hostname.replace(/^www\./, '')

    const toTitleCase = (slug) =>
      slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    let ldTitle = ''
    let ldCompany = ''
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]')
      for (const s of scripts) {
        const data = JSON.parse(s.textContent)
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
    } catch (_) {}

    let company = ldCompany
    if (!company) {
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
      const domainParts = hostname.split('.')
      const raw = domainParts.length >= 2 ? domainParts[domainParts.length - 2] : hostname
      company = raw.charAt(0).toUpperCase() + raw.slice(1)
    }

    let title = ldTitle
    if (!title) {
      title = findATSTitle(hostname) || findMainH1() || ''
    }
    title = title
      .split(' | ')[0].split(' - ')[0].split(' – ')[0].split(' · ')[0]
      .replace(/^Jobs? at /i, '').trim()

    return { title, company, url }
  }

  function findATSTitle(hostname) {
    const selectors = []
    if (hostname.includes('greenhouse.io')) {
      selectors.push('.app-title', '[class*="posting-title"]', 'h1')
    } else if (hostname.includes('lever.co')) {
      selectors.push('.posting-headline h2', '.posting-title h2', 'h2')
    } else if (hostname.includes('ashbyhq.com')) {
      selectors.push('[class*="JobPosting"] h1', 'h1')
    } else if (hostname.includes('workday.com')) {
      selectors.push('[data-automation-id="jobPostingHeader"]', '[data-automation-id="jobTitle"]')
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
    const semantic = document.querySelector('[data-job-title], .job-title, [itemprop="title"]')
    if (semantic) {
      const t = semantic.textContent.trim()
      if (t.length > 2 && t.length < 200) return t
    }
    const mainH1 = Array.from(document.querySelectorAll('h1')).find((el) => {
      if (el.closest('header, nav, aside, [role="navigation"], [role="banner"]')) return false
      const text = el.textContent.trim()
      return text.length > 4 && text.length < 200
    })
    if (mainH1) return mainH1.textContent.trim()
    const mainEl = document.querySelector('main, [role="main"]')
    if (mainEl) {
      const h = mainEl.querySelector('h1, h2')
      if (h) return h.textContent.trim()
    }
    return document.querySelector('h1')?.textContent.trim() || ''
  }

  // ─── Shadow DOM host ───────────────────────────────────────────────────────
  // Created unconditionally so the dedup guard (id check) always works.
  // Shadow stays empty until init() decides what to render.

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

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  const LEAF_SVG = (size) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="white"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </svg>`

  // ─── Confirmation banner (shown on pages after the user has saved a job) ──

  function renderConfirmation(pending) {
    const title   = esc(pending.title)
    const company = esc(pending.company)
    const label   = company ? `<strong>${title}</strong> at <strong>${company}</strong>` : `<strong>${title}</strong>`

    shadow.innerHTML = `
      <div style="
        background:#fff;border-radius:14px;padding:14px 16px;width:288px;
        box-shadow:0 8px 28px rgba(0,0,0,0.16);border:1px solid #e5e7eb;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:13px;color:#111827;
      ">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="
            width:26px;height:26px;background:#15803d;border-radius:6px;
            display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;
          ">${LEAF_SVG(14)}</div>
          <p style="flex:1;margin:0;line-height:1.5;color:#374151;">
            Done applying to ${label}?
          </p>
          <button id="conf-close" style="
            background:none;border:none;cursor:pointer;color:#9ca3af;
            font-size:20px;line-height:1;padding:0;flex-shrink:0;
          " title="Dismiss">×</button>
        </div>

        <div id="conf-msg" style="display:none;font-size:12px;margin-top:10px;padding:6px 10px;border-radius:7px;"></div>

        <div style="display:flex;gap:8px;margin-top:12px;">
          <button id="conf-yes" style="
            flex:1;padding:9px;background:#15803d;color:#fff;border:none;
            border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;
          ">✓ Yes, I applied</button>
          <button id="conf-no" style="
            padding:9px 14px;background:#f3f4f6;color:#6b7280;border:none;
            border-radius:9px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;
          ">Not yet</button>
        </div>
      </div>
    `

    async function dismiss() {
      await chrome.storage.local.remove(['pending_application'])
      shadow.innerHTML = ''
      if (isJobPage()) render()
    }

    shadow.getElementById('conf-close').onclick = dismiss
    shadow.getElementById('conf-no').onclick    = dismiss

    shadow.getElementById('conf-yes').onclick = async () => {
      const btn = shadow.getElementById('conf-yes')
      btn.disabled = true
      btn.textContent = 'Saving…'
      btn.style.opacity = '0.7'

      let response
      try {
        response = await chrome.runtime.sendMessage({
          type: 'TRACK_APPLICATION',
          data: { title: pending.title, company: pending.company, url: pending.url },
        })
      } catch (_) {
        showConfMsg('Could not reach the extension. Try reloading.', 'error')
        btn.disabled = false; btn.textContent = '✓ Yes, I applied'; btn.style.opacity = '1'
        return
      }

      if (response.success) {
        await chrome.storage.local.remove(['pending_application'])
        showConfMsg('Saved to your Bamboo applications!', 'success')
        setTimeout(() => { shadow.innerHTML = '' }, 2000)
      } else if (response.error === 'NOT_LOGGED_IN') {
        showConfMsg('Log in first — click the 🎋 icon in your toolbar.', 'error')
        btn.disabled = false; btn.textContent = '✓ Yes, I applied'; btn.style.opacity = '1'
      } else {
        showConfMsg(response.error || 'Something went wrong.', 'error')
        btn.disabled = false; btn.textContent = '✓ Yes, I applied'; btn.style.opacity = '1'
      }
    }
  }

  function showConfMsg(text, type) {
    const el = shadow.getElementById('conf-msg')
    el.style.display = 'block'
    el.textContent = text
    el.style.background = type === 'error' ? '#fef2f2' : '#f0fdf4'
    el.style.color      = type === 'error' ? '#dc2626' : '#15803d'
  }

  // ─── Job page button / card ────────────────────────────────────────────────

  function render() {
    if (dismissed) { shadow.innerHTML = ''; return }

    if (!expanded) {
      shadow.innerHTML = `
        <button id="toggle" style="
          display:flex;align-items:center;justify-content:center;
          width:40px;height:40px;border-radius:50%;
          background:#15803d;border:none;cursor:pointer;
          box-shadow:0 2px 10px rgba(0,0,0,0.2);
          transition:transform 0.15s,box-shadow 0.15s;
        " title="Track this job with Bamboo">${LEAF_SVG(20)}</button>
      `
      const btn = shadow.getElementById('toggle')
      btn.onmouseenter = () => Object.assign(btn.style, { transform: 'scale(1.1)', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' })
      btn.onmouseleave = () => Object.assign(btn.style, { transform: 'scale(1)',   boxShadow: '0 2px 10px rgba(0,0,0,0.2)'  })
      btn.onclick = () => { jobInfo = extractJobInfo(); expanded = true; render() }

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
                ${LEAF_SVG(14)}
              </div>
              <span style="font-weight:700;font-size:14px;color:#111827;letter-spacing:-0.01em;">Bamboo</span>
            </div>
            <button id="close" style="
              background:none;border:none;cursor:pointer;color:#9ca3af;font-size:20px;
              line-height:1;padding:0;display:flex;align-items:center;justify-content:center;
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
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Company</label>
            <input id="company-input" value="${esc(jobInfo.company)}" placeholder="e.g. Stripe" style="
              width:100%;box-sizing:border-box;border:1.5px solid #d1d5db;border-radius:8px;
              padding:7px 10px;font-size:13px;color:#111827;outline:none;
              font-family:inherit;transition:border-color 0.15s;
            " />
          </div>

          <!-- Message -->
          <div id="msg" style="display:none;font-size:12px;margin-bottom:10px;padding:7px 10px;border-radius:7px;"></div>

          <!-- Primary: save as pending, go apply -->
          <button id="track-btn" style="
            width:100%;padding:10px;background:#15803d;color:#fff;border:none;
            border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;
            font-family:inherit;letter-spacing:0.01em;transition:background 0.15s;
          ">Save &amp; go apply →</button>

          <!-- Secondary: already applied, save directly -->
          <button id="apply-btn" style="
            width:100%;padding:7px;background:none;color:#6b7280;border:none;
            border-radius:7px;font-size:12px;cursor:pointer;margin-top:4px;
            font-family:inherit;text-decoration:underline;text-underline-offset:2px;
          ">Already applied? Mark now</button>

          <!-- Minimize -->
          <button id="minimize" style="
            width:100%;padding:6px;background:none;color:#9ca3af;border:none;
            border-radius:7px;font-size:12px;cursor:pointer;margin-top:2px;font-family:inherit;
          ">Minimize</button>
        </div>
      `

      const inputs = shadow.querySelectorAll('input')
      inputs.forEach((inp) => {
        inp.onfocus = () => (inp.style.borderColor = '#15803d')
        inp.onblur  = () => (inp.style.borderColor = '#d1d5db')
      })

      shadow.getElementById('close').onclick    = () => { dismissed = true; render() }
      shadow.getElementById('minimize').onclick  = () => { expanded = false; render() }
      shadow.getElementById('track-btn').onclick = handleTrackAndApply
      shadow.getElementById('apply-btn').onclick = handleApply
    }
  }

  // ─── Save as pending — user will confirm after applying ───────────────────

  async function handleTrackAndApply() {
    const btn     = shadow.getElementById('track-btn')
    const title   = shadow.getElementById('title-input').value.trim()
    const company = shadow.getElementById('company-input').value.trim()

    if (!title) { showMsg('Please enter a job title.', 'error'); return }

    btn.disabled = true
    btn.textContent = 'Saved!'
    btn.style.background = '#16a34a'

    await chrome.storage.local.set({
      pending_application: { title, company, url: window.location.href, savedAt: Date.now() },
    })

    showMsg("We'll ask you to confirm once you've finished applying.", 'success')
    setTimeout(() => { expanded = false; render() }, 2200)
  }

  // ─── Save directly (already applied) ─────────────────────────────────────

  async function handleApply() {
    const btn     = shadow.getElementById('apply-btn')
    const title   = shadow.getElementById('title-input').value.trim()
    const company = shadow.getElementById('company-input').value.trim()

    if (!title) { showMsg('Please enter a job title.', 'error'); return }

    btn.disabled = true
    btn.textContent = 'Saving…'

    let response
    try {
      response = await chrome.runtime.sendMessage({
        type: 'TRACK_APPLICATION',
        data: { title, company, url: window.location.href },
      })
    } catch (_) {
      showMsg('Could not reach the extension. Try reloading the page.', 'error')
      btn.disabled = false; btn.textContent = 'Already applied? Mark now'
      return
    }

    if (response.success) {
      // Clear any pending for this job since it's now saved
      chrome.storage.local.remove(['pending_application'])
      shadow.getElementById('track-btn').style.background = '#16a34a'
      shadow.getElementById('track-btn').textContent = '✓ Added to Bamboo!'
      showMsg(`"${title}" saved to your applications.`, 'success')
      setTimeout(() => { expanded = false; dismissed = true; render() }, 2200)
    } else if (response.error === 'NOT_LOGGED_IN') {
      showMsg('Log in first — click the 🎋 extension icon in your toolbar.', 'error')
      btn.disabled = false; btn.textContent = 'Already applied? Mark now'
    } else {
      showMsg(response.error || 'Something went wrong. Please try again.', 'error')
      btn.disabled = false; btn.textContent = 'Already applied? Mark now'
    }
  }

  function showMsg(text, type) {
    const el = shadow.getElementById('msg')
    el.style.display = 'block'
    el.textContent = text
    el.style.background = type === 'error' ? '#fef2f2' : '#f0fdf4'
    el.style.color      = type === 'error' ? '#dc2626' : '#15803d'
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    const { pending_application: pending } = await chrome.storage.local.get(['pending_application'])

    if (pending) {
      // Expire after 7 days
      if (Date.now() - pending.savedAt > 7 * 24 * 60 * 60 * 1000) {
        await chrome.storage.local.remove(['pending_application'])
      } else if (window.location.href !== pending.url) {
        // Navigated away from the job page — show confirmation banner
        renderConfirmation(pending)
        return
      }
    }

    // Show the job button only on job pages
    if (isJobPage()) render()
  }

  init()
})()
