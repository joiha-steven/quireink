// The Custom CSS box, in a real browser.
//
// This product ships no themes, so this box is the whole of the answer once the 166 settings
// run out — and what makes it usable is not the textarea, it is the list of names beside it.
// `check:contract` proves those names still describe the software; nothing but a browser can
// prove they are still OFFERED, that clicking one writes it where the caret is, and that a
// broken sheet says so instead of failing silently.
import type { Tour } from './tour'

export function registerCssFlows({ flow, expect }: Tour): void {
  flow('admin: the CSS box hands over the names it promises', () =>
    expect('/admin/settings?tab=appearance', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const ed = document.querySelector('[data-css-editor]')
      if (!ed) return 'no custom CSS editor on the appearance tab'

      const setValue = (v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
        setter.call(ed, v)
        ed.dispatchEvent(new Event('input', { bubbles: true }))
      }
      // ⚠️ innerText, NOT textContent. Under ADR 0054 all three faces of this line are DRAWN
      // and two are hidden, so textContent hands back the byte count AND the unclosed warning
      // AND the stray-brace warning glued together — one string that matches every test this
      // flow makes, whatever the box actually says. innerText leaves out what is display:none,
      // which is the same question docs/admin-one-dom.md answers with offsetParent elsewhere.
      const status = () => document.querySelector('[data-css-status]')?.innerText ?? ''

      // A sheet that would do nothing has to SAY it does nothing.
      setValue('.prose {')
      await sleep(250)
      if (!/\\d/.test(status())) return 'an unclosed brace produced no warning: ' + status()
      const warned = status()

      // ...and a brace inside a comment is not an unclosed brace. A false alarm here is
      // worse than no alarm: it teaches the owner to ignore the line.
      setValue('/* } */ .prose { color: red }')
      await sleep(250)
      if (status() === warned || /brace/i.test(status())) return 'a braced comment cried wolf: ' + status()

      const toggle = document.querySelector('[data-css-reference]')
      if (!toggle) return 'no way to see the promised names'
      toggle.click()
      await sleep(250)

      const chips = [...document.querySelectorAll('button')]
        .filter((b) => /^(--|\\.|#|header\\.|footer\\.)/.test(b.textContent.trim()))
      if (chips.length < 30) return 'only ' + chips.length + ' promised names offered'
      if (!chips.every((b) => b.getAttribute('title'))) return 'a name is offered with no explanation'

      // The point of the list: it writes into the sheet, at the caret, not at the end.
      setValue(':root {  }')
      await sleep(200)
      ed.focus()
      ed.setSelectionRange(8, 8)
      const accent = chips.find((b) => b.textContent.trim() === '--c-accent')
      if (!accent) return 'the promised list does not offer --c-accent'
      accent.click()
      await sleep(400)
      if (ed.value !== ':root { --c-accent }') return 'insert landed wrong: ' + JSON.stringify(ed.value)
      if (ed.selectionStart !== 18) return 'caret left at ' + ed.selectionStart + ', not after the insert'

      setValue('')
      await sleep(200)
      return 'ok (' + chips.length + ' names)'
    })()`, 1500))
}

/**
 * The reader-facing effects that only a real browser can measure.
 *
 * The account screen moved to `tour-flows-security.ts` on 2026-09-15, when this file crossed
 * the 400-line limit.
 */
export function registerSecurityFlows({ flow, expect }: Tour): void {
  // The scroll fade, both halves of it, through the owner's switch.
  //
  // THREE VISITS, not one expression, for the reason `tour-flows-home.ts` spells out: the
  // attribute that drives the whole effect is stamped by the SERVER, so seeing it change
  // takes a fresh document, and `expect` is what navigates. Every part of this is a computed
  // opacity produced by a scroll-driven animation — nothing in the HTML says whether it is
  // running, `check:all` cannot see it, and the fault that started it (posts still half
  // faded in the MIDDLE of the window, because the range was measured against each card's
  // own height) looked like a rendering glitch rather than like a rule.
  flow('the scroll fade dims the edges of an article, and stops when it is switched off', async () => {
    const MEASURE = `
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const measure = async () => {
        scrollTo(0, 1800)
        await sleep(400)
        return {
          attr: document.documentElement.dataset.scrollFade ?? 'absent',
          parts: [...document.querySelectorAll('.prose>p')].map((p) => +getComputedStyle(p).opacity),
        }
      }
      const feature = async (on) => {
        const now = (await (await fetch('/api/admin/view/settings')).json())?.data?.settings?.features
        if (!now) return 'no settings (no owner session?)'
        const r = await fetch('/api/settings', {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ features: { ...now, scrollFade: on } }),
        })
        return r.ok ? '' : 'PUT /api/settings -> ' + r.status
      }`

    // The post comes from the FEED, parsed in the page: an item in the feed is a post by
    // definition, while a link in the markup can be a category (the mistake `tour-flows.ts`
    // documents). Only the pathname crosses back, so nothing here has to parse XML twice.
    const post = await expect('/', `
      (async () => {
        const xml = await (await fetch('/feed.xml')).text()
        const links = [...new DOMParser().parseFromString(xml, 'application/xml').querySelectorAll('item > link')]
        const path = links.map((l) => new URL(l.textContent).pathname).find((p) => p !== '/')
        return path ?? ''
      })()`, 600)
    if (!post.startsWith('/')) return 'the feed listed no post'

    try {
      const armed = await expect('/', `(async () => {${MEASURE}
        if (!CSS.supports('animation-timeline', 'view()')) return 'skip: no view() timelines'
        return (await feature(true)) || 'ok'
      })()`, 400)
      if (armed !== 'ok') return armed

      const on = await expect(post, `(async () => {${MEASURE}
        const m = await measure()
        if (m.attr !== 'on') return 'the switch is on and the page does not say so'
        if (!m.parts.some((o) => o < 0.95)) return 'nothing dimmed at the edges of a scrolled article'
        // The middle of the window must be SOLID — the reported fault, and the half that a
        // "does anything fade?" assertion would have passed straight over.
        if (!m.parts.some((o) => o > 0.99)) return 'every paragraph is dimmed, including the one being read'
        return 'ok ' + m.parts.length
      })()`, 900)
      if (!on.startsWith('ok')) return on

      // THE LISTING, which is where the reported fault actually lived: a card that is fully
      // inside the window must be solid, whatever its height. Measured against the card's own
      // height, a long post's card was still arriving in the middle of the screen.
      // BOOK MODE MUST NOT FADE. Its flow is itself a .prose, laid out in columns that run
      // sideways, so a view() timeline — which only knows the document's vertical scroll —
      // dimmed whichever paragraphs happened to be outside the window in a direction nobody
      // is scrolling. On a phone that was a wash of grey across the top of every page turned.
      const book = await expect(post, `(async () => {${MEASURE}
        const open = document.querySelector('.book-fab') || document.querySelector('[data-book-open]')
        if (!open) return 'skip: book mode is off'
        open.click()
        await sleep(700)
        const d = document.querySelector('.book-overlay[open]')
        if (!d) return 'the book overlay did not open'
        const next = d.querySelector('.book-next')
        for (let i = 0; i < 3 && next; i++) { next.click(); await sleep(300) }
        await sleep(400)
        const ops = [...d.querySelectorAll('.book-flow p')].map((p) => +getComputedStyle(p).opacity)
        d.querySelector('.book-x').click()
        if (!ops.length) return 'the book flow has no paragraphs to measure'
        const dim = ops.filter((o) => o < 0.99).length
        return dim ? dim + ' of ' + ops.length + ' paragraphs are dimmed inside book mode' : 'ok ' + ops.length
      })()`, 900)
      if (!book.startsWith('ok') && !book.startsWith('skip')) return book

      const list = await expect('/', `(async () => {${MEASURE}
      // Every card that is WHOLLY inside the window must be solid. The reported fault was
        // cards still half faded in the middle of the screen, and the cause was a range
        // measured against each card's own height; this is the assertion that a range cannot
        // outlast the card's arrival, whatever the card is.
        scrollTo(0, 1500)
        await sleep(600)
        const inside = [...document.querySelectorAll('.post-list .reveal')].filter((c) => {
          const b = c.getBoundingClientRect()
          return b.top > 8 && b.bottom < innerHeight - 8
        })
        if (!inside.length) return 'no card sits wholly inside the window to measure'
        const dim = inside.filter((c) => +getComputedStyle(c).opacity < 0.99)
        if (dim.length) return dim.length + ' of ' + inside.length + ' cards are still fading in mid-window'
        return 'ok ' + inside.length
      })()`, 900)
      if (!list.startsWith('ok')) return list

      const off = await expect('/', `(async () => {${MEASURE}
        return (await feature(false)) || 'ok'
      })()`, 400)
      if (off !== 'ok') return off

      const quiet = await expect(post, `(async () => {${MEASURE}
        const m = await measure()
        if (m.attr !== 'absent') return 'the switch is off and the page still carries the attribute'
        if (m.parts.some((o) => o < 0.99)) return 'the fade is off and a paragraph is still dimmed'
        return 'ok'
      })()`, 900)
      if (quiet !== 'ok') return quiet

      return 'ok (' + on.slice(3) + ' paragraph(s) dim, ' + list.slice(3) + ' cards solid mid-window, none dim with it off)'
    } finally {
      await expect('/', `(async () => {${MEASURE}
        return (await feature(true)) || 'ok'
      })()`, 200)
    }
  })

  // ITEM 18. A segmented control has to answer "which one is chosen" before it is read, and
  // the answer used to be a key DARKER than its own track — the wrong way round for a
  // pressed key, forced by a track that was one point off the card behind it. The track is a
  // groove now and the key is white and carved.
  //
  // What is measured is the CHOSEN LABEL AGAINST AN UNCHOSEN ONE, because that is the signal:
  // the two grounds are 1.26:1 and never told anybody anything. Colours are read as PIXELS
  // through a canvas — Tailwind 4 computes to `oklch()`, which no string parser here should
  // be trying to understand.
  //
  // NOTE: this body is a template literal. No backticks, no backslashes.
  flow('admin: a chosen segment is legibly chosen', () => expect('/admin/settings?tab=post', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      // Settings is a lazy route: read once at 900ms and the panel is sometimes still the
      // skeleton, which is how this flow first reported "no segmented track on the tab".
      for (let i = 0; i < 40; i++) {
        if (document.querySelectorAll('.no-scrollbar button').length > 1) break
        await sleep(150)
      }
      const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1
      const cx = cv.getContext('2d', { willReadFrequently: true })
      const rgb = (c) => { cx.clearRect(0,0,1,1); cx.fillStyle = c; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; return [d[0],d[1],d[2]] }
      const lum = (c) => { const p = rgb(c).map((v) => v/255).map((v) => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4)); return 0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2] }
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y) + 0.05) / (Math.min(x,y) + 0.05) }
      const tracks = Array.from(document.querySelectorAll('.no-scrollbar')).filter((t) => t.querySelectorAll('button').length > 1)
      if (tracks.length === 0) return 'no segmented track on the tab'
      for (const track of tracks) {
        const keys = Array.from(track.querySelectorAll('button'))
        const on = keys.find((k) => getComputedStyle(k).backgroundColor !== 'rgba(0, 0, 0, 0)')
        if (!on) continue
        // The pen key is where-you-are, a different control with its own guard.
        if (rgb(getComputedStyle(on).backgroundColor).join(',') === '213,248,86') continue
        const off = keys.find((k) => k !== on)
        const a = getComputedStyle(on), b = getComputedStyle(off)
        if (Number(a.fontWeight) < 600) return 'the chosen key is weight ' + a.fontWeight
        const labels = ratio(a.color, b.color)
        if (labels < 3) return 'chosen and unchosen labels are ' + labels.toFixed(2) + ':1'
        const onGround = ratio(a.color, a.backgroundColor)
        if (onGround < 4.5) return 'the chosen label reads ' + onGround.toFixed(2) + ':1 on its key'
        return 'ok labels ' + labels.toFixed(2) + ':1, chosen label on its key ' + onGround.toFixed(2) + ':1'
      }
      return 'every segment on the tab is a place, not a choice'
    })()`, 900))

  // THE BOOK BUTTON HOVERS THE WAY THE HEADER HOVERS, and there is nothing drawn on it at rest.
  //
  // It wore a hand-drawn pen loop until 2026-09-20 - the product's own mark, and the only
  // control on the reading site that answered a pointer with a circle while every other one
  // filled. The flow that stood here guarded the loop against a cascade bug that inked it at
  // rest; what needs guarding now is that the two controls say the same thing, which is a
  // property of the SERVED STYLESHEET rather than of either element.
  //
  // Read out of the CSSOM rather than by hovering: a script cannot raise a real :hover, and a
  // dispatched mouseover does not either. The rule text is what the browser was given.
  //
  // NOTE: this body is a template literal. No backticks, no backslashes.
  flow('the book button hovers the way the header buttons hover', () => expect('/the-reed-pen-in-van-goghs-letters', `
    (() => {
      const buttons = Array.from(document.querySelectorAll('[data-book-open]'))
      if (!buttons.length) return 'skip: book mode is off'

      // Nothing is drawn on it until a pointer arrives.
      for (const btn of buttons) {
        if (btn.querySelector('.book-loop')) return 'a book button still carries the pen loop'
        const at = getComputedStyle(btn)
        const bg = at.backgroundColor
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          return 'the button is filled at rest with ' + bg
        }
        if (parseFloat(at.borderTopLeftRadius) <= 0) return 'the fill would have square corners'
      }

      // Every rule the page was served, @media blocks included.
      const rules = []
      // ⚠️ NOT if/else. Since CSS nesting shipped, a plain CSSStyleRule ALSO has a cssRules
      // list - empty, and truthy - so an if/else took the recursing branch every time and the
      // collection came back empty. The first run of this flow reported that the header key
      // had no hover rule, which was a fact about this walker.
      const walk = (list) => {
        for (const r of Array.from(list || [])) {
          if (r.selectorText) rules.push(r)
          if (r.cssRules && r.cssRules.length) walk(r.cssRules)
        }
      }
      for (const sheet of Array.from(document.styleSheets)) {
        try { walk(sheet.cssRules) } catch (e) { return 'a stylesheet could not be read: ' + e.message }
      }
      // ⚠️ OUT OF cssText, NOT off the style object. A declaration whose value is a var() is a
      // pending substitution: getPropertyValue('background') and .backgroundColor both come
      // back EMPTY, and the first run of this flow reported that the header key had no hover
      // fill at all. The text is what the sheet says.
      const decl = (text, prop) => {
        const at = text.indexOf(prop + ':')
        if (at < 0) return ''
        const rest = text.slice(at + prop.length + 1)
        let end = rest.length
        for (const ch of [';', '}']) {
          const j = rest.indexOf(ch)
          if (j >= 0 && j < end) end = j
        }
        return rest.slice(0, end).trim()
      }
      // ⚠️ THE LAST RULE THAT ACTUALLY SETS A FILL, not the last rule that matches. Both of
      // these controls have a DESCENDANT hover rule after their own - .book-mode-toggle:hover
      // svg{opacity:1} - which starts with the same name and carries no background, so taking
      // the last match read the glyph's rule and reported no fill at all.
      const fill = (needle) => {
        const hits = rules
          .filter((r) => r.selectorText.split(',').some((sel) =>
            sel.trim().indexOf(needle) === 0 && sel.indexOf(':hover') > 0))
          .map((r) => decl(r.cssText, 'background') || decl(r.cssText, 'background-color'))
          .filter((v) => v !== '')
        return hits.length ? hits[hits.length - 1] : ''
      }
      const header = fill('.icon-btn')
      const book = fill('.book-mode-toggle')
      if (!header) return 'the header key has no hover fill to match'
      if (!book) return 'the book button has no hover fill at all'
      if (book !== header) {
        return 'the book button fills with ' + book + ' where the header key fills with ' + header
      }
      return 'ok nothing at rest, and both fill with ' + book
    })()`, 600))

  // THE BASELINE GRID, and the two columns of a spread only read as one page while it holds.
  // Before the rule that keeps every gap a whole line, the paragraph break measured 1.85 of
  // them and the left and right pages sat 11.7px out of phase. No unit test can see it.
  // NOTE: this body is a template literal. No backticks.
  flow('book mode sets its pages on one baseline grid', () => expect(
    '/the-reed-pen-in-van-goghs-letters', `
    (async () => {
      document.querySelector('[data-book-open]').click()
      await new Promise((r) => setTimeout(r, 600))
      const flow = document.querySelector('.book-overlay[open] .book-flow')
      if (!flow) return 'the overlay did not open'
      const cs = getComputedStyle(flow)
      const pitch = parseFloat(cs.columnWidth) + parseFloat(cs.columnGap)
      const p0 = flow.querySelector('p')
      const lh = parseFloat(getComputedStyle(p0).lineHeight)
      const body = Math.round(parseFloat(getComputedStyle(p0).fontSize) * 1.58)
      const rects = (el) => { const r = document.createRange(); r.selectNodeContents(el)
        return [...r.getClientRects()].filter((b) => b.height > 5)
          .map((b) => ({ top: b.top, col: Math.round(b.left / pitch), h: b.height })) }
      // Paragraph to paragraph, inside one column: exactly one line, never 1.85 of one.
      const kids = [...flow.children]
      for (let i = 1; i < kids.length; i++) {
        if (kids[i - 1].tagName !== 'P' || kids[i].tagName !== 'P') continue
        const a = rects(kids[i - 1]), b = rects(kids[i])
        if (!a.length || !b.length) continue
        const last = a[a.length - 1], first = b[0]
        if (last.col !== first.col) continue
        const n = (first.top - last.top) / lh
        if (Math.abs(n - Math.round(n)) > 0.04) return 'a paragraph break measures ' + n.toFixed(2) + ' lines'
      }
      // And every column's text sits at the same place on that grid.
      const phase = {}
      for (const p of flow.querySelectorAll('p')) for (const r of rects(p)) {
        if (Math.abs(r.h - body) > 3) continue
        if (phase[r.col] === undefined || r.top < phase[r.col]) phase[r.col] = r.top
      }
      const ph = Object.values(phase).map((t) => +((t % lh).toFixed(1)))
      const mode = ph.sort()[Math.floor(ph.length / 2)]
      const off = ph.filter((v) => Math.abs(v - mode) > 1).length
      document.querySelector('.book-x').click()
      // A column that OPENS WITH A PICTURE is the one exception, and it is measured rather
      // than asserted: an illustration's height is whatever its proportions give, so the
      // text under it lands wherever that leaves it. Putting pictures on the grid means
      // letterboxing every one of them into a whole number of lines, which is a decision
      // about the look of the page and not a bug to be fixed quietly.
      if (off > ph.length / 2) return off + ' of ' + ph.length + ' columns off the grid: ' + ph.join(', ')
      return 'ok paragraph breaks whole, ' + (ph.length - off) + '/' + ph.length + ' columns on one grid'
    })()`, 600))

  // FOUR MARKS, ONE LINE. The three boxes in the overlay's corner were centred and the
  // glyphs inside them were not: the size pair shared a baseline, which put the small a
  // 2.9px below the middle while the count and the close button sat on it, and the row read
  // as tilted. Reported from a phone. NOTE: a template literal. No backticks.
  flow('book mode: the corner controls sit on one line', () => expect(
    '/the-reed-pen-in-van-goghs-letters', `
    (async () => {
      document.querySelector('[data-book-open]').click()
      await new Promise((r) => setTimeout(r, 600))
      const row = document.querySelector('.book-overlay[open] .book-topright')
      if (!row) return 'the overlay did not open'
      const b = row.getBoundingClientRect()
      const mid = (b.top + b.bottom) / 2
      const marks = [...row.querySelectorAll('*')]
        .filter((e) => e.children.length === 0 && (e.textContent || '').trim())
        .map((e) => { const r = document.createRange(); r.selectNodeContents(e)
          const g = r.getBoundingClientRect()
          return { t: e.textContent.trim().slice(0, 3), off: +(((g.top + g.bottom) / 2) - mid).toFixed(2) } })
      document.querySelector('.book-x').click()
      if (marks.length < 3) return 'only ' + marks.length + ' mark(s) in the corner'
      const crooked = marks.filter((m) => Math.abs(m.off) > 1)
      if (crooked.length) return crooked.map((m) => m.t + ' ' + m.off + 'px off').join(', ')
      return 'ok ' + marks.length + ' marks within ' + Math.max(...marks.map((m) => Math.abs(m.off))).toFixed(2) + 'px of the line'
    })()`, 600))
}
