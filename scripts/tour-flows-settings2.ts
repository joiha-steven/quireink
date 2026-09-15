// The settings screen's own flows, for the server-drawn version (ADR 0054).
//
// ⚠️ THIS SCREEN DRIVES THE MOST DANGEROUS ROUTES IN THE ADMIN, and not one of them is pressed
// here. The password, the recovery codes, the second factor, signing devices out, the SMTP test
// send, the provider's model list, the alt-text sweep, taking or deleting a backup, the off-site
// probe, a CDN purge, every import, minting or revoking an MCP token, deleting a redirect: all
// off limits. What IS driven is the screen — the strip, the search, the explanations, the
// controls that only move the FORM — plus `PUT /api/settings`, which the existing settings flows
// already exercise and which is restored afterwards.
import type { Tour } from './tour'
import { SCREEN_FORMS } from './tour-ask'

export function registerSettings2Flows({ flow, expect }: Pick<Tour, 'flow' | 'expect'>): void {
  flow('admin: settings arrives finished, all seven tabs of it', () => expect('/admin/settings', `
    (() => {
      const screen = document.querySelector('[data-screen="settings"]')
      if (!screen) return 'settings did not come from the server'
      if (document.documentElement.dataset.adminScreen !== 'settings') return 'the page is not stamped'
      const panels = [...document.querySelectorAll('[data-settings-panel]')]
      if (panels.length !== 7) return panels.length + ' panel(s), expected seven'
      // ALL SEVEN are in the page at once, because the Save key stores the whole form.
      const shut = panels.filter((p) => p.hidden).length
      if (shut !== 6) return shut + ' of seven hidden, expected six'
      const controls = document.querySelectorAll('[data-k]').length
      if (controls < 100) return 'only ' + controls + ' control(s) in the first response'
      return 'ok (' + controls + ' controls, seven panels, one response)'
    })()`, 1500))

  // The same safety shape the newsletter, the assistant and the library are held to — and this
  // screen has the most to lose by a stray Enter.
  flow('admin: nothing in settings is a form, and no secret is in the page', () => expect('/admin/settings', `
    (() => {
      ${SCREEN_FORMS}
      const forms = screenForms().length
      if (forms) return forms + ' form(s) on the screen that changes the password'
      const buttons = [...document.querySelectorAll('main button')]
      const untyped = buttons.filter((b) => b.getAttribute('type') !== 'button')
      if (untyped.length) return untyped.length + ' button(s) with no type: ' + untyped.slice(0, 3).map((b) => b.textContent.trim()).join(' | ')
      if (buttons.length < 30) return 'only ' + buttons.length + ' buttons, so this proves little'
      // A credential box ships EMPTY: sending the dots back would store the dots.
      const creds = [...document.querySelectorAll('input[type=password]')]
      const filled = creds.filter((el) => el.value !== '')
      if (filled.length) return filled.length + ' credential box(es) arrived with a value in them'
      // And a control that stores no setting must not wear a setting's name.
      const named = creds.filter((el) => el.hasAttribute('data-k'))
      if (named.length) return named.length + ' credential box(es) carry data-k'
      return 'ok (' + buttons.length + ' buttons, 0 forms, ' + creds.length + ' empty credential box(es))'
    })()`, 1500))

  flow('admin: the settings strip swaps tabs in a frame, and the address remembers which', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const tab = (k) => document.querySelector('[data-settings-tabs] [data-tab="' + k + '"]')
      const panel = (k) => document.querySelector('[data-settings-panel="' + k + '"]')
      if (!tab('appearance')) return 'no settings strip'
      tab('appearance').click(); await sleep(250)
      if (panel('appearance').hidden) return 'the appearance tab did not come forward'
      if (!panel('blog').hidden) return 'the blog tab stayed on screen'
      if (new URL(location.href).searchParams.get('tab') !== 'appearance') return 'the address forgot the tab'
      // The line under the strip is the tab's own sentence, so it moves with it.
      const hint = document.querySelector('[data-notes-row]:not([hidden])')
      if (!hint || hint.dataset.notesRow !== 'appearance') return 'the hint under the strip did not follow'
      tab('blog').click(); await sleep(250)
      if (new URL(location.href).searchParams.get('tab')) return 'going back to Blog left the address dirty'
      return 'ok (one tab on screen, the address and the strip agree on which)'
    })()`, 1800))

  flow('admin: the settings search narrows and lands on the setting, not just the tab', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const find = document.querySelector('[data-settings-find]')
      const rows = () => [...document.querySelectorAll('[data-found]')].filter((r) => !r.hidden)
      if (!find) return 'no search on the settings row'
      const all = document.querySelectorAll('[data-found]').length
      if (all < 50) return 'the search index drew ' + all + ' row(s)'
      // Every row is already in the page: narrowing hides, it does not fetch.
      if (rows().length) return 'results are showing before anything was typed'
      find.value = 'a'
      find.dispatchEvent(new Event('input', { bubbles: true })); await sleep(200)
      if (rows().length) return 'one letter opened the list'
      const row = document.querySelector('[data-found]')
      const word = (row.dataset.label || '').split(' ')[0]
      find.value = word
      find.dispatchEvent(new Event('input', { bubbles: true })); await sleep(250)
      const hits = rows()
      if (hits.length === 0) return 'searching a label\\'s own first word matched nothing: ' + word
      if (document.querySelectorAll('[data-found]').length !== all) return 'narrowing removed rows from the page'
      const wanted = hits[0].dataset.found
      hits[0].querySelector('button').click(); await sleep(500)
      const open = document.querySelector('[data-settings-panel]:not([hidden])')
      if (!open || open.dataset.settingsPanel !== wanted) return 'choosing a result did not open its tab'
      if (!document.querySelector('.setting-found')) return 'it opened the tab and did not point at the setting'
      return 'ok (' + hits.length + ' of ' + all + ' matched, landed on ' + wanted + ')'
    })()`, 2000))

  // Nothing is stored here: the switch is put back before the flow ends.
  flow('admin: the save key counts what is waiting, and nothing else', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const key = document.querySelector('[data-settings-save]')
      if (!key) return 'no save key'
      if (!key.disabled) return 'the save key is pressable with nothing to save'
      const sw = document.querySelector('[data-settings-panel]:not([hidden]) [data-switch]')
      if (!sw) return 'no switch on the open tab'
      const was = sw.getAttribute('aria-checked')
      sw.click(); await sleep(200)
      if (key.disabled) return 'moving a switch left the save key shut'
      if (!/1/.test(key.textContent)) return 'the key does not say how many: ' + key.textContent
      if (sw.getAttribute('aria-checked') === was) return 'the switch did not move'
      sw.click(); await sleep(200)
      if (!key.disabled) return 'putting it back left the key pressable'
      return 'ok (counted one, then none, nothing stored)'
    })()`, 1800))

  flow('admin: the explanations can be hidden, and it is remembered', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      localStorage.removeItem('quireink-admin-settings-notes')
      const box = document.querySelector('[data-settings-panels]')
      const toggle = document.querySelector('[data-notes-row]:not([hidden]) [data-notes-toggle]')
      if (!box || !toggle) return 'no explanations switch'
      const before = box.dataset.explanations
      toggle.click(); await sleep(200)
      if (box.dataset.explanations === before) return 'the switch did not change anything'
      const stored = localStorage.getItem('quireink-admin-settings-notes')
      if (stored !== '1' && stored !== '0') return 'the choice was not remembered: ' + stored
      toggle.click(); await sleep(200)
      if (box.dataset.explanations !== before) return 'it did not go back'
      // ⚠️ PUT THE PREFERENCE BACK. Once this is stored it stops being a preference nobody has
      // answered, and the tab-length measurement stops running at all — which is exactly how
      // this flow broke the one that checks a short tab opens with its explanations. A flow
      // that leaves state behind changes what the next flow is testing.
      localStorage.removeItem('quireink-admin-settings-notes')
      return 'ok (hidden, remembered, and back)'
    })()`, 1800))
}
