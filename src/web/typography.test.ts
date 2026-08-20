// The owner's typography settings actually reaching the page.
//
// Every failure this pins was found by MEASURING a rendered page, not by reading the CSS:
// the sizes all looked like role references and the page still came out wrong.
import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { typographyToCss } from '@/content/settings'
import { DEFAULT_TYPOGRAPHY, TYPE_ROLES, getFontPreset } from '@/content/themes'
import { PUBLIC_CSS } from '@/web/public.css'
import { MONO_TRACKING } from '@/render/font-faces'

const DIR = './.tmp/test-typography'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

describe('typographyToCss', () => {
  it('emits all three variables for every role', () => {
    const css = typographyToCss(DEFAULT_TYPOGRAPHY)
    for (const role of TYPE_ROLES) {
      expect(css).toContain(`--fs-${role}:`)
      expect(css).toContain(`--lh-${role}:`)
      expect(css).toContain(`--ls-${role}:`)
    }
  })

  // The multiplier belongs INSIDE the variable. Spelled at the call sites instead, a rule
  // either had it or did not, and book mode enlarged the prose while leaving figcaptions,
  // tags and the comment thread at their unscaled size.
  it('bakes --type-scale into every size, so a subtree scales all of them', () => {
    const css = typographyToCss(DEFAULT_TYPOGRAPHY)
    for (const role of TYPE_ROLES) {
      expect(css).toContain(`--fs-${role}:calc(`)
      expect(css).toContain('var(--type-scale, 1)')
    }
    // Only the SIZE scales. Line height is a ratio and letter-spacing is in em, so both
    // already follow the size; multiplying them again would compound.
    expect(css).not.toMatch(/--lh-[a-z0-9]+:calc/)
    expect(css).not.toMatch(/--ls-[a-z0-9]+:calc/)
  })
})

describe('the public sheet', () => {
  // The rule is enforced by `bun run check:type`. This is the same rule asserted against the
  // ASSEMBLED sheet, which is what a reader actually receives.
  it('sizes text only from role variables', () => {
    const literals = [...PUBLIC_CSS.matchAll(/font-size:\s*([^;}]+)/g)]
      .map((m) => m[1]!.trim())
      // `max(16px,1em)` is exempt, and it is the one exemption worth naming: 16px there is
      // not a type size, it is the threshold below which iOS Safari zooms the page when a
      // field takes focus. It is a FLOOR over the inherited role rather than a replacement
      // for it, so the owner's setting still decides the size everywhere above 16px, and it
      // applies to form controls on phone widths only. A design size in px would still fail.
      .filter((v) => v !== 'max(16px,1em)')
      .filter((v) => !/^var\(--fs-[a-z0-9]+\)$/.test(v) && v !== 'inherit' && !/^[\d.]+em$/.test(v))
    // What is left is the icon glyphs listed in scripts/checks/type-roles.ts.
    expect(literals.every((v) => /^[\d.]+rem$/.test(v))).toBe(true)
    expect(literals.length).toBeLessThanOrEqual(5)
  })

  // Found by measuring: an h2 carries a UA default of 1.5em, so a section heading left to
  // inherit came out LARGER than the items under it.
  it('states a size on every heading it styles, rather than inheriting a UA default', () => {
    for (const selector of ['.related h2', '#comments h2']) {
      const rule = PUBLIC_CSS.slice(PUBLIC_CSS.indexOf(selector))
      expect(rule.slice(0, rule.indexOf('}'))).toContain('font-size:var(--fs-')
    }
  })

  // A related title used to have no size rule at all and fell back to the BODY size, so the
  // quietest block on the page was set as large as the writing. It is now one size
  // throughout, told apart by weight and colour.
  it('sets the whole related block at --fs-small, with no size of its own on the link', () => {
    expect(PUBLIC_CSS).toContain('.related{font-size:var(--fs-small)')
    expect(PUBLIC_CSS).toContain('.related h2{font-size:var(--fs-small)')
    const block = PUBLIC_CSS.slice(PUBLIC_CSS.indexOf('.related a{'))
    const rule = block.slice(0, block.indexOf('}'))
    expect(rule).toContain('font-weight:600')
    expect(rule).not.toContain('font-size')
  })

  // A comment is somebody's words. The frozen tree set it in the reading face and the port
  // dropped it, which left the whole thread in the chrome font.
  it('sets a comment body in the reading face', () => {
    const rule = PUBLIC_CSS.slice(PUBLIC_CSS.indexOf('.comment-body{'))
    expect(rule.slice(0, rule.indexOf('}'))).toContain('font-family:var(--font-reading)')
  })
})

describe('the font presets', () => {
  it('give every role a complete style', () => {
    for (const preset of ['inter', 'source-sans', 'literata', 'source-serif']) {
      const { roles } = getFontPreset(preset).typography
      for (const role of TYPE_ROLES) {
        expect(roles[role].size).toBeGreaterThan(0)
        expect(roles[role].line).toBeGreaterThan(1)
      }
    }
  })

  // The furniture must stay below the reading size in every preset, or the dates and the
  // footer start competing with the writing.
  it('keeps small and caption under body, and caption under small', () => {
    for (const preset of ['inter', 'source-sans', 'literata', 'source-serif']) {
      const { roles } = getFontPreset(preset).typography
      expect(roles.small.size).toBeLessThan(roles.body.size)
      expect(roles.caption.size).toBeLessThan(roles.small.size)
      // And not SO far under it that secondary text becomes fine print: 14px against an
      // 18px body was the complaint that started this.
      expect(roles.small.size / roles.body.size).toBeGreaterThan(0.8)
    }
  })

  // The serifs carry finer strokes, so their secondary text is set larger than the sans's.
  it('sets the serif presets larger at small sizes than the sans presets', () => {
    const small = (id: string) => getFontPreset(id).typography.roles.small.size
    expect(small('literata')).toBeGreaterThan(small('inter'))
    expect(small('source-serif')).toBeGreaterThan(small('source-sans'))
  })
})

describe('the mono-chrome tracking correction', () => {
  // Tracking INHERITS, so `body` alone covered the chrome until each rule started naming
  // its own --ls-<role> for the owner's sake. A rule that sets the property stops
  // inheriting, so the correction has to name it — and naming the wrong ones is the other
  // half of the same mistake.
  it('reaches the chrome surfaces that state their own tracking', () => {
    // `.front-label` is here because it was the one that got away. The newspaper front page
    // landed after this list existed, and its section heading is the only chrome rule on
    // that page which names --ls-small without also carrying `.t-small` in the markup — so
    // it was the only element there the correction missed. Measured under a JetBrains Mono
    // chrome: "Typography" set 90.2px as the section label above a card and 82.7px as that
    // card's own kicker.
    for (const selector of ['footer.site', 'p.tags', '.pager', 'header.site .tagline', '.related',
      '.front-label']) {
      expect(MONO_TRACKING).toContain(`html[data-chrome-font="jetbrains-mono"] ${selector}`)
      expect(MONO_TRACKING).toContain(`html[data-chrome-font="plex-mono"] ${selector}`)
    }
  })

  it('leaves the reading face alone', () => {
    // `figcaption` and `.footnotes` sit inside the article and render in --font-reading.
    // They were being given a MONO adjustment while painting in a book serif, because they
    // inherited it from body. Nothing set in the reading face may appear here.
    // The front page's three reading surfaces are here for the other half of the same
    // mistake: a headline, a standfirst and the lead's opening lines all render in the book
    // serif, and a mono correction applied to them is the fault this list was written to
    // catch when `.deck`, `figcaption` and `.footnotes` had it.
    for (const selector of ['figcaption', '.footnotes', '.prose', '.reading-font', '.comment-body',
      '.fc-title', '.fc-deck', '.fc-intro']) {
      expect(MONO_TRACKING).not.toContain(` ${selector}{`)
      expect(MONO_TRACKING).not.toContain(` ${selector},`)
    }
  })
})

describe('the author\'s own words are set in the reading face', () => {
  // The deck IS the excerpt: the same string a list card prints, where it has always
  // rendered in the reading font. Under the title it fell to --font-sans, so a blog with a
  // mono chrome opened every post with a book-serif headline and a terminal subtitle.
  it('gives the standfirst the reading family, as the card excerpt has', () => {
    expect(PUBLIC_CSS).toContain('.deck{margin:1rem 0 0;color:var(--c-meta);font-family:var(--font-reading)')
  })

  it('keeps the standfirst out of the mono-chrome correction', () => {
    expect(MONO_TRACKING).not.toContain(' .deck{')
    expect(MONO_TRACKING).not.toContain(' .deck,')
  })
})

describe('book mode is one number, and the reader may move it', () => {
  const css = typographyToCss(DEFAULT_TYPOGRAPHY)

  // THE FORMULA, fixed by the owner on 2026-07-29 at x1.15 and revised by the owner on
  // 2026-08-21 ("mặc định chữ hơi to") to x1.05 — with the A-/A+ control in book.ts an
  // untouched default is all the number decides now:
  //   book mode reading text = article reading text x the scale
  //   every gap inside the article = the same x the scale
  // Type and the space around it are one system. Enlarging the words and leaving the gaps
  // gives crowded reading, not bigger reading.
  it('emits every scale-dependent variable TWICE, on :root and on .book-overlay', () => {
    // The mechanism, not decoration. A var() inside a custom property is substituted where
    // that property is DECLARED, so `--fs-body` on :root resolves --type-scale against
    // :root — where it is undefined — and overriding the scale on a descendant changes
    // NOTHING. Book mode rendered at exactly the article's size from the port until this
    // was measured. Re-declaring the identical text on .book-overlay re-substitutes it
    // there, where the overlay's scale applies.
    const root = /:root\{(.*?)\}/s.exec(css)?.[1] ?? ''
    const book = /\.book-overlay\{(.*?)\}/s.exec(css)?.[1] ?? ''
    expect(root).not.toBe('')
    expect(book).toBe(root)
    for (const role of TYPE_ROLES) {
      expect(book).toContain(`--fs-${role}:calc(`)
      expect(book).toContain('var(--type-scale, 1)')
    }
  })

  it('carries the SPACING unit through the same block, so gaps scale with the type', () => {
    // --sp is why the 15% reaches the gaps. It must live in this one block: a second
    // definition on :root anywhere else would win or lose by source order, and the overlay
    // would silently go back to unscaled spacing.
    expect(css).toContain('--sp:calc(1rem * var(--type-scale, 1))')
    expect((css.match(/--sp:calc/g) ?? []).length).toBe(2)
  })

  it('spends --sp on the article gaps that used to be frozen in rem', () => {
    // Measured 2026-07-29 in a real browser, book mode against the article: every ratio
    // equal to the scale — body, leading, headings, paragraph gap, pre padding, blockquote indent,
    // figure margin, table cell padding. Before, every ratio was 1.000.
    for (const frozen of [
      '.prose li{margin:calc(var(--sp) * .25) 0}',
      'padding-left:var(--sp);color:var(--c-meta)}',
      '.prose pre{padding:var(--sp)',
      'padding:calc(var(--sp) * .4) calc(var(--sp) * .6)',
      'figure{margin:calc(var(--sp) * 2) 0}',
    ]) {
      expect(PUBLIC_CSS).toContain(frozen)
    }
  })

  it('sets the overlay in the reading face, tracking included', () => {
    // The running head IS the article's title, in the reading face. With no tracking of its
    // own it inherited the mono-chrome correction from body and set a book serif at
    // -0.05em: -0.7px a character, which is what "the letters are too close" was.
    expect(PUBLIC_CSS).toContain('font-family:var(--font-reading);letter-spacing:var(--ls-body)')
    expect(MONO_TRACKING).not.toContain('.book-title')
    expect(MONO_TRACKING).not.toContain('.book-count')
  })
})

describe('the IDE chrome is one switch, and off leaves no trace', () => {
  // The owner's brief: the furniture reads as source code while the reading column stays
  // analogue. The contrast IS the design, which also makes it a taste — so it is a switch,
  // and every rule behind it hangs off one attribute selector.
  /** Only the lines the switch owns — never the base sheet's, which say different things. */
  const idelines = () =>
    PUBLIC_CSS.split('\n').filter((l) => l.includes('data-ide-chrome')).join('\n')

  it('gates every rule on the attribute, so nothing leaks when it is off', () => {
    const ide = PUBLIC_CSS.split('\n').filter((l) => l.includes('data-ide-chrome'))
    expect(ide.length).toBeGreaterThan(8)
    // A rule that mentions the attribute in a comment but selects without it would apply
    // unconditionally. Every declaration line must carry the selector.
    for (const line of ide) expect(line).toContain('html[data-ide-chrome=on]')
  })

  it('never touches the reading column', () => {
    // The half that must NOT look technical: the article body, its title, the card
    // excerpts and the comment bodies are the reader's own words.
    for (const line of PUBLIC_CSS.split('\n').filter((l) => l.includes('data-ide-chrome'))) {
      for (const reading of ['.prose', '.reading-font', '.deck', '.comment-body', '.fs-h1']) {
        expect(line).not.toContain(reading)
      }
    }
  })

  it('borrows only theme tokens for its two syntax roles, and never the accent', () => {
    // An editor distinguishes a comment from a literal. That is the whole palette here:
    // labels are --c-meta, counts and dates are --c-text. No third colour, and no hex —
    // the same rule the rest of the public site follows.
    //
    // NOT --c-accent, which it was for one deploy. The accent is seeded from each palette's
    // link colour, so on a blog whose accent is red every date and count read as a link
    // that was not one. A syntax colour must not be the colour that means "click me".
    const ide = PUBLIC_CSS.split('\n').filter((l) => l.includes('data-ide-chrome')).join('\n')
    expect(ide).toContain('var(--c-text)')
    expect(ide).toContain('var(--c-meta)')
    expect(ide).not.toContain('var(--c-accent)')
    expect(ide).not.toContain('var(--c-link)')
    expect(ide).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('marks EVERY chrome label, not just the rail\'s', () => {
    // The treatment used to stop at the rail. Everything below it on an article page — the
    // related list, the sign-up card, the comment thread, the series head — is furniture
    // too, and it carried none of the marker, which is what the owner saw: a page that
    // read as source code for two inches and then gave up.
    const ide = idelines()
    for (const label of [
      '.rail h2::before', 'header.site .tagline::before', 'aside.series .series-head::before',
      '.related h2::before', '.subscribe-card h2::before', '#comments h2::before',
      '.empty::before',
    ]) expect(ide).toContain(label)
  })

  it('brackets every literal from the SHEET, so two renderers cannot disagree', () => {
    // The sidebar typed its own parentheses, so the taxonomy read "(7)" three lines under a
    // list that read "[7]". Both pairs come from CSS now — the round ones from the base
    // sheet, the square ones from the switch — which is also what makes it reversible.
    expect(PUBLIC_CSS).toContain('.term-count::before{content:"("}')
    const ide = idelines()
    for (const literal of [
      '.rail-count::before', '.pager-count::before', '.t-small time::before',
      '.comment-meta time::before', '.related p::before', '.num::before',
    ]) expect(ide).toContain(literal)
  })

  it('sets the brackets a shade lighter than the value they hold', () => {
    // They are punctuation, not the value. At the same weight as the digits a meta line
    // reads as a row of boxes rather than as a date followed by two figures.
    expect(idelines()).toContain('.num::before{content:"[";color:var(--c-meta)}')
    expect(idelines()).toContain('.num::after{content:"]";color:var(--c-meta)}')
  })

  it('brackets the rail\'s term counts too, and does not ring them', () => {
    // They were a filled ring for one deploy, on the reasoning that a term cloud has no
    // sequence to punctuate. The owner looked at it and said it was ugly, which settles it —
    // and one bracket for every literal is the simpler rule to hold anyway.
    expect(idelines()).toContain('.term-count::before')
    // The whole of what the switch does to it: lift the base sheet's .6 opacity. Anything
    // more and the ring is back. (`border-radius:50%` alone is no test — the feed's dots and
    // the index's line numbers are circles too.)
    const block = /html\[data-ide-chrome=on] \.term-count\{[^}]*}/.exec(PUBLIC_CSS)?.[0] ?? ''
    expect(block).toBe('html[data-ide-chrome=on] .term-count{opacity:1}')
  })

  it('marks the info panel\'s one ACTION, and leaves the comment invitation alone', () => {
    // Book mode is the only row in the panel that does something rather than states
    // something, so it takes the label's marker. "Be the first to comment" is an invitation
    // to the reader rather than a label on a section, and the owner asked for it bare.
    const ide = idelines()
    expect(ide).toContain('.info-action::before')
    expect(ide).toContain('#comments .empty::before{content:none}')
  })

  it('swaps the header icons for tokens, and puts BOTH in the markup', () => {
    // The owner's condition, in as many words: this style only applies when the switch is
    // on. So the icons are still there with it off, and the sheet decides which of the two
    // has a box — the same arrangement as the article's info panel.
    const ide = idelines()
    expect(ide).toContain('.icon-btn svg{display:none}')
    expect(ide).toContain('.btn-token{display:inline}')
    expect(PUBLIC_CSS).toContain('.btn-token{display:none;') // ...and OFF is the default
  })

  it('numbers a sub-heading within its parent, not straight through the list', () => {
    // counter-SET, not counter-reset: a reset on the parent row creates a new instance
    // scoped to that row and its siblings, and the children went on reading the outer one.
    // Measured before the fix, the index ran 1.1 1.2 2.3 2.4 2.5 3.6.
    const ide = idelines()
    expect(ide).toContain('counter-increment:h2;counter-set:h3 0')
    expect(ide).toContain('content:counter(h2) "." counter(h3)')
    // A child is a path segment, so it takes the slash and drops the smaller size.
    expect(ide).toContain('.rail-sub::before{content:"/"')
  })

  it('gives the archive year a path mark rather than brackets', () => {
    // The feed's right gutter is a year over its months: a path, not a count. Brackets mean
    // "index" everywhere else here, and using them for a directory would say the wrong
    // thing in the one place the site already has a hierarchy to show.
    expect(idelines()).toContain('.tl-year-tag::after{content:"/"')
  })
})

describe('the page reads like a set book', () => {
  it('reshapes each local fallback to the reading face\'s own measurements', () => {
    // The numbers are measured by scripts/ops/font-fallback-metrics.py from the shipped
    // woff2 subsets against the local face's tables — rerun it when a font file is
    // re-dropped. What this pins is the CONTRACT: every text family declares a metric
    // -matched twin, the twin rides in its stack right behind the primary name, and the
    // swap therefore changes glyphs without moving a line break.
    const { fontFaceCss } = require('@/render/font-faces') as
      typeof import('@/render/font-faces')
    for (const [id, family, local] of [
      ['inter', 'Inter', 'Arial'],
      ['source-sans', 'Source Sans 3', 'Arial'],
      ['literata', 'Literata', 'Georgia'],
      ['source-serif', 'Source Serif 4', 'Georgia'],
    ] as const) {
      const css = fontFaceCss(id, 'inter')
      expect(css).toContain(`font-family:'${family} Fallback';src:local('${local}')`)
      expect(css).toMatch(new RegExp(`'${family} Fallback';[^}]*size-adjust:\\d`))
      expect(css).toMatch(new RegExp(`'${family} Fallback';[^}]*ascent-override:\\d`))
      expect(css).toMatch(new RegExp(`'${family} Fallback';[^}]*descent-override:\\d`))
      expect(getFontPreset(id).stack).toContain(`'${family} Fallback'`)
    }
    // The monos carry none on purpose: their files only download on pages with code.
    expect(fontFaceCss('inter', 'jetbrains-mono')).not.toContain(`JetBrains Mono Fallback`)
  })

  it('hangs opening punctuation into the margin, except in code', () => {
    expect(PUBLIC_CSS).toContain('hanging-punctuation:first last')
    expect(PUBLIC_CSS).toContain('.prose pre{hanging-punctuation:none}')
  })

  it('refuses the hyphen breaks a compositor would refuse', () => {
    expect(PUBLIC_CSS).toContain('hyphenate-limit-chars:6 3 3')
    expect(PUBLIC_CSS).toContain('-webkit-hyphenate-limit-before:3')
    expect(PUBLIC_CSS).toContain('-webkit-hyphenate-limit-after:3')
  })
})
