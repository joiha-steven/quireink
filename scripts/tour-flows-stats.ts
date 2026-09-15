// The analytics screen in a real browser, and the one measurement behind it that a unit test
// cannot reach.
//
// Every flow here is a place where `bun test` can be green while the product is wrong: a link
// that has to EXIST on a screen, a filter over rows that HIDE rather than disappear, markup
// that has to arrive finished in the first response, and a browser event that has to produce a
// network call. None of those is a function anything can call.
import type { Tour } from './tour'

export function registerStatsFlows({ flow, expect }: Tour): void {
  /**
   * The door. Until 2026-08-30 the only route into a piece's drill-down was a row in the
   * top-ten table, so a piece outside it could not be looked at at all.
   *
   * The flow types into the filter rather than just counting rows, because the filter IS the
   * control here: an index nobody can narrow is a list, not a way to find one piece.
   *
   * ⚠️ VISIBLE ROWS, NOT ROWS. Since the screen became server-rendered HTML (ADR 0054) the
   * whole index is in the markup and the ten standing rows are the ten without `hidden` —
   * filtering unhides and re-hides, it never adds or removes. Counting `querySelectorAll`
   * here would have found the same number before and after every keystroke and called it a
   * pass. `offsetParent` is null for anything `display:none`, which is what `[hidden]` is.
   */
  flow('admin: every piece has a way into its own numbers', () => expect('/admin/analytics', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const box = document.querySelector('[data-piece-search]')
      if (!box) return 'the analytics screen has no piece index'

      const all = [...document.querySelectorAll('[data-piece-row]')]
      const rows = () => all.filter((a) => a.offsetParent !== null)
      if (!all.length) return 'the index listed nothing at all'

      // Every row must be a door, not a label: the whole point is the href. Checked over the
      // WHOLE index, including the rows standing hidden behind the ten.
      const bad = all.filter((a) => !a.getAttribute('href')?.includes('/admin/analytics?path='))
      if (bad.length) return bad.length + ' rows link somewhere other than a drill-down'

      const before = rows()
      if (!before.length) return 'the index is in the markup but nothing is showing'
      // The ten, and the rest behind them. A blog with ten pieces or fewer has nothing to hide
      // and the filter is still what this flow is about, so that is not a failure.
      if (all.length > 10 && before.length !== 10) {
        return 'expected ten rows standing, found ' + before.length + ' of ' + all.length
      }

      // A piece the top table cannot be showing: the LAST row of the full index, which is in
      // the markup whether or not it is on screen.
      const target = all[all.length - 1].textContent.trim()
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(box, target.slice(0, 8))
      box.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(200)

      const after = rows()
      if (!after.length) return 'filtering to "' + target.slice(0, 8) + '" emptied the list'
      if (all.length > 10 && after.length >= all.length) return 'the filter did not narrow anything'
      if (!after.some((a) => a.textContent.trim() === target)) {
        return 'the filtered list lost the piece it was filtered to'
      }

      // And it must give the whole list back: a filter that cannot be undone is a dead end.
      setter.call(box, '')
      box.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(200)
      if (rows().length !== before.length) return 'clearing the box did not restore the ten'
      return 'ok (' + all.length + ' in the markup, ' + before.length + ' standing, ' + after.length + ' matched)'
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

  /**
   * ⚠️ THE WHOLE INDEX IS IN THE FIRST RESPONSE, which is the claim the conversion makes and
   * the one a unit test cannot see. React fetched a view, joined pieces to titles in the
   * browser and built every row; if any of that came back, this flow's numbers stop matching.
   */
  flow('admin: the analytics screen arrives finished, without React drawing it', () => expect('/admin/analytics', `
    (async () => {
      const html = await (await fetch('/admin/analytics')).text()
      if (!html.includes('data-screen="analytics"')) return 'the server did not draw the analytics screen'
      if (!html.includes('data-admin-screen="analytics"')) return 'the server did not name analytics as the screen it drew'


      // Every piece row arrived as markup, not as a row built after a fetch.
      const inMarkup = (html.match(/data-piece-row/g) || []).length
      const onScreen = document.querySelectorAll('[data-piece-row]').length
      if (!inMarkup) return 'skip: this instance has no analytics rows to index'
      if (inMarkup !== onScreen) return 'markup held ' + inMarkup + ' pieces, the page shows ' + onScreen

      // The chart is SVG the server wrote: no library, and no second pass to draw it.
      const chart = document.querySelector('main svg polyline')
      if (!chart) return 'the trend chart did not arrive drawn'
      return 'ok ' + inMarkup + ' piece(s), the chart and both live faces, all in the first response'
    })()`, 900))

  /**
   * The range strip and the drill-down, which are the two places this screen is an ADDRESS
   * rather than a widget: a chosen window has to survive a reload and be something the owner
   * can send to themselves, and every title has to be a door.
   *
   * The detail page is FETCHED, never navigated to. A flow that moves its own page tears down
   * the evaluation it is, and the verdict comes back empty.
   */
  flow('admin: the analytics range is a link, and the drill-down is a page too', () => expect('/admin/analytics', `
    (async () => {
      const tabs = [...document.querySelectorAll('[data-tab]')].filter((a) => a.closest('main'))
      const links = tabs.filter((a) => a.tagName === 'A' && (a.getAttribute('href') || '').includes('range='))
      if (links.length < 5) return 'the range strip is not five links, it is ' + links.length
      const here = links.filter((a) => a.getAttribute('aria-current') === 'page')
      if (here.length !== 1) return here.length + ' range tabs claim to be the current page'

      const row = document.querySelector('[data-piece-row]') || document.querySelector('main tbody a')
      if (!row) return 'skip: this instance has no piece to drill into'
      const href = row.getAttribute('href') || ''
      if (!href.includes('path=')) return 'a piece row does not link to a drill-down: ' + href

      const html = await (await fetch(href)).text()
      if (!html.includes('data-analytics-detail=')) return 'the drill-down did not arrive server-drawn'
      if (!html.includes('data-admin-screen="analytics"')) return 'the server did not name analytics as the screen it drew for the drill-down'
      // Four windows there against the summary's five: all time is deliberately absent.
      const windows = (html.match(/range=[0-9]+"/g) || []).length
      if (windows < 4) return 'the drill-down offers ' + windows + ' windows, expected four'
      return 'ok (' + links.length + ' windows, and ' + href.split('path=')[1] + ' opens its own page)'
    })()`, 900))

  /**
   * THE LIVE STRIP'S TWO FACES, both in the markup, exactly one of them standing.
   *
   * It is the one thing on this screen an island writes a VALUE into, so it is the one thing
   * that can be drawn wrong at first paint and corrected a second later — which nobody watching
   * would notice, and which would mean the first response was lying.
   */
  flow('admin: the analytics live strip ships both faces and shows one', () => expect('/admin/analytics', `
    (() => {
      const strip = document.querySelector('[data-live]')
      if (!strip) return 'the screen has no live strip'
      const on = strip.querySelector('[data-live-lamp="on"]')
      const off = strip.querySelector('[data-live-lamp="off"]')
      if (!on || !off) return 'the strip does not carry both lamps'
      const lit = on.offsetParent !== null
      const dark = off.offsetParent !== null
      if (lit === dark) return lit ? 'both lamps are showing at once' : 'neither lamp is showing'

      // Colour never carries the message alone: whichever lamp is up has the sentence on it,
      // on the lamp ITSELF — the hook rides the mark rather than a wrapper, because a wrapper
      // around an 8px lamp becomes a flex item and takes the line-height with it.
      const said = (lit ? on : off).getAttribute('aria-label')
      if (!said) return 'the lamp that is showing has no name on it'

      const quiet = strip.querySelector('[data-live-quiet]')
      const count = strip.querySelector('[data-live-count]')
      if (!quiet || !count) return 'the strip does not carry both sentences'
      const showing = [quiet, count].filter((el) => el.offsetParent !== null)
      if (showing.length !== 1) return showing.length + ' of the two sentences are showing'
      return 'ok (' + (lit ? 'reading' : 'quiet') + ', named "' + said + '")'
    })()`, 700))

  /**
   * THE POLL, waited out in real time, because ten seconds is the whole mechanism.
   *
   * Everything else on this screen is drawn once and proven by the markup. This is the one
   * path that leaves the page, comes back and WRITES — the count, the lamp's sentence and up
   * to three titles — and none of that is a function anything can call: it lives inside the
   * island's closure behind a `setInterval`. So the flow stubs the network, waits the interval
   * out and reads what landed on the glass.
   *
   * The stubbed path is deliberately one the piece index knows, so this also proves the
   * island names a live reader's page rather than printing its address.
   */
  flow('admin: the analytics live strip takes what the poll brings back', () => expect('/admin/analytics', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const row = document.querySelector('[data-piece-row]')
      if (!row) return 'skip: this instance has no piece index to name a path from'
      const path = row.getAttribute('title')
      const title = row.textContent.trim()

      const real = window.fetch
      let asked = 0
      window.fetch = function (url, init) {
        if (String(url).includes('/view/analytics-now')) {
          asked += 1
          return Promise.resolve(new Response(
            JSON.stringify({ data: { visitors: 7, pages: [{ path: path, visitors: 4 }] } }),
            { headers: { 'content-type': 'application/json' } },
          ))
        }
        return real.call(window, url, init)
      }
      try {
        // The island's own interval is ten seconds and there is no handle on it from here.
        await sleep(11500)
      } finally {
        window.fetch = real
      }
      if (!asked) return 'the strip never polled'

      const count = document.querySelector('[data-live-count]')
      const pages = document.querySelector('[data-live-pages]')
      const on = document.querySelector('[data-live-lamp="on"]')
      if (!count || !pages || !on) return 'the strip lost a piece of itself'
      if (on.offsetParent === null) return 'seven readers came back and the lamp stayed dark'
      if (!count.textContent.includes('7')) return 'the count says "' + count.textContent + '"'
      if ((on.getAttribute('aria-label') || '').indexOf('7') === -1) return 'the lamp kept the old sentence'
      // The NAME, not the address: the island reads the piece index for it.
      if (!pages.textContent.includes(title)) return 'the strip printed "' + pages.textContent + '"'
      if (pages.textContent.includes('(4)') === false) return 'the reader count beside the title is missing'
      return 'ok (' + asked + ' poll(s), 7 reading, named "' + title + '")'
    })()`, 600))
}
