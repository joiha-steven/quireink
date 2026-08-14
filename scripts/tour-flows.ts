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

  registerAdminFlows({ flow, expect, atWidth })
}
