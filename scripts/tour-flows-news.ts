// The newsletter's own flows. Split from `tour-flows-admin.ts`, which sits at the 400-line
// ceiling — same seam as the editor, home and pane flows beside it.

import type { Tour } from './tour'

export function registerNewsFlows({ flow, expect }: Tour): void {
  // The send latch, end to end minus the send itself: a newsletter cannot be unsent, so the
  // button arms on the first press — amber, the recipient count the send would use, a
  // countdown — and Escape stands it down. `check:all` proves the pieces compile; only a
  // browser proves that the second press is really required and that Esc really disarms.
  // Nothing here ever fires the POST, so the flow needs no cleanup.
  flow('admin: the newsletter send button arms, counts, and stands down', () => expect('/admin/newsletter', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const byText = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()))
      const tab = byText(/^Send$/)
      if (!tab) return 'no Send tab'
      tab.click(); await sleep(500)
      // The armed label prints the count the PREVIEW carried, so wait for the preview.
      for (let i = 0; i < 20 && !document.querySelector('iframe'); i++) await sleep(200)
      // The seed has already mailed one post; if that is the one ticked, give the resend
      // consent so the latch unlocks. The flow still never sends.
      const consent = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('send it again'))
      const box = consent && consent.querySelector('input')
      if (box && !box.checked) { box.click(); await sleep(200) }
      const send = byText(/^Send to subscribers$/)
      if (!send) return 'no send button'
      if (send.disabled) return 'send button locked before the first press'
      send.click(); await sleep(300)
      const armedBtn = [...document.querySelectorAll('button')].find((b) => /press again/.test(b.textContent))
      if (!armedBtn) return 'first press did not arm the latch'
      if (!/[0-9]+ subscribers/.test(armedBtn.textContent)) return 'armed label carries no recipient count: ' + armedBtn.textContent
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await sleep(250)
      if (!byText(/^Send to subscribers$/)) return 'Escape did not stand the latch down'
      return 'ok (armed with a count, stood down, nothing sent)'
    })()`, 900))
}
