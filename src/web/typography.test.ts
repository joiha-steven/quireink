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
    // The weight became a variable on 2026-08-29 (Appearance -> Shape -> headline weight).
    // Asserting the whole declaration keeps BOTH halves of the claim: this block is told
    // apart by weight, and the default weight is still the 600 it always was.
    expect(rule).toContain('font-weight:var(--fw-heading,600)')
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
  // 2026-08-21, as slightly too large by default, to x1.05 — with the A-/A+ control an
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
    // `--density` joined the same declaration on 2026-08-29, and it had to join THIS one:
    // a var() inside a custom property resolves where the property is declared, so a
    // density read anywhere else would bake in :root's value and the knob would do nothing.
    // The claim under test is unchanged — one definition, emitted in exactly two places.
    expect(css).toContain('--sp:calc(1rem * var(--type-scale, 1) * var(--density, 1))')
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
      // The table cell, and the claim is unchanged: its padding is still spent in --sp, so it
      // still scales with the reader's type and with book mode. `--tbl-pad` multiplies in on
      // top (settings/table, 2026-08-29) and defaults to 1, so a blog that never opens that
      // card gets the identical number this line has always asserted.
      'padding:calc(var(--sp) * .4 * var(--tbl-pad, 1)) calc(var(--sp) * .6 * var(--tbl-pad, 1))',
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

  it('carries a twin for a device that has neither Georgia nor Arial', () => {
    // Android has neither, and for two months that meant this whole mechanism was a
    // desktop-only feature: `local()` missed, the adjusted twin never matched, and the
    // page fell through to an unadjusted `serif`. Measured at 390px on the demo, the
    // document stood 531px shorter during the swap and then dropped everything below the
    // fold. So the SECOND name in every stack must resolve on Android — its `serif` is
    // Noto Serif, its `sans-serif` is Roboto — and it must carry its OWN numbers, because
    // one size-adjust cannot describe two local faces of different width.
    const { fontFaceCss } = require('@/render/font-faces') as
      typeof import('@/render/font-faces')
    for (const [id, family, android] of [
      ['inter', 'Inter', 'Roboto'],
      ['source-sans', 'Source Sans 3', 'Roboto'],
      ['literata', 'Literata', 'Noto Serif'],
      ['source-serif', 'Source Serif 4', 'Noto Serif'],
    ] as const) {
      const css = fontFaceCss(id, 'inter')
      expect(css).toContain(`font-family:'${family} Fallback 2';src:local('${android}')`)
      // Its own numbers, not a copy of the desktop twin's.
      const desktop = css.match(new RegExp(`'${family} Fallback';[^}]*size-adjust:([\\d.]+)%`))?.[1]
      const droid = css.match(new RegExp(`'${family} Fallback 2';[^}]*size-adjust:([\\d.]+)%`))?.[1]
      expect(desktop).toBeDefined()
      expect(droid).toBeDefined()
      expect(droid).not.toBe(desktop)
      // And it has to be REACHED: a face nothing names is a face nothing uses, which is
      // exactly how the desktop-only version passed every test it had.
      const stack = getFontPreset(id).stack
      expect(stack).toContain(`'${family} Fallback 2'`)
      expect(stack.indexOf(`'${family} Fallback'`)).toBeLessThan(stack.indexOf(`'${family} Fallback 2'`))
      // Ahead of the generic, or the generic wins and the adjustment is skipped.
      const generic = Math.max(stack.indexOf('sans-serif'), stack.lastIndexOf('serif'))
      expect(stack.indexOf(`'${family} Fallback 2'`)).toBeLessThan(generic)
    }
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
