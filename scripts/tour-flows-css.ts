// The Custom CSS box, in a real browser.
//
// This product ships no themes, so this box is the whole of the answer once the 155 settings
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
      const status = () => document.querySelector('[data-css-status]')?.textContent ?? ''

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
 * The account screen, which is the third capability this week that existed and had no door.
 *
 * `listSessions` and `revokeAllSessions` were written and tested and called by nobody; the
 * spec described a screen nothing had ever built. A unit test proves the routes answer — only
 * a browser proves the owner can reach them.
 */
export function registerSecurityFlows({ flow, expect }: Tour): void {
  flow('admin: the account can be defended from the admin', () =>
    expect('/admin/settings?tab=system', `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const cur = document.querySelector('[data-security-current]')
      if (!cur) return 'the System tab has no Security card'

      const rows = [...document.querySelectorAll('[data-security-session]')]
      if (!rows.length) return 'no signed-in device is listed, not even this one'
      if (!rows.some((r) => /this device|thiết bị này/i.test(r.textContent))) {
        return 'the list does not say which session is the one asking'
      }

      // Re-read after every render: React replaces these nodes, so a reference captured
      // earlier reports the disabled state of a button that is no longer on the page.
      const acting = () => [...document.querySelectorAll('button')]
        .filter((b) => /codes|enrol|mã mới|Đăng ký lại/i.test(b.textContent))
      if (acting().length < 2) return 'only ' + acting().length + ' password-only actions on screen'
      // Both are changes, so neither may be reachable until the password is typed. "Change
      // password" is deliberately NOT in this set: it waits for the new password as well,
      // which is why asserting all three go live failed on its first run.
      if (!acting().every((b) => b.disabled)) return 'an action was live before the password was given'

      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(cur, 'definitely not the password')
      cur.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(250)
      if (acting().some((b) => b.disabled)) return 'typing a password left an action disabled'

      // THE POINT: a valid session plus a wrong password changes nothing.
      acting().find((b) => /codes|mã mới/i.test(b.textContent)).click()
      await sleep(900)
      if (document.querySelector('[data-security-codes]')) return 'a wrong password minted recovery codes'
      if (!/not right|không đúng/i.test(document.body.innerText)) return 'a wrong password was refused silently'

      set.call(cur, '')
      cur.dispatchEvent(new Event('input', { bubbles: true }))
      return 'ok (' + rows.length + ' device(s))'
    })()`, 1800))

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
}
