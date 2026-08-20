// What the tour actually checks. Thirty-six flows, public first, then the owner's half.
//
// Split from `tour.ts` on 2026-08-11 when that file passed its 400-line ceiling, and the seam is
// by reader: adding a flow means writing one sentence in here and needs to know nothing about the
// DevTools protocol, while fixing the browser plumbing means opening `tour.ts` and not caring
// what is being toured.
//
// EVERY ASSERTION RUNS IN THE PAGE and returns a string: `ok`, `ok <detail>`, `skip: <why>`, or
// the reason it is not ok. A flow reads as the sentence it is checking.
//
// A flow that WRITES cleans up after itself — drafts, uploads, a settings round-trip — because a
// tour that leaves rows behind changes what the next run is testing.

import type { Tour } from './tour'
import { registerAdminFlows } from './tour-flows-admin'

export function registerFlows({ flow, expect, atWidth }: Tour): void {
  // ---------------------------------------------------------------------------------------------
  // PUBLIC — what a reader meets.


  flow('home lists posts', () => expect('/', `
    (() => {
      const n = document.querySelectorAll('article').length
      return n > 0 ? 'ok' : 'no <article> on the home page'
    })()`))

  // The URL comes from the SITEMAP, not from a link in the markup. The first version read
  // `article a[href^="/"]` and picked up a category link, then reported a perfectly good article
  // as bodyless — the tour's own aim was wrong, which is the failure mode a tour has to avoid
  // most: a red line nobody believes.
  flow('an article renders its body', () => expect('/', `
    (async () => {
      const xml = await (await fetch('/sitemap.xml')).text()
      const urls = [...xml.matchAll(/<loc>([^<]+)<\\/loc>/g)].map((m) => m[1])
      const post = urls.map((u) => new URL(u).pathname)
        .find((p) => /^\\/[a-z0-9-]+$/.test(p) && !['/search','/list'].includes(p))
      if (!post) return 'the sitemap listed no post-shaped URL'
      const html = await (await fetch(post)).text()
      return html.includes('class="prose"') ? 'ok (' + post + ')' : post + ' rendered no .prose body'
    })()`))

  flow('the feed, sitemap, robots and llms all answer', () => expect('/', `
    (async () => {
      const bad = []
      for (const p of ['/feed.xml', '/sitemap.xml', '/robots.txt', '/llms.txt']) {
        const r = await fetch(p)
        if (!r.ok) bad.push(p + ' -> ' + r.status)
      }
      return bad.length ? bad.join(', ') : 'ok'
    })()`))

  flow('a missing page is a 404, not a 200', () => expect('/', `
    (async () => {
      const r = await fetch('/definitely-not-a-post-' + Date.now())
      return r.status === 404 ? 'ok' : 'got ' + r.status
    })()`))

  flow('the theme control switches to dark', () => expect('/', `
    (() => {
      const b = document.querySelector('[data-theme-toggle]')
      if (!b) return 'no theme control in the header'
      b.click()
      const row = document.querySelector('.theme-menu [data-id="dark"]')
      if (!row) return 'the theme menu has no dark row'
      row.click()
      return document.documentElement.dataset.scheme === 'dark'
        ? 'ok' : 'data-scheme is ' + document.documentElement.dataset.scheme
    })()`))

  flow('the palette control repaints the page', () => expect('/', `
    (() => {
      const b = document.querySelector('[data-palettes]')
      if (!b) return 'skip: one palette enabled, so no control renders'
      const before = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim()
      const rows = [...b.closest('.theme-wrap').querySelectorAll('.theme-menu button')]
      const other = rows.find((r) => r.dataset.id !== document.documentElement.dataset.palette)
      other.click()
      const after = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim()
      return before !== after ? 'ok' : '--c-bg did not move from ' + before
    })()`))

  flow('only one header menu opens at a time', () => expect('/', `
    (() => {
      const p = document.querySelector('[data-palettes]')
      const t = document.querySelector('[data-theme-toggle]')
      if (!p) return 'skip: no palette control'
      t.click(); p.click()
      const open = [...document.querySelectorAll('.theme-menu')].filter((m) => !m.hidden)
      return open.length === 1 ? 'ok' : open.length + ' menus open at once'
    })()`))

  flow('search answers as you type', () => expect('/', `
    (async () => {
      const r = await fetch('/api/search?q=' + encodeURIComponent('the'))
      if (!r.ok) return '/api/search -> ' + r.status
      const body = await r.json()
      const items = body?.data ?? body
      return Array.isArray(items) ? 'ok' : 'search did not return a list'
    })()`))

  flow('the search page renders results server-side', () => expect('/search?q=the', `
    (() => document.body.innerText.trim().length > 40 ? 'ok' : 'the search page came back empty')()`))

  flow('an OG image is drawn', () => expect('/', `
    (async () => {
      const r = await fetch('/og?title=' + encodeURIComponent('Tour'))
      const type = r.headers.get('content-type') ?? ''
      return r.ok && /image/.test(type) ? 'ok' : r.status + ' ' + type
    })()`))

  flow('the manifest is installable', () => expect('/', `
    (async () => {
      const r = await fetch('/manifest.webmanifest')
      if (!r.ok) return 'manifest -> ' + r.status
      const m = await r.json()
      return m.name && Array.isArray(m.icons) && m.icons.length ? 'ok' : 'manifest has no name or icons'
    })()`))

  flow('the analytics beacon is accepted', () => expect('/', `
    (async () => {
      const r = await fetch('/api/track', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: '/tour', ref: '' }),
      })
      return r.status === 204 || r.ok ? 'ok' : '/api/track -> ' + r.status
    })()`))

  // Book mode had NO flow when Chrome 148 stopped scrolling to — and painting — a
  // multicol's overflow columns, so every instance quietly showed "1 / 1" of every article
  // with dead arrows, and 57 green flows said nothing. These two pin the three things that
  // broke: the count sees every column, a turn actually moves the flow, and the flow is
  // sized to hold its columns as real boxes (the sized flow is what makes them paint).
  flow('book mode paginates a long article and the pages turn', () => expect(
    '/the-reed-pen-in-van-goghs-letters', `
    (async () => {
      const btn = document.querySelector('[data-book-open]')
      if (!btn) return 'no book toggle on the article'
      btn.click()
      await new Promise((r) => setTimeout(r, 400))
      const d = document.querySelector('.book-overlay[open]')
      if (!d) return 'the overlay did not open'
      const count = () => d.querySelector('.book-count').textContent
      const m = /^1 \\/ (\\d+)$/.exec(count())
      if (!m) return 'counter reads ' + count()
      if (+m[1] < 2) return 'a 700-word article measured ' + count() + ' — pagination has gone blind again'
      if (d.querySelector('.book-prev').hidden) return 'arrows hidden with ' + m[1] + ' spreads'
      const flowEl = d.querySelector('.book-flow')
      const vp = d.querySelector('.book-viewport')
      if (!(parseFloat(flowEl.style.width) > vp.clientWidth))
        return 'the flow is not sized to hold its columns, so pages past 1 will not paint'
      const before = flowEl.style.transform
      d.querySelector('.book-next').click()
      await new Promise((r) => setTimeout(r, 350))
      if (!count().startsWith('2 /')) return 'the turn did not advance: ' + count()
      if (flowEl.style.transform === before) return 'the counter moved but the pages did not'
      d.querySelector('.book-x').click()
      return 'ok (' + m[1] + ' spreads)'
    })()`, 400))

  // The phone: the floating doorway exists (both server-rendered entries hide under 768px),
  // it opens the one-page reader, and the reserved chrome does not print the title into the
  // controls.
  flow('a phone can enter book mode through the floating button', () => atWidth(375,
    '/the-reed-pen-in-van-goghs-letters', `
    (async () => {
      const fab = document.querySelector('.book-fab')
      if (!fab) return 'no floating book button'
      if (getComputedStyle(fab).display === 'none') return 'the button is display:none at 375px'
      fab.click()
      await new Promise((r) => setTimeout(r, 400))
      const d = document.querySelector('.book-overlay[open]')
      if (!d) return 'the overlay did not open'
      if (d.querySelector('.book-viewport').dataset.pages !== '1') return 'a 375px phone got a two-page spread'
      const n = +(/\\/ (\\d+)$/.exec(d.querySelector('.book-count').textContent)?.[1] ?? 0)
      if (n < 2) return 'one-page mode measured ' + n + ' spread(s) for a 700-word article'
      if (getComputedStyle(d.querySelector('.book-title')).display !== 'none')
        return 'the running head is on at 375px and collides with the size buttons'
      if (getComputedStyle(d.querySelector('.book-next')).display !== 'none')
        return 'the hover arrows are still on at 375px'
      // The phone page is the glass minus 20px a side, not the desktop's 48.
      const col = parseFloat(getComputedStyle(d.querySelector('.book-flow')).columnWidth)
      if (col < innerWidth - 44) return 'the page is ' + col + 'px on a ' + innerWidth + 'px phone'
      // A tap in the right third turns the page.
      d.querySelector('.book-viewport').dispatchEvent(
        new MouseEvent('click', { clientX: Math.round(innerWidth * 0.85), bubbles: true }))
      await new Promise((r) => setTimeout(r, 350))
      if (!d.querySelector('.book-count').textContent.startsWith('2 /'))
        return 'a right-third tap did not turn the page'
      d.querySelector('.book-x').click()
      return 'ok (' + n + ' pages)'
    })()`, 400))

  registerAdminFlows({ flow, expect, atWidth })
}
