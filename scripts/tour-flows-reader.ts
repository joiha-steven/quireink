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
}
