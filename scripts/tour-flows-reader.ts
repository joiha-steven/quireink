// Flows for the reader's side, from the 2026-09-30 sweep (phase 5 of the fix list). One flow
// per fault, named for what must hold.
import type { Tour } from './tour'

/** A function `select()` that selects a run of plain words and waits for the pen bar. */
const SELECT_PLAIN = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const select = async () => {
    const walk = document.createTreeWalker(document.querySelector('.prose'), NodeFilter.SHOW_TEXT)
    let text = null
    while (walk.nextNode()) {
      const n = walk.currentNode
      if (n.parentElement.tagName === 'P' && n.data.trim().length > 60) { text = n; break }
    }
    text.parentElement.scrollIntoView({ block: 'center' })
    const range = document.createRange()
    range.setStart(text, 2); range.setEnd(text, 40)
    getSelection().removeAllRanges(); getSelection().addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    await sleep(500)
  }`

/** Select a run of plain words in the first long paragraph and let the pen bar answer. */
const SELECT = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const walk = document.createTreeWalker(document.querySelector('.prose'), NodeFilter.SHOW_TEXT)
  let text = null
  while (walk.nextNode()) {
    const n = walk.currentNode
    if (n.parentElement.tagName === 'P' && n.data.trim().length > 60) { text = n; break }
  }
  if (!text) return 'no run of words to mark'
  text.parentElement.scrollIntoView({ block: 'center' })
  const range = document.createRange()
  range.setStart(text, 2); range.setEnd(text, 40)
  getSelection().removeAllRanges(); getSelection().addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
  await sleep(500)
  const bar = document.querySelector('.pen-bar')
  if (!bar || bar.hidden) return 'the pen bar did not appear'`

export function registerReaderFlows({ flow, expect, atWidth }: Tour): void {
  // Nine keys in one pill were 457px on a 390px phone, at x = -75, three inks off the edge.
  for (const width of [390, 320]) {
    flow(`reader: the pen bar fits a ${width}px phone`, () => atWidth(width, '/kerning-is-not-tracking', `
      (async () => {
        ${SELECT}
        const r = bar.getBoundingClientRect()
        const vw = document.documentElement.clientWidth
        getSelection().removeAllRanges()
        if (r.left < 0 || r.right > vw) return 'the bar runs off the screen: ' + Math.round(r.left) + '..' + Math.round(r.right) + ' of ' + vw
        // The 44px targets are a touch screen's (@media (hover: none)). This emulation does
        // not match that query, so where it does not, the rule itself is what is checked.
        if (!matchMedia('(hover: none)').matches) {
          const css = [...document.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules] } catch { return [] } })
            .map((r) => r.cssText).join('\\n')
          return /@media \\(hover: ?none\\)[^@]*\\.pen-bar button\\s*\\{[^}]*min-height: 44px/.test(css) ? 'ok' : 'no 44px touch rule for the pen bar'
        }
        const small = [...bar.querySelectorAll('button')].filter((b) => {
          const s = getComputedStyle(b, '::after')
          const box = b.getBoundingClientRect()
          // A swatch's hit area is its ::after, which reaches past the small circle.
          const pad = s.content !== 'none' && s.content !== 'normal' ? -2 * parseFloat(s.top) : 0
          return box.height + pad < 44
        })
        return small.length ? small.length + ' key(s) under 44px tall' : 'ok'
      })()`, 800))
  }

  // A 300-letter URL or a long word in a title widened the page: 3436px at 1280, zoomed out at 390.
  const LONG = 'tour-a-very-long-word'
  const word = 'Donaudampfschifffahrtselektrizitaetenhauptbetriebswerkbauunterbeamtengesellschaft'
  flow('reader: a post with words too long for any column', () => atWidth(1440, '/admin', `
    (async () => {
      const url = 'https://example.com/' + 'a'.repeat(300)
      const r = await fetch('/api/posts', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Tour ${word}', slug: '${LONG}', status: 'published',
          date: '2020-01-01T00:00:00.000Z', content: 'See ' + url + ' and ${word} in a sentence.' }) })
      return r.ok ? 'ok' : 'could not create it: ' + r.status
    })()`))
  for (const [width, path] of [[390, `/${LONG}`], [1280, `/${LONG}`], [390, '/'], [390, `/search?q=${'x'.repeat(300)}`]] as const) {
    flow(`reader: nothing runs off a ${width}px page at ${path.slice(0, 24)}`, () => atWidth(width, path, `
      (() => {
        const over = document.documentElement.scrollWidth - document.documentElement.clientWidth
        return over > 1 ? 'the page is ' + over + 'px wider than the screen' : 'ok'
      })()`, 600))
  }
  flow('reader: the long-word post goes', () => atWidth(1440, '/admin', `
    (async () => {
      await fetch('/api/posts/${LONG}', { method: 'DELETE' })
      await fetch('/api/trash', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'posts', action: 'purge', ids: ['${LONG}'] }) })
      return 'ok'
    })()`))

  // Book mode, two keyboard faults (2026-09-30): Space on a focused button turned the page, and
  // tabbing into a later column scrolled the window under the pages while the counter stayed.
  flow('reader: in book mode, Space on a button is the button\'s, and focus turns the page', () => expect('/the-reed-pen-in-van-goghs-letters', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const open = document.querySelector('.book-fab') || document.querySelector('[data-book-open]')
      if (!open) return 'book mode is off on this page'
      open.click()
      await sleep(800)
      const d = document.querySelector('.book-overlay[open]')
      if (!d) return 'the book overlay did not open'
      const count = () => d.querySelector('.book-count').textContent
      const before = count()
      const x = d.querySelector('.book-x')
      x.focus()
      x.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
      await sleep(300)
      if (count() !== before) { x.click(); return 'Space on Close turned the page: ' + before + ' -> ' + count() }
      const viewport = d.querySelector('.book-viewport')
      const edge = viewport.getBoundingClientRect().right
      const later = [...d.querySelectorAll('.book-flow a[href]')].find((a) => a.getBoundingClientRect().left > edge + 10)
      if (!later) { x.click(); return 'no link past the first spread to focus' }
      later.focus()
      await sleep(500)
      const shown = later.getBoundingClientRect()
      const box = viewport.getBoundingClientRect()
      const verdict = viewport.scrollLeft !== 0 ? 'the window scrolled under the pages (' + viewport.scrollLeft + ')'
        : count() === before ? 'focus moved on and the counter stayed at ' + before
        : shown.left < box.left - 1 || shown.right > box.right + 1 ? 'the focused link is not on the spread shown'
        : 'ok'
      x.click()
      return verdict
    })()`, 900))

  // The phone's drawer (2026-09-30): a Contents entry scrolled to its heading and left the drawer
  // over it, and Tab past the last link went on into the page behind.
  flow('reader: the phone drawer closes on a Contents entry and keeps focus while open', () => atWidth(390, '/a-type-scale-you-can-defend', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const button = document.querySelector('[data-rail-toggle]')
      if (!button || button.hidden) return 'no drawer on this page'
      button.click()
      await sleep(300)
      if (document.documentElement.dataset.rail !== 'open') return 'the drawer did not open'
      const rails = document.querySelectorAll('.rail')
      const rail = rails[rails.length - 1]
      const links = [...rail.querySelectorAll('a[href]')].filter((a) => a.offsetParent !== null)
      const last = links[links.length - 1]
      last.focus()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
      await sleep(100)
      // A synthetic Tab moves nothing by itself, so the wrap has to be the drawer's own doing.
      if (document.activeElement === last || !rail.contains(document.activeElement)) return 'Tab from the last link did not wrap inside the drawer'
      const entry = links.find((a) => (a.getAttribute('href') || '').startsWith('#'))
      if (!entry) return 'no Contents entry in the drawer'
      entry.click()
      await sleep(400)
      return document.documentElement.dataset.rail === 'open' ? 'the drawer stayed open over the heading' : 'ok'
    })()`, 800))

  // A new device had no way in to a notebook without a throwaway mark, and the notebook it
  // then adopted dropped that mark (2026-09-30).
  flow('reader: a notebook code can be entered with no mark yet, and keeps what is here', () => expect('/kerning-is-not-tracking', `
    (async () => {
      ${SELECT_PLAIN}
      const store = 'quire:pen:' + location.pathname
      localStorage.removeItem(store); localStorage.removeItem('quire:pen:keep')
      // Somewhere else, a notebook with one mark on this page.
      const code = (await (await fetch('/api/pen/code', { method: 'POST' })).json()).data.code
      const there = { id: 'elsewhere', exact: 'tracking', prefix: '', suffix: '', kind: 'hl', ink: '', note: '', t: 1 }
      await fetch('/api/pen?path=' + encodeURIComponent(location.pathname), { method: 'PUT',
        headers: { 'x-quire-pen': code }, body: JSON.stringify({ items: [there] }) })
      location.hash = ''
      await select()
      const bar = document.querySelector('.pen-bar')
      const keepKey = bar && bar.querySelector('.pen-k')
      if (!keepKey || keepKey.hidden) return 'no way in to a notebook on a page with no marks'
      // A mark made here first, then the code: both must survive.
      bar.querySelector('.pen-swatch').click()
      await sleep(600)
      const mine = JSON.parse(localStorage.getItem(store) || '{"items":[]}').items || []
      if (mine.length !== 1) return 'the mark made here was not kept: ' + mine.length
      await select()
      if (!bar.querySelector('.pen-k').hidden) return 'the way in stayed once this page had a mark'
      getSelection().removeAllRanges()
      document.querySelector('.prose [data-reader]').click()
      await sleep(300)
      const pop = document.querySelector('.pen-pop')
      pop.querySelector('.pen-keep button').click()
      const input = [...pop.querySelectorAll('.pen-keep input')].pop()
      input.value = code
      const use = [...pop.querySelectorAll('.pen-keep button')].find((b) => b.textContent === ${JSON.stringify('')} || b.previousElementSibling === input)
      use.click()
      await sleep(1500)
      const both = (JSON.parse(localStorage.getItem(store) || '{"items":[]}').items || []).map((a) => a.id)
      localStorage.removeItem(store); localStorage.removeItem('quire:pen:keep')
      await fetch('/api/pen', { method: 'DELETE', headers: { 'x-quire-pen': code } })
      return both.includes('elsewhere') && both.includes(mine[0].id) ? 'ok' : 'after the code, this page holds ' + JSON.stringify(both)
    })()`, 900))

  // Selecting the reader's own note raised the whole bar, and an ink pressed there made nothing.
  flow('reader: the pen bar stays off the reader\'s own note', () => expect('/kerning-is-not-tracking', `
    (async () => {
      ${SELECT_PLAIN}
      const store = 'quire:pen:' + location.pathname
      localStorage.removeItem(store)
      await select()
      const bar = document.querySelector('.pen-bar')
      bar.querySelector('.pen-n').click()
      const pop = document.querySelector('.pen-pop')
      for (let i = 0; i < 40 && pop.hidden; i++) await sleep(50)
      const area = pop.querySelector('textarea')
      area.value = 'a note long enough to select inside of'
      area.dispatchEvent(new Event('input', { bubbles: true }))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await sleep(400)
      const card = document.querySelector('.pen-note')
      if (!card) { localStorage.removeItem(store); return 'no note card to select inside' }
      const walk = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
      let text = null
      while (walk.nextNode()) if (walk.currentNode.data.length > 20) { text = walk.currentNode; break }
      const range = document.createRange()
      range.setStart(text, 0); range.setEnd(text, 20)
      getSelection().removeAllRanges(); getSelection().addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
      await sleep(500)
      const shown = !bar.hidden
      getSelection().removeAllRanges()
      localStorage.removeItem(store)
      return shown ? 'the pen bar rose over the reader’s own note' : 'ok'
    })()`, 900))

  // A right-aligned column stays right-aligned on the public page (FIXLIST 7.1). The cell carried
  // align="right" and the prose sheet's text-align:left beat it, so the numbers stopped lining up.
  flow('reader: a table column keeps the alignment its delimiter row declares', () => expect('/what-a-subsetter-removes', `
    (() => {
      const cell = document.querySelector('.prose td[align=right]')
      if (!cell) return 'the post has no right-aligned cell to measure'
      const said = getComputedStyle(cell).textAlign
      if (said !== 'right') return 'a right-aligned column renders ' + said
      const plain = document.querySelector('.prose td:not([align])')
      if (plain && getComputedStyle(plain).textAlign === 'right') return 'an unaligned cell turned right too'
      return 'ok'
    })()`, 500))

  // A SHORT POST starts level with the two rails at desktop width (FIXLIST 7.2). Its empty
  // header held the body 40px lower than both. Two visits: plant it, then read it.
  const SHORT = 'tour-short-post'
  flow('reader: plant a short post with no title', () => expect('/admin/editor', `
    (async () => {
      await fetch('/api/posts/${SHORT}', { method: 'DELETE' })
      const r = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: '', slug: '${SHORT}', content: 'A short one, with no headline at all.', status: 'published', categories: [], tags: [] }),
      })
      const made = await r.json().catch(() => null)
      const page = await fetch('/')
      return r.ok ? 'ok ' + JSON.stringify(made?.data?.slug ?? made?.data?.post?.slug) + ' ' + page.status : 'POST /api/posts -> ' + r.status
    })()`, 600))
  flow('reader: a short post starts level with both rails', () => expect(`/${SHORT}`, `
    (async () => {
      const first = document.querySelector('#post-body > *')
      const rail = document.querySelector('.rail-toc .rail-inner > *')
      const info = document.querySelector('.post-info > *')
      const top = (el) => el ? Math.round(el.getBoundingClientRect().top) : null
      const got = [top(first), top(rail), top(info)]
      await fetch('/api/posts/${SHORT}', { method: 'DELETE' })
      if (got[0] === null) return 'the short post has no body'
      const off = got.slice(1).filter((y) => y !== null).map((y) => Math.abs(y - got[0]))
      if (!off.length) return 'no rail beside the post to line up with'
      return Math.max(...off) <= 8 ? 'ok ' + got.join('/') : 'the body starts off the rails: ' + got.join('/')
    })()`, 600))

  // Every coloured token in a code block clears 4.5:1 on the panel it sits on, light and dark
  // (FIXLIST 7.3). Measured in the browser, from the colours it actually painted.
  const INKED = 'tour-code-ink'
  flow('reader: plant a post with code in it', () => expect('/admin/editor', `
    (async () => {
      await fetch('/api/posts/${INKED}', { method: 'DELETE' })
      const fence = String.fromCharCode(96).repeat(3)
      const body = fence + 'ts\\n// a note\\nconst quote = "text" + 1 // the rest\\nexport function go(a: number): string { return String(a) }\\n' + fence
      const r = await fetch('/api/posts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Code ink', slug: '${INKED}', content: body, status: 'published', categories: [], tags: [] }),
      })
      return r.ok ? 'ok' : 'POST /api/posts -> ' + r.status
    })()`, 600))
  flow('reader: every code token clears 4.5:1, light and dark', () => expect(`/${INKED}`, `
    (async () => {
      // color-mix() computes to color(srgb 0-1 ...), a plain colour to rgb(0-255 ...).
      const rgb = (s) => (s.match(/[\\d.]+/g) || []).slice(0, 3).map(Number).map((v) => s.startsWith('color(') ? v * 255 : v)
      const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
      const pre = document.querySelector('.prose pre.shiki')
      if (!pre) return 'the code block was not highlighted'
      const measure = () => {
        const bg = rgb(getComputedStyle(pre).backgroundColor)
        const spans = [...pre.querySelectorAll('.line span')].filter((s) => s.textContent.trim())
        const all = spans.map((s) => [ratio(rgb(getComputedStyle(s).color), bg), s.textContent.trim()])
        all.sort((a, b) => a[0] - b[0])
        window.__worst = (window.__worst || '') + ' | ' + all[0][1]
        return all[0][0]
      }
      const lightLow = measure()
      const root = document.documentElement
      const was = root.classList.contains('dark')
      root.classList.add('dark')
      await new Promise((r) => setTimeout(r, 50))
      const darkLow = measure()
      if (!was) root.classList.remove('dark')
      await fetch('/api/posts/${INKED}', { method: 'DELETE' })
      const say = lightLow.toFixed(2) + ' / ' + darkLow.toFixed(2)
      return lightLow >= 4.5 && darkLow >= 4.5 ? 'ok ' + say : 'a token under 4.5:1 (light / dark): ' + say + window.__worst
    })()`, 600))

  // At the end of a post on a phone, the floating keys stand clear of the footer's words
  // (FIXLIST 7.4). Measured on the glyphs, not the footer's box.
  flow('reader: the floating keys leave the footer readable on a phone', () => atWidth(390, '/what-a-subsetter-removes', `
    (async () => {
      // Pictures load as the page scrolls and the page grows, so scroll until the end stays put.
      for (let i = 0, was = -1; i < 20 && was !== document.documentElement.scrollHeight; i++) {
        was = document.documentElement.scrollHeight
        scrollTo(0, was)
        await new Promise((r) => setTimeout(r, 300))
      }
      const foot = document.querySelector('footer.site')
      if (!foot) return 'no footer'
      const range = document.createRange()
      range.selectNodeContents(foot)
      const words = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
      const keys = [...document.querySelectorAll('.to-top, .book-fab')]
        .filter((k) => getComputedStyle(k).display !== 'none' && getComputedStyle(k).visibility !== 'hidden')
        .map((k) => k.getBoundingClientRect())
      const hit = words.some((w) => keys.some((k) => w.left < k.right && k.left < w.right && w.top < k.bottom && k.top < w.bottom))
      return hit ? 'a floating key covers the footer words' : 'ok (' + keys.length + ' keys)'
    })()`, 600))

  // On a touch screen the copy key always shows, so every block keeps a band above its first
  // line for it (FIXLIST 7.4). The tour cannot emulate hover:none, so the rule is read out of
  // the sheet, applied, and the geometry measured with it.
  flow('reader: the copy key sits above the code on a touch screen, not on it', () => expect('/what-a-subsetter-removes', `
    (async () => {
      const rules = [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules] } catch { return [] } })
      const touch = rules.filter((r) => r.media && /hover:\\s*none/.test(r.conditionText || r.media.mediaText))
        .flatMap((r) => [...r.cssRules]).find((r) => r.selectorText === '.prose pre' && r.style.paddingTop)
      if (!touch) return 'no touch-screen band for the copy key in the sheet'
      const pre = document.querySelector('.prose pre')
      if (!pre) return 'no code block on the page'
      for (let i = 0; i < 20 && !pre.querySelector('.code-copy'); i++) await new Promise((r) => setTimeout(r, 100))
      const key = pre.querySelector('.code-copy')
      if (!key) return 'no copy key was added'
      pre.style.paddingTop = touch.style.paddingTop
      key.style.opacity = '1'
      const first = (pre.querySelector('.line') || pre.querySelector('code')).getBoundingClientRect()
      const k = key.getBoundingClientRect()
      pre.style.paddingTop = ''
      key.style.opacity = ''
      return k.bottom <= first.top + 1 ? 'ok' : 'the copy key reaches ' + Math.round(k.bottom - first.top) + 'px into the first line'
    })()`, 600))

  // A tag is one token in the info panel's narrow column: "mixed-script" broke after its
  // hyphen (FIXLIST 7.5). Every term link sits on one line.
  flow('reader: no tag breaks at its own hyphen in the info panel', () => expect('/zimian-yu-zishen', `
    (() => {
      const links = [...document.querySelectorAll('.post-info .term-list a')]
      if (!links.length) return 'the info panel shows no terms'
      const split = links.filter((a) => a.getClientRects().length > 1).map((a) => a.textContent)
      return split.length ? 'broken across lines: ' + split.join(', ') : 'ok (' + links.length + ' terms)'
    })()`, 500))
}
