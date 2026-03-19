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

    // Title extraction — h1 is almost always the job title on detail pages.
    // og:title is often a generic marketing phrase (e.g. "Build your Career at Tesla").
    // Exception: LinkedIn encodes job+company in og:title, so we prefer it there.
    const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || ''
    // Try ATS-specific / semantic selectors before generic h1
    const jobTitleEl =
      document.querySelector('[data-job-title], .job-title, [itemprop="title"]') ||
      document.querySelector('h1')
    const h1 = jobTitleEl?.textContent?.trim() || ''

    let title
    if (hostname.includes('linkedin.com')) {
      title = og || h1 || document.title || ''
      // LinkedIn: "Software Engineer at Stripe | LinkedIn" → title="Software Engineer", company="Stripe"
      if (title.includes(' at ')) {
        const parts = title.split(' at ')
        title = parts[0].trim()
        const rest = parts.slice(1).join(' at ')
        company = rest.split(' | ')[0].split(' - ')[0].trim() || company
      }
    } else {
      // For all other job sites: h1 wins when present and non-trivial
      title = (h1.length > 4 ? h1 : og) || og || h1 || document.title || ''
    }

    // Strip common suffixes
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
