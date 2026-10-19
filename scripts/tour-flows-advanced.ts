// The Advanced band on the Server tab (docs/admin-kit.md, "An advanced band"), in a real browser.
//
// The developer's cards are folded under one key. What a fold must never cost is reach: the
// settings search, a `?setting=` link and the sheet's Save all have to work on what is folded
// exactly as on what is not, and a card asking for attention may not disappear behind the key.
// Nothing here stores anything: the one Save pressed answers from a stub.
//
// NOTE: each body is a template literal. No backticks and no backslashes inside it.
import type { Tour } from './tour'

const KEY = 'quireink-admin-settings-advanced'

export function registerAdvancedFlows({ flow, expect }: Pick<Tour, 'flow' | 'expect'>): void {
  flow('admin: the Advanced band ships shut, and its key opens it and is remembered', () => expect('/admin/settings?tab=server', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const key = document.querySelector('[data-advanced-toggle]')
      const body = document.querySelector('[data-advanced-body]')
      if (!key || !body) return 'the Server tab drew no Advanced band'
      if (localStorage.getItem('${KEY}') === null && !body.hidden) return 'it opened for a device that never asked'
      if (key.getAttribute('aria-expanded') !== String(!body.hidden)) return 'the key and the band disagree'
      // The hint stays up with the explanations hidden: it is all that says what is behind the key.
      const box = document.querySelector('[data-settings-panels]')
      const was = box.dataset.explanations
      box.dataset.explanations = 'off'
      const hint = document.getElementById(key.getAttribute('aria-describedby') || '')
      const hintShown = !!hint && hint.checkVisibility()
      box.dataset.explanations = was
      if (!hintShown) return 'the line saying what is inside went away with the explanations'
      const open = body.hidden
      key.click(); await sleep(100)
      if (body.hidden === open) return 'the key did not open it'
      if (localStorage.getItem('${KEY}') !== (open ? '1' : '0')) return 'the choice was not remembered'
      key.click(); await sleep(100)
      localStorage.removeItem('${KEY}')
      // A count shows exactly when a card inside says a test FAILED or an edit is unsaved; the
      // amber it was drawn with ("Not set up yet") is an optional card at rest, and stays quiet.
      const asking = [...body.querySelectorAll('[data-card-lamp]')].filter((l) => !l.hidden
        && l.className.split(' ').includes('bg-amber-500')
        && !(l.dataset.lampRest === 'attention' && l.getAttribute('aria-label') === l.dataset.lampRestTitle)).length
      const badge = document.querySelector('[data-advanced-count]')
      if (asking > 0 && badge.hidden) return asking + ' card(s) asking for attention folded away with nothing on the key'
      if (asking === 0 && !badge.hidden) return 'the key counts ' + badge.textContent.trim() + ' with nothing failed or unsaved'
      return 'ok (shut, opened, remembered, shut; ' + (badge.hidden ? 'nothing needs attention' : badge.textContent.trim()) + ')'
    })()`, 1200))

  flow('admin: a search hit inside the shut band opens it and points at the setting', () => expect('/admin/settings?tab=blog', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      localStorage.removeItem('${KEY}')
      const body = document.querySelector('[data-advanced-body]')
      if (!body || !body.hidden) return 'the band was not shut to begin with'
      const find = document.querySelector('[data-settings-find]')
      find.value = 'MCP'
      find.dispatchEvent(new Event('input', { bubbles: true })); await sleep(250)
      const row = [...document.querySelectorAll('[data-found]')].find((r) => !r.hidden && r.dataset.setting === 'mcpEnable')
      if (!row) return 'searching MCP did not offer the MCP switch'
      row.querySelector('button').click(); await sleep(700)
      if (body.hidden) return 'the hit is folded away: the band did not open'
      const ring = document.querySelector('.setting-found')
      if (!ring || !ring.checkVisibility()) return 'it opened the band and pointed at nothing visible'
      if (!ring.textContent.includes(row.dataset.label)) return 'it pointed at the wrong row: ' + ring.textContent.trim().slice(0, 40)
      if (localStorage.getItem('${KEY}') !== null) return 'a search changed the device preference'
      return 'ok (opened for the hit, ringed ' + row.dataset.label + ', preference untouched)'
    })()`, 1200))

  flow('admin: a ?setting= link lands on a folded setting', () => expect('/admin/settings?tab=blog&setting=seoOgImage', `
    (async () => {
      const open = document.querySelector('[data-settings-panel]:not([hidden])')
      if (!open || open.dataset.settingsPanel !== 'server') return 'the link did not open the Server tab'
      if (document.querySelector('[data-advanced-body]').hidden) return 'the band stayed shut over the setting the link named'
      // The ring fades after 1.6s, so what is asserted is where the page came to rest: ON the
      // switch the link named, which only happens if the band opened before the scroll.
      // seoOgImage is the label with a badge beside it, which no lookup found before findSetting.
      const sw = document.querySelector('[data-switch][data-k="seo.ogImage"]')
      if (!sw || !sw.checkVisibility()) return 'the share-image switch is not on screen'
      const r = sw.getBoundingClientRect()
      if (r.top < 0 || r.bottom > innerHeight) return 'the page did not come to rest on it (top ' + Math.round(r.top) + ')'
      // Landed, the address forgets it: a reload after moving tabs must not drag the owner back.
      if (new URL(location.href).searchParams.has('setting')) return 'the address still carries setting='
      return 'ok (Server tab, band open, the share-image switch in view, address clean)'
    })()`, 1200))

  flow('admin: a key changed inside the shut band is counted and sent by the Save key', () => expect('/admin/settings?tab=server', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      localStorage.removeItem('${KEY}')
      const key = document.querySelector('[data-advanced-toggle]')
      const save = document.querySelector('[data-settings-save]')
      if (!save.disabled) return 'the Save key was live before anything changed'
      key.click(); await sleep(100)
      const sw = document.querySelector('[data-switch][data-k="seo.llms"]')
      const was = sw.getAttribute('aria-checked')
      sw.click(); await sleep(100)
      key.click(); await sleep(150)
      localStorage.removeItem('${KEY}')
      if (sw.checkVisibility()) return 'the band did not shut'
      if (save.disabled) return 'a change folded under Advanced left the Save key shut'
      if (save.textContent.indexOf('1') < 0) return 'the Save key does not count it: ' + save.textContent
      const badge = document.querySelector('[data-advanced-count]')
      if (badge.hidden) return 'the folded band says nothing about an unsaved change inside it'
      // Answered by a stub, so nothing is stored: what is asserted is what would have been sent.
      const real = window.fetch
      const sent = []
      window.fetch = (u, i) => {
        if (String(u).indexOf('/api/settings') >= 0 && i && i.method === 'PUT') {
          sent.push(JSON.parse(i.body))
          return Promise.resolve(new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }))
        }
        return real(u, i)
      }
      save.click(); await sleep(500)
      window.fetch = real
      if (sent.length !== 1) return sent.length + ' save request(s)'
      if (!sent[0].seo || sent[0].seo.llms !== (was !== 'true')) return 'the folded key was not in the body: ' + JSON.stringify(sent[0])
      if (!save.disabled) return 'the Save key stayed live after the save landed'
      return 'ok (counted while folded, sent ' + JSON.stringify(sent[0]) + ')'
    })()`, 1200))
}
