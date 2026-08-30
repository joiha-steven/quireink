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
import { registerStatsFlows } from './tour-flows-stats'

export function registerFlows({ flow, expect, atWidth }: Tour): void {
  // ---------------------------------------------------------------------------------------------
  // PUBLIC — what a reader meets.


  flow('home lists posts', () => expect('/', `
    (() => {
      const n = document.querySelectorAll('article').length
      return n > 0 ? 'ok' : 'no <article> on the home page'
    })()`))

  // The URL comes from the FEED, not from a link in the markup and not from the sitemap.
  // Both earlier aims were wrong, and each cost a red line nobody believed: reading
  // `article a[href^="/"]` picked up a category link and called a perfectly good article
  // bodyless, and guessing a post by URL SHAPE off the sitemap — one segment, not `/search`
  // or `/list` — picked `/archive` the day the sitemap learned to list it. A feed item is a
  // post by definition, so there is no shape left to guess at.
  // The comment gate (ADR 0032), end to end, in the browser it has to work in. `check:all`
  // proves the arithmetic; only this proves that a reader can leave a comment — the island
  // solving a real challenge with the browser's own crypto, and the same POST refused when
  // nobody solved anything. It was watched RED against a build with the island removed.
  flow('a reader can comment, and a script cannot', () => expect('/', `
    (async () => {
      const xml = await (await fetch('/feed.xml')).text()
      const post = [...xml.matchAll(/<link>([^<]+)<\\/link>/g)]
        .map((m) => new URL(m[1]).pathname).find((p) => p !== '/')
      if (!post) return 'the feed listed no post'
      const slug = post.slice(1)

      // What a bot does: the JSON, with nothing solved.
      const bare = await fetch('/api/comments', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postSlug: slug, name: 'Bot', email: 'bot@example.com', content: 'buy things' }),
      })
      if (bare.ok) return 'a comment with no stamp was ACCEPTED'

      // What a reader does: the page's own challenge, solved here the way the island does.
      const html = await (await fetch(post)).text()
      const raw = html.match(/data-stamp="([^"]*)"/)
      if (!raw) return post + ' carried no challenge'
      const stamp = JSON.parse(raw[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
      const enc = new TextEncoder()
      let answer = -1
      for (let n = 0; n < stamp.range; n++) {
        const d = await crypto.subtle.digest('SHA-256', enc.encode(stamp.salt + n))
        const hex = [...new Uint8Array(d, 0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
        if (hex === stamp.target.slice(0, 16)) { answer = n; break }
      }
      if (answer < 0) return 'the challenge had no answer inside its own range'
      const real = await fetch('/api/comments', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          postSlug: slug, name: 'Tour', email: 'tour@example.com',
          content: 'Left by the tour, through the gate.', stamp: { ...stamp, answer },
        }),
      })
      if (!real.ok) return 'a solved comment was refused: ' + real.status
      return 'ok (bot ' + bare.status + ', reader 200, answer ' + answer + ')'
    })()`, 4000))

  flow('an article renders its body', () => expect('/', `
    (async () => {
      const xml = await (await fetch('/feed.xml')).text()
      const post = [...xml.matchAll(/<link>([^<]+)<\\/link>/g)]
        .map((m) => new URL(m[1]).pathname).find((p) => p !== '/')
      if (!post) return 'the feed listed no post'
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

  // The rail is where a reader FINDS the archive, and the anchor is the only thing joining
  // the two. A year row pointing at an id no heading carries would scroll nowhere and look
  // like nothing happened, which no assertion about either page on its own would catch.
  flow('the archive groups by year, and the rail lands on one', () => expect('/archive', `
    (() => {
      const years = [...document.querySelectorAll('.arc-yr h2[id]')]
      if (!years.length) return 'no year heading on /archive'
      const rows = document.querySelectorAll('.arc-yr li a[href^="/"]').length
      if (!rows) return 'a year with no posts under it'
      const rail = [...document.querySelectorAll('.rail a[href^="/archive#"]')]
      if (!rail.length) return 'the rail offers no way in'
      const missing = rail
        .map((a) => a.getAttribute('href').split('#')[1])
        .filter((id) => !document.getElementById(id))
      return missing.length ? 'rail points at absent anchor(s): ' + missing.join(', ')
        : 'ok ' + years.length + ' year(s), ' + rows + ' row(s)'
    })()`))

  // A term feed whose self link names a different document re-subscribes the reader to the
  // whole blog. Nothing on the page they clicked from would ever show it.
  flow('every archive has a feed that names itself', () => expect('/', `
    (async () => {
      const term = document.querySelector('.rail a[href^="/category/"], .rail a[href^="/tag/"]')
      if (!term) return 'skip: this blog files nothing'
      const path = new URL(term.href).pathname + '/feed.xml'
      const r = await fetch(path)
      if (!r.ok) return path + ' -> ' + r.status
      const xml = new DOMParser().parseFromString(await r.text(), 'application/xml')
      if (xml.querySelector('parsererror')) return path + ' is not well-formed XML'
      // Walked, not queried. The element is \`atom:link\` in a namespace, and a CSS type
      // selector against a prefixed name in an XML document does not reliably match it.
      const self = [...xml.getElementsByTagName('*')]
        .find((el) => el.getAttribute('rel') === 'self')?.getAttribute('href') ?? ''
      if (!self.endsWith(path)) return 'self points at ' + self + ', not at ' + path
      return 'ok ' + xml.querySelectorAll('item').length + ' item(s)'
    })()`))

  // The offline switch (ADR 0039), end to end, with the caches read back.
  //
  // Every part of this is invisible from the server: whether a worker installs, what it
  // keeps, what it refuses to keep, and — the one that matters most — whether switching the
  // feature off actually takes it back off the device. A worker outlives the page that
  // registered it, so "off" that only stops registering NEW ones is a one-way door, and no
  // unit test can tell the difference. The flow leaves the setting as it found it.
  flow('offline keeps a read page, never the admin, and can be taken back', () => expect('/', `
    (async () => {
      if (!('serviceWorker' in navigator)) return 'skip: no service worker in this browser'
      const view = async () => (await (await fetch('/api/admin/view/settings')).json())?.data?.settings
      const before = (await view())?.features
      if (!before) return 'could not read settings (no owner session?)'
      const setOffline = async (on) => {
        const r = await fetch('/api/settings', {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ features: { ...before, offline: on } }),
        })
        if (!r.ok) return 'PUT /api/settings -> ' + r.status
        return ''
      }
      const pages = async () => (await caches.keys()).filter((n) => n.startsWith('quire-pages-'))
      const cached = async (path) => {
        for (const name of await pages()) {
          if (await (await caches.open(name)).match(path)) return true
        }
        return false
      }

      try {
        const bad = await setOffline(true)
        if (bad) return bad

        if ((await view())?.features?.offline !== true) return 'the setting did not stick'

        // \`no-store\`, because this page was just navigated to and the same URL sits in the
        // browser's own memory cache: without it the read comes back from before the PUT.
        // The page NAMES the worker; nothing here invents the URL.
        const html = await (await fetch('/', { cache: 'no-store' })).text()
        const src = /data-sw="([^"]+)"/.exec(html)?.[1]
        if (!src) return 'the page carries no data-sw with the feature on'

        await navigator.serviceWorker.register(src.replace(/&amp;/g, '&'))
        await navigator.serviceWorker.ready
        // \`clients.claim()\` takes over THIS page, which was loaded before the worker
        // existed. Without it nothing below would be intercepted at all.
        for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) {
          await new Promise((r) => setTimeout(r, 100))
        }
        if (!navigator.serviceWorker.controller) return 'the worker never took control'

        const feed = await (await fetch('/feed.xml')).text()
        // Skipping '/': the FIRST <link> in an RSS document is the channel's, which is the
        // site root. Without the filter this proved the home page was kept and said "post".
        const post = [...feed.matchAll(/<link>([^<]+)<\\/link>/g)]
          .map((m) => new URL(m[1]).pathname).find((p) => p !== '/')
        if (!post) return 'the feed listed no post'
        // An IFRAME, not \`fetch\`, and that is the whole point of doing this in a browser: a
        // page is cached because it was NAVIGATED to. A same-origin \`fetch\` carries
        // \`accept: */*\` and mode \`cors\`, so the worker rightly leaves it alone — and a
        // flow written with \`fetch\` would have proved a path no reader takes.
        const read = async (path) => new Promise((done) => {
          const frame = document.createElement('iframe')
          frame.style.display = 'none'
          frame.src = path
          frame.onload = () => { frame.remove(); done() }
          setTimeout(() => { frame.remove(); done() }, 5000)
          document.body.appendChild(frame)
        })
        await read(post)
        await read('/admin')
        // The loads have finished, but \`cache.put\` runs after the response reached the page.
        for (let i = 0; i < 40 && !(await cached(post)); i++) {
          await new Promise((r) => setTimeout(r, 100))
        }
        if (!(await cached(post))) return post + ' was read and not kept'
        if (await cached('/admin')) return 'the admin was cached, which it may never be'

        const off = await setOffline(false)
        if (off) return off
        // What the island does on the next page load, run here: this asserts the ROUTE
        // back out exists and empties, which is the half a reader depends on.
        for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
        for (const n of await caches.keys()) if (n.startsWith('quire-')) await caches.delete(n)
        if ((await pages()).length) return 'a quire cache survived the uninstall'
        return 'ok (kept ' + post + ', refused /admin)'
      } finally {
        await fetch('/api/settings', {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ features: before }),
        })
      }
    })()`, 2000))

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
  registerStatsFlows({ flow, expect, atWidth })
}
