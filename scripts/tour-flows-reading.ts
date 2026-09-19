// Three things about a page a READER meets that only a browser can answer.
//
// Its own file because `tour-flows.ts` and `tour-flows-shell.ts` are both within a dozen
// lines of the 400-line rule, and because the first two share a subject the other files do
// not: both are about a page holding its shape while the reader moves through it — one down
// the length of a paragraph, the other down the length of an article.
//
// None of the three is reachable from a unit test. The first is a float closing up around a
// picture, which needs line boxes; the second is a scroll listener, which needs a scroll; the
// third is focus and a computed custom property, and a string of HTML has neither.
import type { Tour } from './tour'

// The first two flows pin a width with `atWidth`, because both faults are about what a LAYOUT
// does and neither is visible at the tour's own window. The third uses `expect`: it measures
// inside iframes it sizes itself, so the tour's own window is beside the point.
export function registerReadingFlows({ flow, atWidth, expect }: Pick<Tour, 'flow' | 'atWidth' | 'expect'>): void {
  // ONE LEFT EDGE PER PARAGRAPH. A feed card floats its picture and lets the words close up
  // underneath, which assumed four lines of standfirst would run past it. What actually sits
  // beside a 96px square is the kind line and the headline, so the standfirst got one or two
  // lines before the float ended: measured at 1440 on 2026-09-12, one ran two lines at 529.6
  // and dropped to 416, another ran a SINGLE line before dropping — a paragraph whose left
  // edge steps 113.6px in the middle of itself. NOTE: a template literal. No backticks.
  flow('the front page gives every standfirst one left edge', () => atWidth(1440, '/', `
    (() => {
      const cards = [...document.querySelectorAll('.post-list article')]
      if (cards.length < 2) return 'skip: fewer than two cards in the feed'
      const withPicture = cards.filter((a) => a.querySelector('.card-thumb')).length
      if (!withPicture) return 'skip: no card in the feed carries a picture'
      const stepped = []
      for (const card of cards) {
        const p = card.querySelector('h2 + p, h3 + p')
        if (!p) continue
        // Grouped by line: a Range hands back one rect per inline run, so a line containing a
        // link or an em yields several and only the leftmost of them is that line's edge.
        const r = document.createRange()
        r.selectNodeContents(p)
        const byLine = {}
        for (const b of r.getClientRects()) {
          if (b.height < 5) continue
          const line = Math.round(b.top)
          byLine[line] = Math.min(byLine[line] === undefined ? 1e9 : byLine[line], b.left)
        }
        const edges = [...new Set(Object.values(byLine).map((v) => Math.round(v)))]
        if (edges.length > 1) stepped.push(edges.sort((a, b) => a - b).join(' then '))
      }
      if (stepped.length) return stepped.length + ' standfirst(s) step mid-paragraph: ' + stepped.join(', ')
      return 'ok ' + cards.length + ' cards, ' + withPicture + ' with a picture, one left edge each'
    })()`, 400))

  // THE INDEX MARKS THE SECTION BEING READ, and for a while it marked something else entirely.
  // The last row of the list points at the taxonomy, and on a desktop that copy lives in the
  // gutter panel at the TOP of the article — so it passed the reading line within the first
  // screenful and, being last in the list, won every pass after that. Measured at 1440 on
  // 2026-09-12: the lit row moved to the end row at 165px of scroll and stayed there through
  // all three sections. NOTE: a template literal. No backticks.
  flow('the index follows the section being read', () => atWidth(1440, '/what-a-subsetter-removes', `
    (async () => {
      const heads = [...document.querySelectorAll('.prose h2')]
      if (heads.length < 2) return 'skip: this piece has no sections'
      if (!document.querySelector('.toc a')) return 'no contents list on a piece with sections'
      const lit = () => ((document.querySelector('.toc a.is-active') || {}).textContent || '').trim()
      const wrong = []
      for (const h of heads) {
        window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 40)
        await new Promise((r) => setTimeout(r, 450))
        const want = h.textContent.trim()
        if (lit() !== want) wrong.push(want + ' -> ' + (lit() || 'nothing'))
      }
      window.scrollTo(0, 0)
      if (wrong.length) return 'standing in a section the index did not mark: ' + wrong.join('; ')
      return 'ok the index followed all ' + heads.length + ' sections'
    })()`, 400))

  // A LOOK IS ONE ATTRIBUTE AND ONE SHEET, and the sheet boards only the blog wearing it.
  // Static tests hold the CSS; only a browser can prove the page actually LINKS the one it
  // needs and none of the others, which is the whole argument for splitting them out of the
  // sheet every blog downloads. The fixture wears the source-code dialect.
  flow('the look ships as its own sheet, and only the one being worn', () =>
    expect('/a-type-scale-you-can-defend', `
    (() => {
      const worn = document.documentElement.getAttribute('data-look')
      if (worn !== 'code') return 'the fixture is wearing ' + worn + ', not code'
      const hrefs = [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.getAttribute('href'))
      const looks = hrefs.filter((h) => h.includes('/look-'))
      if (looks.length !== 1) return 'linked ' + looks.length + ' look sheets: ' + looks.join(' ')
      if (!/\\/assets\\/look-code\\.[a-z0-9]+\\.css$/.test(looks[0])) return 'wrong sheet: ' + looks[0]
      // ...and it carries the dialect, not a stub.
      const marker = getComputedStyle(document.querySelector('.rail h2'), '::before').content
      if (!marker.includes('//')) return 'the code sheet loaded but marked no heading: ' + marker
      return 'ok one sheet, ' + looks[0]
    })()`))

  // BOOK MODE, moved here from `tour-flows.ts` on 2026-09-14 when that file reached its
  // 400-line ceiling. The seam is the file's own: these are the reading site's behaviour at a
  // given width, which is what everything else in here is about.

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
      await new Promise((r) => setTimeout(r, 500))
      // A PHONE GETS THE SCROLLED READER, not the spread — since 2026-09-06, because a modal
      // dialog takes the scroll off the document and iOS then keeps its own bars for the
      // whole read. What that reader has to do is asserted in tour-flows-shell.ts; this
      // flow owns the DOORWAY, so it only checks that the button opens the right thing.
      const r = document.querySelector('.book-reader')
      if (!r) return document.querySelector('.book-overlay[open]') ? 'the phone got the desktop spread' : 'nothing opened'
      const flow = r.querySelector('.book-flow')
      if (!flow || !flow.textContent.trim()) return 'the reader opened empty'
      r.querySelector('.book-x').click()
      await new Promise((r2) => setTimeout(r2, 400))
      return document.querySelector('.book-reader') ? 'it would not close' : 'ok'
    })()`, 400))

  // An unfolded foldable: 673px of glass with the fold's crease down the exact middle. One
  // page here is a 577px column with the crease through every line; two 288px pages put the
  // crease inside the gutter, which is the whole reason a book mode belongs on this device.
  flow('an unfolded foldable gets two pages with the crease in the gutter', () => atWidth(673,
    '/the-reed-pen-in-van-goghs-letters', `
    (async () => {
      document.querySelector('[data-book-open]').click()
      await new Promise((r) => setTimeout(r, 400))
      const d = document.querySelector('.book-overlay[open]')
      if (!d) return 'the overlay did not open'
      if (d.querySelector('.book-viewport').dataset.pages !== '2')
        return 'an unfolded foldable got ' + d.querySelector('.book-viewport').dataset.pages + ' page(s)'
      const vp = d.querySelector('.book-viewport').getBoundingClientRect()
      // The spine must straddle the fold: the spread's centre within a gutter's half-width
      // of the glass's centre, or the crease is running through one of the pages.
      if (Math.abs((vp.left + vp.right) / 2 - innerWidth / 2) > 28)
        return 'the spine sits ' + Math.round((vp.left + vp.right) / 2 - innerWidth / 2) + 'px off the fold'
      d.querySelector('.book-x').click()
      return 'ok'
    })()`, 400))

  // A BOX THAT SCROLLS. `tabindex` is a claim about the focus order and a string of HTML
  // cannot answer it: only a browser holding the document knows what `activeElement` becomes.
  //
  // ⚠️ NOT IN AN IFRAME, which was the first attempt and is impossible by design — every
  // response carries `X-Frame-Options: DENY`, so the frame stays blank and `contentDocument`
  // is null. The window is pinned narrow instead, which is also the honest width: this is a
  // phone fault.
  //
  // ⚠️ AND THE TABLE IS MADE HERE, not borrowed from the seed. The second attempt pointed at
  // a seeded post and reported "the wrapper does not overflow at 360px, so it proves nothing:
  // 312 in 312" — the widest table in the fixture FITS a phone, so the flow would have been
  // measuring a box with no overflow for as long as nobody read the verdict. Twelve columns
  // overflow at any width there is, and the post is purged on the way out.
  //
  // NOTE: a template literal. No backticks inside it.
  flow('a wide table in an article can be reached without a mouse', async () => {
    const slug = 'tour-wide-table'
    const made = await expect('/admin', `
      (async () => {
        const cells = []
        for (let i = 1; i <= 12; i += 1) cells.push('column ' + i)
        const row = '| ' + cells.join(' | ') + ' |'
        const rule = '| ' + cells.map(() => '---').join(' | ') + ' |'
        const res = await fetch('/api/posts', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: 'Tour: a wide table', slug: '${slug}', status: 'published',
            date: new Date(Date.now() - 60000).toISOString(),
            content: 'Mot doan van dung truoc bang.\\n\\n' + row + '\\n' + rule + '\\n' + row + '\\n',
          }),
        })
        if (!res.ok) return 'could not make the post: ' + res.status
        return 'ok'
      })()`, 600)
    if (!made.startsWith('ok')) return made

    const seen = await atWidth(360, `/${slug}`, `
      (() => {
        const box = document.querySelector('.table-scroll')
        if (!box) return 'the article has no .table-scroll at all'
        const spill = box.scrollWidth - box.clientWidth
        if (spill <= 0) {
          return 'the wrapper does not overflow at 360px, so it proves nothing: '
            + box.scrollWidth + ' in ' + box.clientWidth
        }
        box.focus()
        if (document.activeElement !== box) {
          const a = document.activeElement
          return 'the scrolling box cannot take focus (active element is '
            + (a ? a.tagName + '.' + a.className : 'none') + '), so its '
            + spill + 'px past the right edge are reachable by dragging and by nothing else'
        }
        // ⚠️ THE COUNTER-MEASUREMENT. focus() on a plain div leaves activeElement on the body,
        // so a harness that blessed anything would be caught here rather than blessing a
        // wrapper that had quietly lost its attribute.
        const plain = document.createElement('div')
        document.body.appendChild(plain)
        plain.focus()
        const fooled = document.activeElement === plain
        plain.remove()
        if (fooled) return 'this browser focuses a plain div, so the check above says nothing'
        // And the TABLE is not the target: the box with the overflow is.
        if (document.querySelector('table[tabindex]')) {
          return 'the table carries tabindex, but the wrapper is the element that scrolls'
        }
        return 'ok the wrapper took focus with ' + spill + 'px past its right edge'
      })()`, 400)

    // ⚠️ PURGED, NOT TRASHED, and on the way out of a FAILURE too: a DELETE is a soft delete,
    // so a flow that gives up early would leave a row in the Trash for every flow after it.
    await expect('/admin', `
      (async () => {
        await fetch('/api/posts/${slug}', { method: 'DELETE' })
        await fetch('/api/trash', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'posts', action: 'purge', ids: ['${slug}'] }),
        })
        return 'ok'
      })()`, 600)
    return seen
  })

  // A HEADLINE IN ANOTHER LANGUAGE, on a page that is not in it. `lang` on a list item is a
  // claim about which `:lang()` rule wins, and the only way to ask is to read back the custom
  // property the stylesheet sets — the markup says nothing about which face resolved.
  flow('a foreign headline in the feed takes its own face', () => expect('/', `
    (() => {
      const root = document.documentElement
      if (root.getAttribute('lang') === 'ko') {
        return 'the home page itself claims to be Korean, so an item cannot be told apart'
      }
      if (!document.documentElement.outerHTML.includes(':lang(ko)')) {
        return 'the stylesheet ships no :lang(ko) rule, so nothing could have applied'
      }
      const head = [...document.querySelectorAll('h1[lang], h2[lang]')]
        .find((h) => h.getAttribute('lang') === 'ko')
      if (!head) {
        const any = [...document.querySelectorAll('h1, h2')].map((h) => h.textContent.trim().slice(0, 16))
        return 'no headline in the feed says it is Korean; saw ' + JSON.stringify(any.slice(0, 8))
      }
      const varOf = (el) => getComputedStyle(el).getPropertyValue('--font-reading').trim()
      if (varOf(head) === varOf(root)) {
        return 'the Korean headline resolves the same reading face as the page round it ('
          + varOf(head).slice(0, 60) + '), so :lang(ko) matched nothing'
      }
      // The counter-test: a neighbour that named no language must resolve the ROOT's face.
      const plain = [...document.querySelectorAll('h1, h2')].find((h) => !h.hasAttribute('lang'))
      if (plain && varOf(plain) !== varOf(root)) {
        return 'a headline with no lang resolves something other than the page face, so the '
          + 'comparison above cannot tell a matched rule from a mismatched one'
      }
      return 'ok the Korean headline resolves a reading face the page round it does not'
    })()`, 400))
}
