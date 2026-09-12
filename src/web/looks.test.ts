// The four dialects, and the rules NONE of them may break.
//
// `look-code.test.ts` holds what the source-code dialect says; this file holds what every
// look owes the product, and the two new ones' own load-bearing details. The seam matters:
// a rule here failing means a dialect has escaped its attribute or its sheet, which is a
// bug on every blog that does not wear it.
import { describe, expect, it } from 'bun:test'
import { LOOK_CODE_CSS } from '@/web/look-code.css'
import { LOOK_PAPER_CSS, paperLabelCss } from '@/web/look-paper.css'
import { LOOK_NOTES_CSS } from '@/web/look-notes.css'
import { PUBLIC_CSS } from '@/web/public.css'
import { lookSheet } from '@/web/assets'

const SHEETS = { code: LOOK_CODE_CSS, paper: LOOK_PAPER_CSS, notes: LOOK_NOTES_CSS }

/** Declaration lines only: prose above a rule is not a selector. */
const rules = (css: string): string[] =>
  css.split('\n').filter((l) => /^html\[data-look=/.test(l.trim()) || /\{.*:/.test(l))

describe('every look is one attribute, one sheet, and nothing else', () => {
  it('gates every selector it writes on its own attribute', () => {
    for (const [id, css] of Object.entries(SHEETS)) {
      const selectors = css.split('\n').filter((l) => l.trim().startsWith('html['))
      expect(selectors.length).toBeGreaterThan(10)
      for (const line of selectors) expect(line).toContain(`html[data-look=${id}]`)
    }
  })

  it('never writes a colour of its own', () => {
    // Theme tokens only, like the rest of the public site. A hex here is a colour that
    // survives the reader changing the palette, which is the one thing a palette is for.
    for (const css of Object.values(SHEETS)) {
      for (const line of rules(css)) expect(line).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    }
  })

  it('never puts a WORD in a content string', () => {
    // A CSS content string cannot be translated. Punctuation, counters and marks only —
    // the newspaper's "Fig." and "Table" ride in the per-page block instead, from locales.
    for (const css of Object.values(SHEETS)) {
      for (const m of css.matchAll(/content:"([^"]*)"/g)) {
        expect(m[1]).not.toMatch(/[A-Za-z]{2,}/)
      }
    }
  })

  it('ships as its own sheet, and plain ships none', () => {
    // The whole argument for the split: a blog wearing nothing pays nothing.
    expect(lookSheet('plain')).toBe('')
    for (const id of ['code', 'paper', 'notes'] as const) {
      expect(lookSheet(id)).toMatch(new RegExp(`^/assets/look-${id}\\.[a-z0-9]+\\.css$`))
    }
    // ...and none of it is in the sheet every blog downloads.
    expect(PUBLIC_CSS).not.toContain('data-look=')
  })
})

describe('the newspaper dialect', () => {
  it('numbers sections with counter-SET, never counter-reset', () => {
    // A reset scoped to the heading creates a new instance its siblings go on reading: the
    // contents index shipped that bug once and ran 1.1 1.2 2.3 2.4 2.5 3.6.
    expect(LOOK_PAPER_CSS).toContain('counter-increment:sec;counter-set:sub 0')
    expect(LOOK_PAPER_CSS).not.toMatch(/h2\{[^}]*counter-reset/)
  })

  it('takes the words for its figure and table numbers from the locale', () => {
    // The one part of a dialect that needs language, and the reason it cannot live in the
    // cached sheet: that sheet is shared by every blog on earth.
    expect(paperLabelCss('en')).toContain('content:"Fig. " counter(fig)')
    expect(paperLabelCss('vi')).toContain('content:"Hình " counter(fig)')
    expect(paperLabelCss('vi')).toContain('content:"Bảng " counter(tbl)')
    // ...and the sheet itself names neither.
    expect(LOOK_PAPER_CSS).not.toContain('Fig.')
  })

  it('clears the auto margin that pins the masthead name to the left edge', () => {
    // With `display:contents` on the bar, the name's own `margin-right:auto` — there to
    // push the controls to the far end of the ROW — ate 917px of the column and left the
    // name ranged left under a centred strapline.
    expect(LOOK_PAPER_CSS).toContain('.site-bar > .title{order:1;margin-inline:0')
  })

  it('moves the shelf inline on a PIECE and never on a listing', () => {
    // Moved on a listing it landed under thirty-three posts. Every inline-shelf rule is
    // scoped inside an <article>, which a listing's rail is not.
    for (const line of LOOK_PAPER_CSS.split('\n')) {
      if (line.includes('.rail{') || line.includes('.rail-inner') || line.includes('.toc summary')) {
        expect(line).toContain('article ')
      }
    }
  })
})

describe('the notebook dialect', () => {
  it('draws the sheet on the PIECE, never on a listing row', () => {
    // A listing's rows are <article> elements too: the bare selector drew a bordered card
    // round every entry on the front page, with a hairline above and below each one.
    expect(LOOK_NOTES_CSS).toContain('html[data-look=notes] main > article')
    expect(LOOK_NOTES_CSS).not.toMatch(/^html\[data-look=notes] article/m)
  })

  it('grows the sheet outward by exactly what it pads', () => {
    // So the first line of the piece stays on the line the shelf and the card start on, and
    // not one word of the column moves when the dialect is switched. The extra pixel is the
    // border: without it the headline sat one pixel low.
    expect(LOOK_NOTES_CSS).toContain('padding:var(--sheet-inset)')
    expect(LOOK_NOTES_CSS).toContain('margin:calc(-1px - var(--sheet-inset)) calc(-1 * var(--sheet-inset)) 0')
  })

  it('rules per paragraph, at that paragraph own leading', () => {
    // One background across the sheet has one fixed step, and a picture is not a whole
    // number of lines tall, so the rules drift and start cutting through the text.
    expect(LOOK_NOTES_CSS).toContain('--step:calc(var(--lh-body,1.7) * 1em)')
    expect(LOOK_NOTES_CSS).toContain('background-size:100% var(--step)')
  })

  it('rules a listing as well as a piece, and at a weight that can be seen', () => {
    // Both of these shipped wrong once. The rules reached `.prose`, which exists on a piece
    // and nowhere else, so anyone who met this look on the front page met a blank sheet —
    // and they were drawn at 38% of `--c-rule`, which on #ebebeb over #fcfcfc is not faint
    // but absent. `--c-rule` is already the lightest line this design has.
    expect(LOOK_NOTES_CSS).toContain('html[data-look=notes] .post-list article > p{')
    expect(LOOK_NOTES_CSS).toContain('var(--c-rule) calc(var(--step) - 1px)')
    expect(LOOK_NOTES_CSS).not.toMatch(/var\(--c-rule\) \d\d%,transparent\) calc\(var\(--step\)/)
  })
})
