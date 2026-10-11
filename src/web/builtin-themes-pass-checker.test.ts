// The built-in themes pass the checker a stranger's theme must pass (ADR 0072, decision 6).
//
// Run on the bytes a reader is sent (`SERVED_CSS`, minified; the engine wraps them in
// `@layer theme` as it serves them, `web/css-layers.ts`) rather than on the commented source, and
// against the real contract, so what is checked is what is served and what is
// promised. A built-in sheet that needs something the checker refuses is a gap in the standard,
// and the answer is to fix the standard, never to exempt the sheet.
import { describe, expect, it } from 'bun:test'
import { checkThemeCss, type Violation } from '@/theme'
import { themeContract } from '@/content/theme-contract'
import { BUILTIN_THEMES } from '@/content/themes-builtin'
import { SERVED_CSS } from '@/web/served-css'
import { LOOK_CODE_RAIL_ASIDE_CSS, LOOK_CODE_RAIL_BAND_CSS } from '@/web/look-code-rail.css'

const contract = themeContract()
// A built-in sheet ships no package files, so no url() in it can point anywhere.
const NO_FILES: ReadonlySet<string> = new Set()
const brief = (vs: readonly Violation[]) => vs.map((v) => `${v.rule} ${v.line}:${v.col} ${v.subject}`)

describe('the built-in themes pass the theme checker', () => {
  const sheets = BUILTIN_THEMES.flatMap((theme) => (theme.sheet ? [[theme.id, theme.sheet] as const] : []))

  it('covers every built-in theme that links a sheet', () => {
    expect(sheets.map(([id]) => id)).toEqual(['code', 'paper', 'notes'])
  })

  for (const [id, sheet] of sheets) {
    it(`${id}: nothing to report`, () => {
      expect(brief(checkThemeCss(SERVED_CSS[sheet], contract, NO_FILES))).toEqual([])
    })
  }
})

describe("the code theme's rail rules, which do not go through the checker", () => {
  // They live in the registry because each sits inside a media query computed from the
  // blog's column width, which a static sheet cannot know (`look-code-rail.css.ts`). That is
  // the one thing a built-in theme can do that a theme from a zip cannot yet. What they may
  // not do is what no theme may do: write a colour, a size or a family of their own, or
  // `!important`. Selector names and `content` are the registry's business and are not
  // judged here.
  const VALUE_RULES = new Set(['C1', 'T1', 'F1', 'P1'])
  for (const [name, css] of [['band', LOOK_CODE_RAIL_BAND_CSS], ['aside', LOOK_CODE_RAIL_ASIDE_CSS]] as const) {
    it(`${name}: no colour, size or family of its own, no !important`, () => {
      const found = checkThemeCss(css, contract, NO_FILES).filter((v) => VALUE_RULES.has(v.rule))
      expect(brief(found)).toEqual([])
    })
  }

  it('would be caught if one did', () => {
    const bad = 'html[data-look=code] .rail-inner{color:#fff;font-size:12px;font-family:Menlo;margin:0!important}'
    expect(checkThemeCss(bad, contract, NO_FILES).filter((v) => VALUE_RULES.has(v.rule)).map((v) => v.rule).sort())
      .toEqual(['C1', 'F1', 'P1', 'T1'])
  })
})
