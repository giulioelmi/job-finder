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

  // ─── Job info extraction ───────────────────────────────────────────────────

  function extractJobInfo() {
    const url      = window.location.href
    const hostname = window.location.hostname.replace(/^www\./, '')

    const toTitleCase = (slug) =>
      slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    let ldTitle = '', ldCompany = ''
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]')
      for (const s of scripts) {
        const data    = JSON.parse(s.textContent)
        const entries = Array.isArray(data) ? data : (data['@graph'] || [data])
        for (const entry of entries) {
          if (entry['@type'] === 'JobPosting') {
            ldTitle   = entry.title || entry.name || ''
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
        const m = url.match(/greenhouse\.io\/([^/?#]+)/); if (m) company = toTitleCase(m[1])
      } else if (hostname.includes('ashbyhq.com')) {
        const m = url.match(/ashbyhq\.com\/([^/?#]+)/);  if (m) company = toTitleCase(m[1])
      } else if (hostname.includes('lever.co')) {
        const m = url.match(/lever\.co\/([^/?#]+)/);     if (m) company = toTitleCase(m[1])
      } else if (hostname.includes('workday.com')) {
        const m = hostname.match(/([^.]+)\.myworkdayjobs/); if (m) company = toTitleCase(m[1])
      } else if (hostname.includes('smartrecruiters.com')) {
        const m = url.match(/smartrecruiters\.com\/([^/?#]+)/); if (m) company = toTitleCase(m[1])
      } else if (hostname.includes('jobvite.com')) {
        const m = hostname.match(/([^.]+)\.jobvite\.com/); if (m) company = toTitleCase(m[1])
      }
    }
    if (!company) {
      const parts = hostname.split('.')
      const raw   = parts.length >= 2 ? parts[parts.length - 2] : hostname
      company     = raw.charAt(0).toUpperCase() + raw.slice(1)
    }

    let title = ldTitle
    if (!title) title = findATSTitle(hostname) || findMainH1() || ''
    title = title
      .split(' | ')[0].split(' - ')[0].split(' – ')[0].split(' · ')[0]
      .replace(/^Jobs? at /i, '').trim()

    return { title, company, url }
  }

  function findATSTitle(hostname) {
    const selectors = []
    if (hostname.includes('greenhouse.io'))        selectors.push('.app-title', '[class*="posting-title"]', 'h1')
    else if (hostname.includes('lever.co'))         selectors.push('.posting-headline h2', '.posting-title h2', 'h2')
    else if (hostname.includes('ashbyhq.com'))      selectors.push('[class*="JobPosting"] h1', 'h1')
    else if (hostname.includes('workday.com'))      selectors.push('[data-automation-id="jobPostingHeader"]', '[data-automation-id="jobTitle"]')
    else if (hostname.includes('smartrecruiters'))  selectors.push('.job-title h1', '[class*="jobTitle"]')
    else if (hostname.includes('bamboohr.com'))     selectors.push('#BambooHR-ATS h2', '.BambooHR-ATS-Jobs-Item h2')
    else if (hostname.includes('rippling.com'))     selectors.push('[class*="job"] h1', '[class*="position"] h1')
    else if (hostname.includes('workable.com'))     selectors.push('[class*="posting-header"] h1', 'h1')
    else if (hostname.includes('recruitee.com'))    selectors.push('[class*="job-header"] h1', '.offer-title', 'h1')
    else if (hostname.includes('breezy.hr'))        selectors.push('.position-title h1', 'h1')

    for (const sel of selectors) {
      const el   = document.querySelector(sel)
      const text = el?.textContent.trim()
      if (text && text.length > 2 && text.length < 200) return text
    }
    return ''
  }

  function findMainH1() {
    const semantic = document.querySelector('[data-job-title], .job-title, [itemprop="title"]')
    if (semantic) { const t = semantic.textContent.trim(); if (t.length > 2 && t.length < 200) return t }

    const mainH1 = Array.from(document.querySelectorAll('h1')).find((el) => {
      if (el.closest('header, nav, aside, [role="navigation"], [role="banner"]')) return false
      const text = el.textContent.trim()
      return text.length > 4 && text.length < 200
    })
    if (mainH1) return mainH1.textContent.trim()

    const mainEl = document.querySelector('main, [role="main"]')
    if (mainEl) { const h = mainEl.querySelector('h1, h2'); if (h) return h.textContent.trim() }

    return document.querySelector('h1')?.textContent.trim() || ''
  }

  // ─── Auto-save pending contact (LinkedIn profile pages) ──────────────────
  // Stores the extracted profile info so it's available when the user later
  // sends a message from the compose overlay (which has no role/company data).

  async function autoSavePendingContact(info) {
    if (!info.name) return
    const { pending_contact: existing } = await chrome.storage.local.get(['pending_contact'])
    const norm = (s) => (s || '').toLowerCase().trim()
    const same = existing &&
      norm(existing.name)        === norm(info.name) &&
      norm(existing.linkedin_url) === norm(info.linkedin_url)
    if (!same) {
      await chrome.storage.local.set({ pending_contact: { ...info, savedAt: Date.now() } })
    }
  }

  // ─── Auto-save pending job ─────────────────────────────────────────────────

  async function autoSavePending(info) {
    if (!info.title) return
    const { pending_application: pending } = await chrome.storage.local.get(['pending_application'])
    const norm = (s) => (s || '').toLowerCase().trim()
    const sameJob = pending &&
      norm(pending.title)   === norm(info.title) &&
      norm(pending.company) === norm(info.company)
    if (!sameJob) {
      await chrome.storage.local.set({
        pending_application: { title: info.title, company: info.company, url: info.url, savedAt: Date.now() },
      })
    }
  }

  // ─── Shadow DOM host ───────────────────────────────────────────────────────

  const host = document.createElement('div')
  host.id = '__bamboo_root__'
  Object.assign(host.style, { position: 'fixed', top: '20px', right: '20px', zIndex: '2147483647' })
  document.body.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })

  // ─── State ────────────────────────────────────────────────────────────────

  let expanded    = false
  let dismissed   = false
  let mode        = 'job'       // 'job' | 'linkedin'
  let jobInfo     = {}
  let contactInfo = {}

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
        } else {
          jobInfo = extractJobInfo()
          if (!jobInfo.title) {
            const pa = await chrome.storage.local.get(['pending_application'])
              .then(r => r.pending_application).catch(() => null)
            if (pa) jobInfo = { title: pa.title, company: pa.company, url: pa.url }
          }
        }
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

  function renderJobCard() {
    shadow.innerHTML = `
      <div id="card" style="${CARD_STYLE}">
        ${cardHeader('')}
        ${fieldHtml('title-input', 'Job Title', jobInfo.title, 'e.g. Software Engineer', false)}
        ${fieldHtml('company-input', 'Company', jobInfo.company, 'e.g. Stripe', false)}
        ${msgHtml()}
        <button id="apply-btn" style="
          width:100%;padding:10px;background:#15803d;color:#fff;border:none;
          border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;
          font-family:inherit;letter-spacing:0.01em;transition:background 0.15s;
        ">✓ Mark as Applied</button>
        <button id="minimize" style="
          width:100%;padding:6px;background:none;color:#9ca3af;border:none;
          border-radius:7px;font-size:12px;cursor:pointer;margin-top:6px;font-family:inherit;
        ">Minimize</button>
      </div>`

    attachFocusStyles()
    shadow.getElementById('close').onclick   = () => { dismissed = true; render() }
    shadow.getElementById('minimize').onclick = () => { expanded = false; render() }
    shadow.getElementById('apply-btn').onclick = handleApply
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
      chrome.storage.local.remove(['pending_application'])
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
      await chrome.storage.local.remove(['pending_application'])
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
        await chrome.storage.local.remove(['pending_application'])
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

    // ── Job tracking flow ──────────────────────────────────────────────────
    if (isJobPage()) {
      const info = extractJobInfo()
      await autoSavePending(info)
      render()
      return
    }

    if (isConfirmationPage()) {
      const { pending_application: pending } = await chrome.storage.local.get(['pending_application'])
      if (pending) {
        if (Date.now() - pending.savedAt > 7 * 24 * 60 * 60 * 1000) {
          await chrome.storage.local.remove(['pending_application'])
        } else {
          renderConfirmation(pending)
          return
        }
      }
    }

    // Not a recognised page — show nothing
  }

  init()
})()
