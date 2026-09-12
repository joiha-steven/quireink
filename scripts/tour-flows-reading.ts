// Two things about a page a READER meets that only a browser can answer.
//
// Its own file because `tour-flows.ts` and `tour-flows-shell.ts` are both within a dozen
// lines of the 400-line rule, and because the pair below share a subject the other files do
// not: both are about a page holding its shape while the reader moves through it — one down
// the length of a paragraph, the other down the length of an article.
//
// Neither fault is reachable from a unit test. The first is a float closing up around a
// picture, which needs line boxes; the second is a scroll listener, which needs a scroll.
import type { Tour } from './tour'

// `expect` is unused here: both flows pin a width, because both faults are about what a
// LAYOUT does and neither is visible at the tour's own window.
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
}
