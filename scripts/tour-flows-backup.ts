// Backup: the one button in this admin that nobody had ever pressed.
//
// A file of its own rather than three more flows in `tour-flows-settings.ts`, which was at
// its 400-line cap — and the split is a real seam: everything here is about the archive
// leaving the machine, which is the one act in this product that has to work on the worst
// day somebody ever has.

import type { Tour } from './tour'

export function registerBackupFlows({ flow, expect }: Tour): void {
  // ── The download nobody had ever pressed ────────────────────────────────────────────────
  //
  // On 2026-09-13 the owner tried to take a 262 MB backup away and could not. The route was
  // fine — `restore-check.ts` fetches it from Bun on every tour and always had. What was
  // broken was the BUTTON: it pulled the whole archive through `fetch().blob()` into the
  // tab's memory before handing it over, which on a real connection is minutes with nothing
  // on screen, no progress bar and no way to resume — and then revoked the object URL on the
  // line after `click()`, racing the download it had just started.
  //
  // Nothing could have caught it. 119 flows drove this admin in a real browser and not one
  // of them pressed that button; the suite that did touch the route never used a browser at
  // all. So this flow checks the MECHANISM rather than the bytes: the click has to hand a URL
  // to the browser, and it may not fetch the archive itself. Both halves matter — a version
  // that fetched AND linked would pass a check that only looked for the link.
  flow('admin: taking a backup away hands the URL to the browser, not the tab', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const tab = [...document.querySelectorAll('button, a')].find((n) => /server|máy chủ/i.test(n.textContent || ''))
      if (tab) { tab.click(); await sleep(500) }
      const button = [...document.querySelectorAll('button')]
        .find((n) => (n.textContent || '').trim() === 'Download archive')
      if (!button) return 'no Download archive button on the server tab'

      let handedOver = null
      let pulledThroughJs = false
      const realClick = HTMLAnchorElement.prototype.click
      const realFetch = window.fetch
      // The anchor's click is stubbed so the tour does not actually start a 262 MB download.
      HTMLAnchorElement.prototype.click = function () { handedOver = this.getAttribute('href') }
      window.fetch = function (input, ...rest) {
        if (String(input && input.url ? input.url : input).includes('/api/backup/')) pulledThroughJs = true
        return realFetch.call(this, input, ...rest)
      }
      try {
        button.click()
        await sleep(600)
      } finally {
        HTMLAnchorElement.prototype.click = realClick
        window.fetch = realFetch
      }

      if (pulledThroughJs) return 'the archive was fetched into the tab instead of handed to the browser'
      if (!handedOver) return 'pressing it handed no URL to the browser'
      if (!handedOver.includes('/api/backup/export')) return 'handed over the wrong URL: ' + handedOver
      return 'ok handed ' + handedOver + ' to the browser, fetched nothing'
    })()`, 1200))

  // ── The OTHER key in that card, and the lesson of issue #60 ─────────────────────────────
  //
  // `/api/export/markdown` is covered by a route test and a round-trip test, and neither of
  // them can see whether anything on screen reaches it. That is exactly how the Trash spent
  // thirteen days and four releases with a working endpoint and no control that called it:
  // every flow touching it called the endpoint directly. So this one CLICKS, in the language
  // the admin happens to be in, and asserts the same two halves as the flow above.
  flow('admin: the writing can be taken away as Markdown, by pressing the key', () => expect('/admin/settings', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const tab = [...document.querySelectorAll('button, a')].find((n) => /server|máy chủ/i.test(n.textContent || ''))
      if (tab) { tab.click(); await sleep(500) }
      const button = document.querySelector('[data-writing-export]')
      if (!button) return 'no Markdown export key on the server tab'
      if (button.offsetParent === null) return 'the key is in the markup but not on screen'
      const label = (button.textContent || '').trim()
      if (!label) return 'the key has no words on it'

      let handedOver = null
      let pulledThroughJs = false
      const realClick = HTMLAnchorElement.prototype.click
      const realFetch = window.fetch
      HTMLAnchorElement.prototype.click = function () { handedOver = this.getAttribute('href') }
      window.fetch = function (input, ...rest) {
        if (String(input && input.url ? input.url : input).includes('/api/export/')) pulledThroughJs = true
        return realFetch.call(this, input, ...rest)
      }
      try {
        button.click()
        await sleep(600)
      } finally {
        HTMLAnchorElement.prototype.click = realClick
        window.fetch = realFetch
      }

      if (pulledThroughJs) return 'the bundle was fetched into the tab instead of handed to the browser'
      if (!handedOver) return 'pressing it handed no URL to the browser'
      if (!handedOver.includes('/api/export/markdown')) return 'handed over the wrong URL: ' + handedOver
      return 'ok "' + label + '" handed ' + handedOver + ' to the browser'
    })()`, 1200))
}
