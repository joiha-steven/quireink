// The two things that changed about a piece's own numbers, checked in a real browser.
//
// Both are places where a unit test can be green while the product is wrong: one is a link
// that has to EXIST on a screen, and the other is a browser event that has to produce a
// network call. Neither is reachable from `bun test`.
import type { Tour } from './tour'

export function registerStatsFlows({ flow, expect }: Tour): void {
  /**
   * The door. Until 2026-08-30 the only route into a piece's drill-down was a row in the
   * top-ten table, so a piece outside it could not be looked at at all.
   *
   * The flow types into the filter rather than just counting rows, because the filter IS
   * the control here: an index nobody can narrow is a list, not a way to find one piece.
   */
  flow('admin: every piece has a way into its own numbers', () => expect('/admin/analytics', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const box = document.querySelector('[data-piece-search]')
      if (!box) return 'the analytics screen has no piece index'

      const rows = () => [...document.querySelectorAll('[data-piece-row]')]
      const before = rows()
      if (!before.length) return 'the index listed nothing at all'

      // Every row must be a door, not a label: the whole point is the href.
      const bad = before.filter((a) => !a.getAttribute('href')?.includes('/admin/analytics?path='))
      if (bad.length) return bad.length + ' rows link somewhere other than a drill-down'

      // A piece the top table cannot be showing: the LAST row of the full index.
      const target = before[before.length - 1].textContent.trim()
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(box, target.slice(0, 8))
      box.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(200)

      const after = rows()
      if (!after.length) return 'filtering to "' + target.slice(0, 8) + '" emptied the list'
      if (after.length >= before.length) return 'the filter did not narrow anything'
      return after.some((a) => a.textContent.trim() === target)
        ? 'ok (' + before.length + ' -> ' + after.length + ')'
        : 'the filtered list lost the piece it was filtered to'
    })()`, 1200))

  /**
   * THE BOUNCE COHORT, which the beacon used to throw away.
   *
   * `depth()` is 0 on a long article nobody scrolled, and the leave beacon refused to send
   * a sample at depth 0 — so the one visit worth measuring was the one visit never
   * recorded, and every average over `analytics_scroll` was taken over the people who did
   * NOT bounce. Asserted here at the only place it is observable: the network call a real
   * `pagehide` produces on a page the reader never touched.
   */
  flow('a reader who leaves without scrolling is still counted', () =>
    expect('/the-reed-pen-in-van-goghs-letters', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      if (document.documentElement.scrollHeight <= document.documentElement.clientHeight) {
        return 'this article fits the viewport, so depth is 100 and it proves nothing'
      }
      if (window.scrollY !== 0) return 'the page was already scrolled'

      const sent = []
      const real = navigator.sendBeacon
      navigator.sendBeacon = function (url, body) { sent.push({ url, body }); return true }
      try {
        // What a browser dispatches when the tab closes, the reader navigates away, or the
        // page goes into the back/forward cache.
        window.dispatchEvent(new Event('pagehide'))
        await sleep(150)
      } finally {
        navigator.sendBeacon = real
      }

      if (!sent.length) return 'leaving without scrolling sent nothing'
      const body = JSON.parse(await sent[0].body.text())
      if (typeof body.depth !== 'number') return 'the leave beacon carried no depth'
      if (body.depth !== 0) return 'expected depth 0 on an unscrolled page, got ' + body.depth
      return typeof body.dwell === 'number' ? 'ok (depth 0, dwell ' + body.dwell + 'ms)' : 'no dwell measured'
    })()`, 1200))
}
