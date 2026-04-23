;(function () {
  // Don't inject twice
  if (document.getElementById('__bamboo_root__')) return

  // ─── Site detection ────────────────────────────────────────────────────────

  function isLinkedIn() {
    return window.location.hostname.includes('linkedin.com')
  }

  function isLinkedInProfile() {
    return /linkedin\.com\/in\/[^/?#]+/.test(window.location.href)
  }

  function isLinkedInMessaging() {
    return window.location.href.includes('linkedin.com/messaging')
  }

  // ─── Career page detection ─────────────────────────────────────────────────

  function isJobPage() {
    const url      = window.location.href.toLowerCase()
    const hostname = window.location.hostname.toLowerCase()

    // Known ATS / job board domains
    const atsDomains = [
      'greenhouse.io', 'ashbyhq.com', 'lever.co', 'workday.com',
      'myworkdayjobs.com', 'smartrecruiters.com', 'jobvite.com',
      'icims.com', 'taleo.net', 'successfactors.com', 'breezy.hr',
      'recruitee.com', 'workable.com', 'bamboohr.com', 'rippling.com',
      'dover.com', 'dover.io', 'pinpointhq.com', 'teamtailor.com',
      'hire.trakstar.com', 'jazz.co', 'applytojob.com',
    ]
    if (atsDomains.some((d) => hostname.includes(d))) return true

    // Subdomains strongly associated with job listings: jobs.*, careers.*, etc.
    const sub = hostname.split('.')[0]
    if (['jobs', 'careers', 'career', 'work', 'hiring', 'apply', 'talent', 'join'].includes(sub)) return true

    // URL path patterns — include both trailing-slash and bare forms
    const careerPatterns = [
      '/career', '/careers', '/job/', '/jobs/', '/jobs',
      '/apply', '/opening', '/openings',
      '/position', '/positions', '/vacancy', '/vacancies',
      '/recruit', '/recruiting', '/hiring',
      '/listing', '/listings', '/role/', '/roles/',
      '/work-with-us', '/join-us', '/join-our-team', '/opportunities',
      '/talent', '/start-here',
    ]
    if (careerPatterns.some((p) => url.includes(p))) return true

    // JSON-LD JobPosting schema — definitive even on fully custom domains
    // (Ashby, Greenhouse, and most modern ATSes always include this)
    try {
      for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        const data    = JSON.parse(script.textContent)
        const entries = Array.isArray(data) ? data : (data['@graph'] || [data])
        if (entries.some((e) => e['@type'] === 'JobPosting')) return true
      }
    } catch (_) {}

    return false
  }

  // ─── Confirmation page detection ───────────────────────────────────────────

  function isConfirmationPage() {
    const url   = window.location.href.toLowerCase()
    const title = document.title.toLowerCase()

    const urlKeywords  = ['thank', 'confirm', 'submitted', 'success', 'complete', 'received', 'congrat']
    if (urlKeywords.some((k) => url.includes(k))) return true

    const textKeywords = [
      'thank you', 'application submitted', 'application received',
      'successfully applied', "you've applied", 'we received your application',
      'your application has been', 'successfully submitted', 'congratulations',
    ]
    if (textKeywords.some((k) => title.includes(k))) return true

    return headings().some((h) => textKeywords.some((k) => h.textContent.toLowerCase().includes(k)))
  }

  function headings() {
    return Array.from(document.querySelectorAll('h1, h2'))
  }

  // ─── LinkedIn info extraction ──────────────────────────────────────────────

  function extractLinkedInProfile() {
    // ── Name via aria-label (most reliable, survives class obfuscation) ───────
    let name = ''
    const nameBtnSelectors = [
      ['button[aria-label^="Message "]',      /^Message\s+/i],
      ['button[aria-label^="Connect with "]', /^Connect with\s+/i],
      ['button[aria-label^="Follow "]',       /^Follow\s+/i],
      ['button[aria-label^="Send InMail to "]', /^Send InMail to\s+/i],
    ]
    for (const [sel, strip] of nameBtnSelectors) {
      const btn = document.querySelector(sel)
      if (btn) {
        name = (btn.getAttribute('aria-label') || '').replace(strip, '').trim()
        if (name) break
      }
    }
    if (!name) {
      const scope = document.querySelector('main') || document.body
      name = (scope.querySelector('h1') || scope.querySelector('h2'))
               ?.textContent?.trim().replace(/\s+/g, ' ') || ''
    }

    const scope = document.querySelector('main') || document.body

    // ── Role: sibling of the name h1/h2 ──────────────────────────────────────
    // LinkedIn puts the headline/title in the element right below the name.
    let role = ''
    if (name) {
      const nameEl = Array.from(document.querySelectorAll('h1, h2')).find(el => {
        const t = (el.textContent || '').trim().replace(/\s+/g, ' ')
        return t.includes(name) && t.length < name.length + 120
      })
      if (nameEl) {
        let next = nameEl.nextElementSibling
        for (let i = 0; i < 6 && next; i++) {
          const t = (next.textContent || '').trim().replace(/\s+/g, ' ')
          if (t && t.length > 3 && t.length < 350 && !t.includes(name)) {
            role = t.split(/\s*[|·]\s*/)[0].trim()
            break
          }
          next = next.nextElementSibling
        }
      }
    }

    // ── Company: scan leaf elements for "X at/@ Company" headline pattern ─────
    // Skip elements whose text contains the person's name — those are container
    // divs that aggregate the whole profile card into one blob of text.
    let company = ''
    const candidates = scope.querySelectorAll('p, span, h3, div')
    for (const el of candidates) {
      if (el.children.length > 1) continue
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ')
      if (t.length < 5 || t.length > 400) continue
      if (name && t.includes(name)) continue   // ← key: skip name-containing blobs
      if (/\bat\s+\w|\s@\s+\w/.test(t)) {
        const m = t.match(/^(.+?)\s+(?:\bat\b|@)\s+(.+?)(?:\s*[|·]|$)/i)
        if (m) {
          company = m[2].trim()
          if (!role) role = m[1].trim()  // use headline role only if sibling gave nothing
          break
        }
      }
    }

    // ── Company fallback: /company/ link NOT in the education section ─────────
    if (!company) {
      const educationHeading = Array.from(scope.querySelectorAll('h2, h3'))
        .find(h => /^education$/i.test((h.textContent || '').trim()))
      const educationSection = educationHeading?.closest('section') || educationHeading?.parentElement
      const companyLinks = Array.from(scope.querySelectorAll('a[href*="/company/"]'))
        .filter(a => !educationSection?.contains(a))
      if (companyLinks.length > 0) {
        company = companyLinks[0].textContent?.trim().replace(/\s+/g, ' ') || ''
      }
    }

    // ── URL ───────────────────────────────────────────────────────────────────
    const profileMatch = window.location.href.match(/(https?:\/\/(?:www\.)?linkedin\.com\/in\/[^/?#]+)/)
    const linkedin_url = profileMatch ? profileMatch[1] : window.location.href

    return { name, role, company, linkedin_url }
  }

  // Extracts the recipient from LinkedIn's "New message" compose overlay,
  // which appears on any LinkedIn page (not only /messaging/).
  function extractFromComposePopup() {
    const pill = document.querySelector('.msg-form__recipient-pill')
    if (!pill) return null

    // The remove (×) button reliably carries aria-label="Remove [Name]"
    const removeBtn = pill.querySelector('button[aria-label^="Remove"]')
    let name = removeBtn
      ? removeBtn.getAttribute('aria-label').replace(/^Remove\s+/i, '').trim()
      : (pill.textContent || '').replace(/\s*×\s*$/, '').trim()

    if (!name) return null

    // Profile link is sometimes embedded in the pill
    const rawHref    = pill.querySelector('a[href*="/in/"]')?.getAttribute('href') || ''
    const profileMatch = rawHref.match(/(\/in\/[^/?#]+)/)
    const linkedin_url = profileMatch ? `https://www.linkedin.com${profileMatch[1]}` : ''

    return { name, role: '', company: '', linkedin_url }
  }

  function extractLinkedInConversationContact() {
    // Name shown in the conversation header or thread list item
    const nameEl =
      document.querySelector('.msg-entity-lockup__entity-title') ||
      document.querySelector('.msg-conversation-listitem__participant-names') ||
      document.querySelector('[data-control-name="overlay.open_profile"] .truncate') ||
      headings().find((h) => h.tagName === 'H2')
    const name = nameEl?.textContent?.trim() || ''

    // Subtitle / role shown under the name in the conversation header
    const subtitleEl =
      document.querySelector('.msg-entity-lockup__entity-lockup-title') ||
      document.querySelector('.msg-s-event-listitem__sender-info .truncate + span')
    const headline = subtitleEl?.textContent?.trim() || ''

    const atMatch  = headline.match(/^(.+?)\s+(?:at|@)\s+(.+?)(?:\s*·|$)/i)
    const role     = atMatch ? atMatch[1].trim() : headline
    const company  = atMatch ? atMatch[2].trim() : ''

    // "View profile" link inside the conversation
    const profileLink = document.querySelector(
      'a[href*="/in/"][data-control-name], a.msg-thread__link-to-profile, a[href*="/in/"]'
    )
    const rawHref    = profileLink?.getAttribute('href') || ''
    const profileMatch = rawHref.match(/(\/in\/[^/?#]+)/)
    const linkedin_url = profileMatch
      ? `https://www.linkedin.com${profileMatch[1]}`
      : ''

    return { name, role, company, linkedin_url }
  }

  // ─── Job info extraction (LLM-driven) ──────────────────────────────────────

  const EXTRACT_TTL_MS = 30 * 60 * 1000

  // JSON-LD fast path — covers Greenhouse, Ashby, Lever and most modern ATSes.
  function extractFromJsonLd() {
    try {
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        const data    = JSON.parse(s.textContent)
        const entries = Array.isArray(data) ? data : (data['@graph'] || [data])
        for (const e of entries) {
          if (e['@type'] === 'JobPosting') {
            return {
              is_job_page: true,
              title:   (e.title || e.name || '').trim(),
              company: (e.hiringOrganization?.name || '').trim(),
            }
          }
        }
      }
    } catch (_) {}
    return null
  }

  // Aggressively strip the DOM down to signal-bearing text (<~6KB / ~1500 tokens).
  function filterPageForLLM() {
    const parts = []

    if (document.title) parts.push(`Title: ${document.title.trim()}`)
    const meta = (sel) => document.querySelector(sel)?.getAttribute('content')?.trim() || ''
    const ogT  = meta('meta[property="og:title"]')       || meta('meta[name="twitter:title"]')
    const ogS  = meta('meta[property="og:site_name"]')
    const ogD  = meta('meta[property="og:description"]') || meta('meta[name="description"]')
    if (ogT) parts.push(`OG title: ${ogT}`)
    if (ogS) parts.push(`OG site: ${ogS}`)
    if (ogD) parts.push(`OG desc: ${ogD.slice(0, 300)}`)

    const root  = document.querySelector('main, [role="main"], article') || document.body
    const clone = root.cloneNode(true)
    clone.querySelectorAll(
      'script, style, noscript, nav, header, footer, aside, svg, iframe, ' +
      '[role="navigation"], [role="banner"], [role="contentinfo"]'
    ).forEach((el) => el.remove())

    const headings = Array.from(clone.querySelectorAll('h1, h2, h3'))
      .slice(0, 12)
      .map((h) => (h.textContent || '').trim().replace(/\s+/g, ' '))
      .filter((t) => t && t.length < 200)
    if (headings.length) parts.push(`Headings: ${headings.join(' | ')}`)

    const body = (clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1500)
    if (body) parts.push(`Body: ${body}`)

    return parts.join('\n').slice(0, 6000)
  }

  // Per-URL cache — avoid re-extracting when the user navigates back.
  async function getUrlCache(url) {
    if (!chrome?.storage?.local) return null
    const { extract_cache = {} } = await chrome.storage.local.get(['extract_cache'])
    const entry = extract_cache[url]
    if (!entry) return null
    if (Date.now() - entry.cachedAt > EXTRACT_TTL_MS) return null
    return entry.result
  }

  async function setUrlCache(url, result) {
    if (!chrome?.storage?.local) return
    const { extract_cache = {} } = await chrome.storage.local.get(['extract_cache'])
    extract_cache[url] = { result, cachedAt: Date.now() }
    const keys = Object.keys(extract_cache)
    if (keys.length > 50) {
      const stale = keys
        .sort((a, b) => extract_cache[a].cachedAt - extract_cache[b].cachedAt)
        .slice(0, keys.length - 50)
      for (const k of stale) delete extract_cache[k]
    }
    await chrome.storage.local.set({ extract_cache })
  }

  // "Active job" — sticks across the multi-page application flow on the same origin.
  async function getActiveJob() {
    if (!chrome?.storage?.local) return null
    const { active_job } = await chrome.storage.local.get(['active_job'])
    if (!active_job) return null
    if (Date.now() - active_job.extractedAt > EXTRACT_TTL_MS) return null
    if (active_job.origin !== window.location.origin) return null
    return active_job
  }

  async function setActiveJob({ title, company }) {
    if (!chrome?.storage?.local) return
    await chrome.storage.local.set({
      active_job: {
        title, company,
        url:         window.location.href,
        origin:      window.location.origin,
        extractedAt: Date.now(),
      },
    })
  }

  async function clearActiveJob() {
    if (!chrome?.storage?.local) return
    await chrome.storage.local.remove(['active_job'])
  }

  // ─── Auto-save pending contact (LinkedIn profile pages) ──────────────────
  // Stores the extracted profile info so it's available when the user later
  // sends a message from the compose overlay (which has no role/company data).

  async function autoSavePendingContact(info) {
    if (!info.name || !chrome?.storage?.local) return
    const { pending_contact: existing } = await chrome.storage.local.get(['pending_contact'])
    const norm = (s) => (s || '').toLowerCase().trim()
    const same = existing &&
      norm(existing.name)        === norm(info.name) &&
      norm(existing.linkedin_url) === norm(info.linkedin_url)
    if (!same) {
      await chrome.storage.local.set({ pending_contact: { ...info, savedAt: Date.now() } })
    }
  }

  // ─── Shadow DOM host ───────────────────────────────────────────────────────

  const host = document.createElement('div')
  host.id = '__bamboo_root__'
  Object.assign(host.style, { position: 'fixed', top: '20px', right: '20px', zIndex: '2147483647' })
  document.body.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })

  // ─── State ────────────────────────────────────────────────────────────────

  let expanded          = false
  let dismissed         = false
  let mode              = 'job'       // 'job' | 'linkedin'
  let jobInfo           = {}
  let contactInfo       = {}
  let extractionPending = false        // true while the LLM call is in-flight
  let extractionError   = ''           // human-readable error from the last extraction attempt

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

  const CARD_STYLE = `
    background:#fff;border-radius:14px;padding:18px;width:288px;
    box-shadow:0 8px 28px rgba(0,0,0,0.16);border:1px solid #e5e7eb;
    font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:13px;color:#111827;`

  const INPUT_STYLE = `
    width:100%;box-sizing:border-box;border:1.5px solid #d1d5db;border-radius:8px;
    padding:7px 10px;font-size:13px;color:#111827;outline:none;
    font-family:inherit;transition:border-color 0.15s;`

  const LABEL_STYLE = `
    display:block;font-size:11px;font-weight:600;color:#6b7280;
    margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;`

  function cardHeader(subtitle) {
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:26px;height:26px;background:#15803d;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${LEAF_SVG(14)}
          </div>
          <div>
            <span style="font-weight:700;font-size:14px;color:#111827;letter-spacing:-0.01em;">Bamboo</span>
            ${subtitle ? `<span style="font-size:11px;color:#9ca3af;margin-left:6px;">${subtitle}</span>` : ''}
          </div>
        </div>
        <button id="close" style="
          background:none;border:none;cursor:pointer;color:#9ca3af;font-size:20px;
          line-height:1;padding:0;display:flex;align-items:center;justify-content:center;
          width:24px;height:24px;border-radius:4px;" title="Dismiss">×</button>
      </div>`
  }

  function fieldHtml(id, labelText, value, placeholder, readonly) {
    return `
      <div style="margin-bottom:10px;">
        <label style="${LABEL_STYLE}">${labelText}</label>
        <input id="${id}" value="${esc(value)}" placeholder="${placeholder}"
          ${readonly ? 'readonly style="' + INPUT_STYLE + 'background:#f9fafb;color:#6b7280;"'
                     : 'style="' + INPUT_STYLE + '"'} />
      </div>`
  }

  function msgHtml() {
    return `<div id="msg" style="display:none;font-size:12px;margin-bottom:10px;padding:7px 10px;border-radius:7px;"></div>`
  }

  function showMsg(text, type) {
    const el = shadow.getElementById('msg')
    if (!el) return
    el.style.display    = 'block'
    el.textContent      = text
    el.style.background = type === 'error' ? '#fef2f2' : '#f0fdf4'
    el.style.color      = type === 'error' ? '#dc2626' : '#15803d'
  }

  function attachFocusStyles() {
    shadow.querySelectorAll('input:not([readonly])').forEach((inp) => {
      inp.onfocus = () => (inp.style.borderColor = '#15803d')
      inp.onblur  = () => (inp.style.borderColor = '#d1d5db')
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

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
        " title="Bamboo">${LEAF_SVG(20)}</button>
      `
      const btn = shadow.getElementById('toggle')
      btn.onmouseenter = () => Object.assign(btn.style, { transform: 'scale(1.1)', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' })
      btn.onmouseleave = () => Object.assign(btn.style, { transform: 'scale(1)',   boxShadow: '0 2px 10px rgba(0,0,0,0.2)'  })
      btn.onclick = async () => {
        try {
          if (mode === 'linkedin') {
            // Pull stored profile info (has role+company from profile page visit)
            const stored = await chrome.storage.local.get(['pending_contact'])
              .then(r => r.pending_contact).catch(() => null)
            // Also try to get live name/URL from compose overlay or conversation
            let live = null
            try {
              live =
                extractFromComposePopup() ||
                (isLinkedInMessaging() ? extractLinkedInConversationContact() : null) ||
                (isLinkedInProfile()   ? extractLinkedInProfile()             : null)
            } catch (_) {}

            if (stored || live) {
              contactInfo = {
                name:        live?.name        || stored?.name        || '',
                linkedin_url: live?.linkedin_url || stored?.linkedin_url || '',
                role:        stored?.role      || live?.role          || '',
                company:     stored?.company   || live?.company       || '',
              }
            } else {
              contactInfo = {}
            }
          }
          // Job mode: jobInfo is already populated (or being populated) by startExtraction()
          expanded = true
          render()
        } catch (e) { console.error('[Bamboo] toggle error', e) }
      }
      return
    }

    // Expanded card — branch on mode
    if (mode === 'linkedin') {
      renderContactCard()
    } else {
      renderJobCard()
    }
  }

  // ─── Job card ─────────────────────────────────────────────────────────────

  // Shimmer keyframes + skeleton bar for the loading state.
  const SHIMMER_CSS = `
    @keyframes bamboo-shimmer {
      0%   { background-position: -200px 0; }
      100% { background-position: 200px 0; }
    }
    .bamboo-skel {
      height: 32px; border-radius: 8px;
      background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%);
      background-size: 400px 100%;
      animation: bamboo-shimmer 1.2s ease-in-out infinite;
    }
    .bamboo-skel-sm { height: 11px; width: 60%; margin-bottom: 6px; }`

  function skeletonField(labelText) {
    return `
      <div style="margin-bottom:10px;">
        <label style="${LABEL_STYLE}">${labelText}</label>
        <div class="bamboo-skel"></div>
      </div>`
  }

  function renderJobCard() {
    const loading = extractionPending && !jobInfo.title && !jobInfo.company
    const fields  = loading
      ? skeletonField('Job Title') + skeletonField('Company')
      : fieldHtml('title-input',   'Job Title', jobInfo.title,   'e.g. Software Engineer', false) +
        fieldHtml('company-input', 'Company',   jobInfo.company, 'e.g. Stripe',            false)

    const applyLabel    = loading ? 'Detecting…' : '✓ Mark as Applied'
    const applyDisabled = loading ? 'disabled' : ''
    const applyOpacity  = loading ? '0.6' : '1'

    const errBanner = extractionError && !loading
      ? `<div style="
          display:flex;align-items:flex-start;gap:6px;
          font-size:11px;color:#92400e;background:#fffbeb;
          border:1px solid #fde68a;border-radius:7px;
          padding:6px 8px;margin-bottom:10px;line-height:1.4;">
          <span style="flex-shrink:0;">⚠</span>
          <span>${esc(extractionError)}</span>
        </div>`
      : ''

    shadow.innerHTML = `
      <style>${SHIMMER_CSS}</style>
      <div id="card" style="${CARD_STYLE}">
        ${cardHeader(loading ? 'Detecting…' : '')}
        ${fields}
        ${errBanner}
        ${msgHtml()}
        <button id="apply-btn" ${applyDisabled} style="
          width:100%;padding:10px;background:#15803d;color:#fff;border:none;
          border-radius:9px;font-size:13px;font-weight:600;
          cursor:${loading ? 'not-allowed' : 'pointer'};opacity:${applyOpacity};
          font-family:inherit;letter-spacing:0.01em;transition:background 0.15s;
        ">${applyLabel}</button>
        <button id="minimize" style="
          width:100%;padding:6px;background:none;color:#9ca3af;border:none;
          border-radius:7px;font-size:12px;cursor:pointer;margin-top:6px;font-family:inherit;
        ">Minimize</button>
      </div>`

    if (!loading) attachFocusStyles()
    shadow.getElementById('close').onclick   = () => { dismissed = true; render() }
    shadow.getElementById('minimize').onclick = () => { expanded = false; render() }
    if (!loading) shadow.getElementById('apply-btn').onclick = handleApply
  }

  async function handleApply() {
    const btn     = shadow.getElementById('apply-btn')
    const title   = shadow.getElementById('title-input').value.trim()
    const company = shadow.getElementById('company-input').value.trim()

    if (!title) { showMsg('Please enter a job title.', 'error'); return }

    btn.disabled = true; btn.textContent = 'Saving…'; btn.style.opacity = '0.7'

    let response
    try {
      response = await chrome.runtime.sendMessage({
        type: 'TRACK_APPLICATION',
        data: { title, company, url: window.location.href },
      })
    } catch (_) {
      showMsg('Could not reach the extension. Try reloading.', 'error')
      btn.disabled = false; btn.textContent = '✓ Mark as Applied'; btn.style.opacity = '1'; return
    }

    if (response.success) {
      await clearActiveJob()
      btn.style.background = '#16a34a'; btn.style.opacity = '1'; btn.textContent = '✓ Added to Bamboo!'
      showMsg(`"${title}" saved to your applications.`, 'success')
      setTimeout(() => { expanded = false; dismissed = true; render() }, 2200)
    } else if (response.error === 'NOT_LOGGED_IN') {
      showMsg('Log in first — click the 🎋 icon in your toolbar.', 'error')
      btn.disabled = false; btn.textContent = '✓ Mark as Applied'; btn.style.opacity = '1'
    } else {
      showMsg(response.error || 'Something went wrong.', 'error')
      btn.disabled = false; btn.textContent = '✓ Mark as Applied'; btn.style.opacity = '1'
    }
  }

  // ─── Confirmation banner (job sites) ──────────────────────────────────────

  function renderConfirmation(pending) {
    const title   = esc(pending.title)
    const company = esc(pending.company)
    const label   = company
      ? `<strong>${title}</strong> at <strong>${company}</strong>`
      : `<strong>${title}</strong>`

    shadow.innerHTML = `
      <div style="${CARD_STYLE}padding:14px 16px;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="width:26px;height:26px;background:#15803d;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">${LEAF_SVG(14)}</div>
          <p style="flex:1;margin:0;line-height:1.5;color:#374151;">
            Did you just apply to ${label}?
          </p>
          <button id="conf-close" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:20px;line-height:1;padding:0;flex-shrink:0;" title="Dismiss">×</button>
        </div>
        <div id="msg" style="display:none;font-size:12px;margin-top:10px;padding:6px 10px;border-radius:7px;"></div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button id="conf-yes" style="flex:1;padding:9px;background:#15803d;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">✓ Yes, I applied</button>
          <button id="conf-no"  style="padding:9px 14px;background:#f3f4f6;color:#6b7280;border:none;border-radius:9px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;">Not me</button>
        </div>
      </div>`

    async function dismiss() {
      await clearActiveJob()
      render()
    }
    shadow.getElementById('conf-close').onclick = dismiss
    shadow.getElementById('conf-no').onclick    = dismiss

    shadow.getElementById('conf-yes').onclick = async () => {
      const btn = shadow.getElementById('conf-yes')
      btn.disabled = true; btn.textContent = 'Saving…'; btn.style.opacity = '0.7'
      let response
      try {
        response = await chrome.runtime.sendMessage({
          type: 'TRACK_APPLICATION',
          data: { title: pending.title, company: pending.company, url: pending.url },
        })
      } catch (_) {
        showMsg('Could not reach the extension. Try reloading.', 'error')
        btn.disabled = false; btn.textContent = '✓ Yes, I applied'; btn.style.opacity = '1'; return
      }
      if (response.success) {
        await clearActiveJob()
        showMsg('Saved to your Bamboo applications!', 'success')
        setTimeout(() => render(), 2000)
      } else if (response.error === 'NOT_LOGGED_IN') {
        showMsg('Log in first — click the 🎋 icon in your toolbar.', 'error')
        btn.disabled = false; btn.textContent = '✓ Yes, I applied'; btn.style.opacity = '1'
      } else {
        showMsg(response.error || 'Something went wrong.', 'error')
        btn.disabled = false; btn.textContent = '✓ Yes, I applied'; btn.style.opacity = '1'
      }
    }
  }

  // ─── Contact card (LinkedIn) ───────────────────────────────────────────────

  function renderContactCard(info) {
    if (info) contactInfo = info   // allow overriding state before render
    shadow.innerHTML = `
      <div id="card" style="${CARD_STYLE}">
        ${cardHeader('Networking')}
        ${fieldHtml('name-input',    'Name',        contactInfo.name,        'e.g. Jane Smith',    false)}
        ${fieldHtml('role-input',    'Role / Title', contactInfo.role,        'e.g. Senior Engineer', false)}
        ${fieldHtml('company-input', 'Company',     contactInfo.company,     'e.g. Google',        false)}
        ${fieldHtml('li-url-input',  'LinkedIn URL', contactInfo.linkedin_url, 'linkedin.com/in/…', true)}
        ${msgHtml()}
        <button id="save-contact-btn" style="
          width:100%;padding:10px;background:#15803d;color:#fff;border:none;
          border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;
          font-family:inherit;letter-spacing:0.01em;transition:background 0.15s;
        ">+ Add to Networking</button>
        <button id="minimize" style="
          width:100%;padding:6px;background:none;color:#9ca3af;border:none;
          border-radius:7px;font-size:12px;cursor:pointer;margin-top:6px;font-family:inherit;
        ">Minimize</button>
      </div>`

    attachFocusStyles()
    shadow.getElementById('close').onclick    = () => { dismissed = true; render() }
    shadow.getElementById('minimize').onclick  = () => { expanded = false; render() }
    shadow.getElementById('save-contact-btn').onclick = handleSaveContact
  }

  async function handleSaveContact() {
    const btn         = shadow.getElementById('save-contact-btn')
    const name        = shadow.getElementById('name-input').value.trim()
    const role        = shadow.getElementById('role-input').value.trim()
    const company     = shadow.getElementById('company-input').value.trim()
    const linkedin_url = shadow.getElementById('li-url-input').value.trim()

    if (!name) { showMsg('Please enter a name.', 'error'); return }

    btn.disabled = true; btn.textContent = 'Saving…'; btn.style.opacity = '0.7'

    let response
    try {
      response = await chrome.runtime.sendMessage({
        type: 'SAVE_CONTACT',
        data: { name, role, company, linkedin_url },
      })
    } catch (_) {
      showMsg('Could not reach the extension. Try reloading.', 'error')
      btn.disabled = false; btn.textContent = '+ Add to Networking'; btn.style.opacity = '1'; return
    }

    if (response.success) {
      await chrome.storage.local.remove(['pending_contact'])
      btn.style.background = '#16a34a'; btn.style.opacity = '1'; btn.textContent = '✓ Added!'
      showMsg(`${name} saved to your Bamboo networking.`, 'success')
      setTimeout(() => { expanded = false; dismissed = true; render() }, 2200)
    } else if (response.error === 'NOT_LOGGED_IN') {
      showMsg('Log in first — click the 🎋 icon in your toolbar.', 'error')
      btn.disabled = false; btn.textContent = '+ Add to Networking'; btn.style.opacity = '1'
    } else {
      showMsg(response.error || 'Something went wrong.', 'error')
      btn.disabled = false; btn.textContent = '+ Add to Networking'; btn.style.opacity = '1'
    }
  }

  // ─── Prompt banner after sending a message on LinkedIn ────────────────────

  function renderContactPrompt(info) {
    const name    = esc(info.name)
    const company = esc(info.company)
    const label   = company
      ? `<strong>${name}</strong> at <strong>${company}</strong>`
      : `<strong>${name}</strong>`

    shadow.innerHTML = `
      <div style="${CARD_STYLE}padding:14px 16px;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="width:26px;height:26px;background:#15803d;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">${LEAF_SVG(14)}</div>
          <p style="flex:1;margin:0;line-height:1.5;color:#374151;">
            Add ${label} to your Bamboo networking?
          </p>
          <button id="prompt-close" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:20px;line-height:1;padding:0;flex-shrink:0;" title="Dismiss">×</button>
        </div>
        <div id="msg" style="display:none;font-size:12px;margin-top:10px;padding:6px 10px;border-radius:7px;"></div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button id="prompt-yes" style="flex:1;padding:9px;background:#15803d;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">+ Yes, add contact</button>
          <button id="prompt-edit" style="padding:9px 14px;background:#f3f4f6;color:#6b7280;border:none;border-radius:9px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;">Edit first</button>
        </div>
      </div>`

    shadow.getElementById('prompt-close').onclick = () => render()

    shadow.getElementById('prompt-edit').onclick = () => {
      contactInfo = info
      expanded = true
      renderContactCard()
    }

    shadow.getElementById('prompt-yes').onclick = async () => {
      const btn = shadow.getElementById('prompt-yes')
      btn.disabled = true; btn.textContent = 'Saving…'; btn.style.opacity = '0.7'
      let response
      try {
        response = await chrome.runtime.sendMessage({
          type: 'SAVE_CONTACT',
          data: { name: info.name, role: info.role, company: info.company, linkedin_url: info.linkedin_url },
        })
      } catch (_) {
        showMsg('Could not reach the extension. Try reloading.', 'error')
        btn.disabled = false; btn.textContent = '+ Yes, add contact'; btn.style.opacity = '1'; return
      }
      if (response.success) {
        showMsg(`${info.name} saved to your Bamboo networking!`, 'success')
        setTimeout(() => render(), 2000)
      } else if (response.error === 'NOT_LOGGED_IN') {
        showMsg('Log in first — click the 🎋 icon in your toolbar.', 'error')
        btn.disabled = false; btn.textContent = '+ Yes, add contact'; btn.style.opacity = '1'
      } else {
        showMsg(response.error || 'Something went wrong.', 'error')
        btn.disabled = false; btn.textContent = '+ Yes, add contact'; btn.style.opacity = '1'
      }
    }
  }

  // ─── LinkedIn: watch for message send ────────────────────────────────────
  // Attaches a click listener to the Send button whenever it appears/re-renders.
  // Uses a MutationObserver so it keeps working as the user switches threads.

  // Watches for any Send button on LinkedIn — works for both the full messaging
  // thread (/messaging/) and the compose overlay that appears on any LinkedIn page.
  function watchLinkedInSendButton() {
    let lastContactKey = ''

    function attachSendListener() {
      const sendBtn = document.querySelector(
        'button.msg-form__send-button, button[aria-label*="Send"], button[data-control-name="send"]'
      )
      if (!sendBtn || sendBtn._bambooWatched) return
      sendBtn._bambooWatched = true

      sendBtn.addEventListener('click', () => {
        // Pull the stored profile info (has role+company from profile page visit),
        // merge with live compose/conversation extraction for the name/URL.
        if (!chrome?.storage?.local) return
        chrome.storage.local.get(['pending_contact'], ({ pending_contact: stored }) => {
          const live =
            extractFromComposePopup() ||
            extractLinkedInConversationContact()

          // Prefer stored role/company; use live name/URL if available and fresher
          const info = {
            name:        live?.name        || stored?.name        || '',
            linkedin_url: live?.linkedin_url || stored?.linkedin_url || '',
            role:        stored?.role      || live?.role          || '',
            company:     stored?.company   || live?.company       || '',
          }

          if (!info.name) return
          const key = info.name + info.linkedin_url
          if (key === lastContactKey) return  // same thread, don't prompt twice
          lastContactKey = key
          setTimeout(() => renderContactPrompt(info), 600)
        })
      })
    }

    attachSendListener()
    const observer = new MutationObserver(attachSendListener)
    observer.observe(document.body, { childList: true, subtree: true })
  }

  // ─── Extraction driver ────────────────────────────────────────────────────

  // Runs as early as possible so the result is ready by the time the user
  // clicks the floating button. Resolves the card state in priority order:
  //   1. per-URL cache hit (instant)
  //   2. JSON-LD JobPosting (instant, skips the LLM)
  //   3. fresh same-origin active_job (continuation page — skip LLM)
  //   4. LLM extraction
  async function startExtraction() {
    const url = window.location.href

    // 1. per-URL cache hit
    const cached = await getUrlCache(url)
    if (cached) {
      if (cached.is_job_page) {
        jobInfo = { title: cached.title, company: cached.company, url }
      }
      return
    }

    const activeJob = await getActiveJob()

    // 2. JSON-LD fast path
    const ld = extractFromJsonLd()
    if (ld?.is_job_page) {
      jobInfo = { title: ld.title, company: ld.company, url }
      await setUrlCache(url, ld)
      await setActiveJob(ld)
      return
    }

    // 3. Continuation page — reuse active_job and skip the LLM.
    //    Covers both "no job-page signal at all" (pure confirm pages) and
    //    "looks like /apply/* on the same origin" (multi-step application flow).
    const looksLikeContinuation = /\/(apply|application|submit|confirm|thank[-_]?you|success|complete|step)\b/i
      .test(window.location.pathname)
    if (activeJob && (!isJobPage() || looksLikeContinuation)) {
      jobInfo = { title: activeJob.title, company: activeJob.company, url }
      return
    }

    // Plain non-job page with no active flow — nothing to show
    if (!isJobPage()) return

    // 4. LLM path — pre-fill with active_job (if any) so the card isn't blank
    //    while shimmering; shimmer only kicks in when we have nothing to show.
    extractionPending = true
    extractionError   = ''
    if (activeJob) jobInfo = { title: activeJob.title, company: activeJob.company, url }
    if (expanded) render()

    const text = filterPageForLLM()
    let result
    try {
      result = await chrome.runtime.sendMessage({ type: 'EXTRACT_JOB', data: { text, url } })
    } catch (e) {
      result = { error: 'EXTENSION_UNAVAILABLE', detail: String(e?.message || e) }
    }

    extractionPending = false

    if (result?.is_job_page) {
      jobInfo = { title: result.title, company: result.company, url }
      await setUrlCache(url, result)
      await setActiveJob(result)
    } else if (result?.error) {
      // Auth / network error — don't cache, don't hide; leave fields empty
      // so the user can still fill them in manually and retry on next visit.
      extractionError = errorLabel(result.error, result.detail)
      if (!jobInfo.title) jobInfo = { title: '', company: '', url }
    } else if (activeJob) {
      // LLM says "not a job page" but we're mid-flow — stick with active_job
      jobInfo = { title: activeJob.title, company: activeJob.company, url }
    } else {
      // Not a job page and nothing in flight — hide the button
      dismissed = true
      await setUrlCache(url, { is_job_page: false, title: '', company: '' })
    }

    render()
  }

  function errorLabel(code, detail) {
    const suffix = detail ? ` — ${String(detail).slice(0, 120)}` : ''
    switch (code) {
      case 'NOT_LOGGED_IN':         return 'Sign in to auto-detect'
      case 'REQUEST_FAILED':        return `Server error${suffix}`
      case 'NETWORK_ERROR':         return `Network error${suffix}`
      case 'EXTENSION_UNAVAILABLE': return `Extension error${suffix}`
      case 'OPENAI_ERROR':          return `OpenAI error${suffix}`
      case 'EXTRACTION_FAILED':     return `Extraction failed${suffix}`
      default: return `Auto-detect failed${code ? ` (${code})` : ''}${suffix}`
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    if (isLinkedIn()) {
      mode = 'linkedin'
      // Watch for the Send button everywhere on LinkedIn —
      // the compose overlay can appear on any page (home, search, profile, etc.)
      watchLinkedInSendButton()

      if (isLinkedInProfile()) {
        contactInfo = extractLinkedInProfile()
        await autoSavePendingContact(contactInfo)
      }

      render()
      return
    }

    // ── Confirmation page: "Did you just apply to X?" banner ──────────────
    if (isConfirmationPage()) {
      const activeJob = await getActiveJob()
      if (activeJob) {
        renderConfirmation({ title: activeJob.title, company: activeJob.company, url: activeJob.url })
        return
      }
    }

    // ── Job tracking flow ──────────────────────────────────────────────────
    const activeJob = await getActiveJob()
    if (!isJobPage() && !activeJob) return   // plain non-job page — show nothing

    render()                  // show minimized button immediately
    startExtraction()         // resolve jobInfo in parallel (may re-render)
  }

  init()
})()
