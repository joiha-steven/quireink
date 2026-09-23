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

  it('writes no colour at all, because the palette is the only source of one', () => {
    // Theme tokens only, everywhere a look paints — a hex in a rule is a colour that
    // survives the reader changing the palette, which is the one thing a palette is for.
    //
    // THE EXEMPTION IS GONE. For two releases a look was allowed to declare the seven
    // palette tokens itself, on the argument that a newspaper and a notebook are materials.
    // It made four of the six rows in the palette menu dead controls on those two looks:
    // `html[data-look=paper]` is (0,1,1) and `[data-palette=mono]` is (0,1,0), so choosing
    // Mono, Sepia or Forest changed not one pixel. The owner settled it on 2026-09-13 — a
    // look sets shape, type and marks, and what colour they come out in is the reader's.
    for (const [name, css] of Object.entries(SHEETS)) {
      for (const line of rules(css)) {
        expect(`${name}: ${line}`).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      }
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
    //
    // BOTH SPELLINGS of the name. It is a bare <a class="title"> on most pages and an
    // <h1 class="site-h1"> wrapping that anchor on a listing whose lead card is switched
    // off, so a rule naming only `.title` would place the masthead on every page but those.
    expect(LOOK_PAPER_CSS).toContain('.site-bar > :is(.title,.site-h1){grid-area:1/1/2/-1;')
    expect(LOOK_PAPER_CSS).toContain('margin-inline:0')
  })

  it('gives the strapline and the controls ONE row, and centres on the page', () => {
    // The controls were absolute at the top right of a masthead centred everywhere else.
    // They now end the strapline's row, which needs the header to be a grid: in the column
    // flex it was, every child took a row of its own and no alignment could pair two.
    expect(LOOK_PAPER_CSS).toContain('header.site{display:grid;grid-template-columns:1fr auto 1fr')
    // The outer columns are equal whatever the controls measure, so the strapline sits on
    // the name's axis rather than in what the controls leave. Measured at 1440: 720.0/720.0.
    expect(LOOK_PAPER_CSS).toContain('.tagline{grid-area:2/2/3/3')
    expect(LOOK_PAPER_CSS).toContain('.site-actions{grid-area:2/3/3/4;justify-self:end')
    // Nothing is left positioned: an absolute control in a grid cell ignores the cell.
    expect(LOOK_PAPER_CSS).not.toContain('.site-actions{position:absolute')
  })

  it('puts the section menu on a phone as a painted strip, and takes it out of the drawer', () => {
    // The base sheet hides it under 60rem and paints its links only above that width. A flat
    // `display:flex` here once outranked the hide and printed five DEFAULT-BLUE underlined
    // links across a phone masthead, beside a drawer button that opened the same five.
    // Since 2026-09-23 the menu lives in the masthead on every page of this look, so the
    // phone keeps it on purpose - but only inside a narrow-width block that paints it, and
    // only because the rail's copy is gone, so the drawer no longer repeats it.
    const narrow = LOOK_PAPER_CSS.slice(LOOK_PAPER_CSS.indexOf('@media (max-width:59.99rem)'))
    expect(narrow).toContain('.site-bar > .site-menu{display:flex;flex-wrap:nowrap')
    expect(narrow).toContain('.site-menu a{color:var(--c-meta);text-decoration:none')
    const flat = LOOK_PAPER_CSS.slice(0, LOOK_PAPER_CSS.indexOf('@media (max-width:59.99rem)'))
    for (const line of flat.split('\n').filter((l) => l.includes('.site-bar > .site-menu'))) {
      expect(line).not.toContain('display:flex')
    }
    expect(LOOK_PAPER_CSS).toContain('.rail-inner > nav:not(.toc){display:none}')
  })

  it('puts the section over the headline and the byline under it', () => {
    // A paper opens on a headline, not on a grey line of housekeeping. The two halves are
    // one paragraph in the markup, so the paragraph has to give up its box before either
    // can be placed: without `display:contents` this dialect could only move all of it or
    // none of it.
    expect(LOOK_PAPER_CSS).toContain('.post-meta{display:contents')
    // THE BACKSLASH GOES IN THE CLASS TOO, and leaving it out is what a scanner calls
    // incomplete sanitization: an escaper that does not escape its own escape character can
    // be walked straight past by an input carrying one. Nothing reaches this but the four
    // literals below, so nothing was ever wrong on this page — but a half-escape copied into
    // a place that does take input is a real hole, and the half-escape is what gets copied.
    // `>` was in the old class and is not a metacharacter; this is the standard set.
    const quoted = (sel: string) => sel.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
    const row = (sel: string) =>
      new RegExp(`${quoted(sel)}\\{grid-row:(\\d)`).exec(LOOK_PAPER_CSS)?.[1]
    expect(row('.post-cat')).toBe('1')
    expect(row('article > header h1')).toBe('2')
    expect(row('article > header .deck')).toBe('3')
    expect(row('.post-facts')).toBe('4')
    // The base sheet's middot separates two halves of one sentence. They are two lines here.
    expect(LOOK_PAPER_CSS).toContain('.post-cat::after{content:none}')
  })

  it('sets the series box as a standing box, with no corner radius anywhere', () => {
    // A rounded card with a hairline round it is a web component, and it was the last thing
    // on the page still saying so. Nothing in this dialect draws a corner.
    expect(LOOK_PAPER_CSS).toContain('aside.series{border:0;border-radius:0')
    expect(LOOK_PAPER_CSS).not.toMatch(/border-radius:(?!0)/)
    // Its marker is the margin's change bar, a printed convention. It was the accent, which
    // in this look is the link blue: a blue bar beside black type says the line is a link.
    const bar = /aside\.series li\[aria-current]::after\{[^}]*}/.exec(LOOK_PAPER_CSS)?.[0] ?? ''
    expect(bar).toContain('var(--c-heading)')
    expect(bar).not.toContain('--c-accent')
    // The index's own you-are-here rule is the same mark three inches down the same page,
    // and it inherited the same accent from the same base rule.
    const row = /\.rail-row\[aria-current]::after\{[^}]*}/.exec(LOOK_PAPER_CSS)?.[0] ?? ''
    expect(row).toContain('background:var(--c-heading)')
  })

  it('gives the name on the header the same face as the chrome around it', () => {
    // `.title` carries `--font-sans` of its own, which the chrome-font setting fills in — so
    // a dialect that changes the chrome face on `body` changes everything in the header
    // EXCEPT the one word the site is introduced by. The source-code look wore an Inter
    // wordmark over a monospace strapline, a monospace menu and bracketed monospace controls
    // for two releases; the notebook wore a monospace one over a sans.
    //
    // Keyed on the sheet that moves the face: a look that leaves `body` alone has nothing to
    // answer for, and `plain` is exactly that.
    for (const [name, css] of Object.entries(SHEETS)) {
      if (!css.includes('body{font-family')) continue
      // The declaration can sit anywhere in the rule, so the RULE is what is read — the
      // newspaper writes its size first and its face last.
      const rule = new RegExp(`\\.site-bar > \\.title\\{[^}]*font-family`).test(css)
      expect(`${name}: ${rule}`).toBe(`${name}: true`)
    }
  })

  it('moves the shelf inline on a PIECE and never on a listing', () => {
    // Moved on a listing it landed under thirty-three posts. Every inline-shelf rule is
    // scoped inside an <article>, which a listing's rail is not.
    // Keyed on what a rule DOES, not on what it mentions: the label rules name `.rail` too
    // and are right to apply on a listing, because they set the shelf's face rather than
    // its place. A rule that moves it says so with `position` or `display`.
    for (const block of LOOK_PAPER_CSS.split('}')) {
      if (!/\.rail|\.toc/.test(block)) continue
      if (!/(position|display):/.test(block)) continue
      // Taking something AWAY is not moving the shelf: the menu's rail copy and a drawer
      // button with nothing to open go on a listing too.
      if (/\{\s*display:none\s*$/.test(block)) continue
      expect(block).toContain('article ')
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

  it('steps the quiet ink down, because the chrome stands on the desk', () => {
    // The desk is the page darkened, and the palette's `--c-meta` was chosen against the
    // page. Measured on 2026-09-16 with a real browser: the tagline, the pager count, the
    // footer and every date in the rail came out at 4.47:1 on the mono desk, under the 4.5
    // AA asks at that size, and every palette lost the same slice.
    // THROUGH A SECOND NAME. This was `body{--c-meta:color-mix(..var(--c-meta)..)}` until
    // 2026-09-23, on the belief that the var() read the parent's value. It reads its own:
    // a custom property that names itself is a cycle, the cycle makes it invalid, and every
    // quiet line on the site fell back to the full text ink for nine days.
    expect(LOOK_NOTES_CSS)
      .toContain('html[data-look=notes]{--c-meta-desk:color-mix(in srgb,var(--c-meta) 94%,var(--c-text))}')
    expect(LOOK_NOTES_CSS).toContain('html[data-look=notes] body{--c-meta:var(--c-meta-desk)}')
    expect(LOOK_NOTES_CSS).not.toMatch(/--c-meta:[^;}]*var\(--c-meta\)/)
  })

  it('grows the sheet outward by exactly what it pads', () => {
    // So the first line of the piece stays on the line the shelf and the card start on, and
    // not one word of the column moves when the dialect is switched. The extra pixel is the
    // border: without it the headline sat one pixel low.
    expect(LOOK_NOTES_CSS).toContain('padding:var(--sheet-inset)')
    expect(LOOK_NOTES_CSS).toContain('margin:calc(-1px - var(--sheet-inset)) calc(-1 * var(--sheet-inset)) 0')
  })

  it('prints a dot grid on every sheet, not a rule under every line', () => {
    // The per-paragraph ruling (2026-09-14 to 09-23) could not drift, but it underlined each
    // line of every excerpt on the front page and crossed between a date and its headline:
    // it read as a form. Dots carry no line for text to sit on or miss, so they need no
    // per-paragraph drawing - and they reach the listing and the composed front by being on
    // the sheet itself, which is the gap the ruling once shipped with.
    expect(LOOK_NOTES_CSS).toContain('background-image:radial-gradient(circle,var(--dot)')
    expect(LOOK_NOTES_CSS).not.toContain('background-size:100% var(--step)')
    // Derived from the palette, never typed.
    expect(LOOK_NOTES_CSS).toContain('--dot:color-mix(in srgb,var(--c-meta)')
  })

  it('puts a page under all THREE layouts, not just the two that are named article', () => {
    // The composed front page's container is `div.front` — neither the piece nor a feed, so
    // it matched neither name and the layout most visitors arrive on had no paper under it
    // at all: three ruled sections and a row of pictures lying straight on the desk.
    const sheet = /html\[data-look=notes] main > article,[\s\S]*?padding:var\(--sheet-inset\)/.exec(
      LOOK_NOTES_CSS,
    )?.[0] ?? LOOK_NOTES_CSS
    expect(sheet).toContain('html[data-look=notes] main > .front')
    expect(sheet).toContain('html[data-look=notes] .post-list')
  })

  it('keeps the page lighter than the desk in BOTH halves of the day', () => {
    // The desk was the paper with the ink mixed into it, and at night the ink is the pale
    // one: the same mix lifted the desk ABOVE the page, so the sheet read as a hole cut in
    // the board. Measured then: page rgb(27,32,39) on a desk of rgb(40,45,52). Now it is the
    // page's own lightness taken down, one formula for both halves — and DERIVED from
    // --c-bg, so it follows the reader's palette wherever they take it.
    expect(LOOK_NOTES_CSS).toContain('oklch(from var(--c-bg) calc(l * .955) c h)')
    expect(LOOK_NOTES_CSS).toContain('oklch(from var(--c-bg) calc(l * .72) c h)')
    // Behind @supports, because a custom property swallows a value it cannot use and fails
    // only when something reads it — here, with the body left carrying no background at all.
    expect(LOOK_NOTES_CSS).toContain('@supports (color:oklch(from red l c h)){')
    expect(LOOK_NOTES_CSS).toContain('--desk:color-mix(in srgb,var(--c-text) 7%,var(--c-bg))')
  })

  it('brings no ink of its own, and no second FACE either', () => {
    // It declared cream paper, a pale blue rule and blue-black ink for one release. The
    // palette is the only source of colour on this site, and a look that brings its own
    // makes the palette menu a control that lies.
    expect(LOOK_NOTES_CSS).not.toContain('--c-bg:')
    expect(LOOK_NOTES_CSS).not.toContain('--c-rule:')
    // And NO @font-face and no family this dialect alone would have to download. The
    // newspaper earns a second serif because a paper cuts its headlines from one; the face
    // that would say "notebook" is a handwriting face, and the ones in reach carry no
    // Vietnamese — which on a blog in this product's own first language means a system
    // fallback on every accented word.
    expect(LOOK_NOTES_CSS).not.toContain('@font-face')
    for (const family of ['Kalam', 'Caveat', 'Patrick', 'Comic']) {
      expect(LOOK_NOTES_CSS).not.toContain(family)
    }
  })
})
