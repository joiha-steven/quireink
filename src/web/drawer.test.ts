// The mobile sidebar must not pan sideways.
//
// This is a CSS test rather than a page test because the defect was not in any page: the
// drawer measured 299px of box against 331px of content on every phone, and nothing in the
// markup was wrong. Two separate mistakes had to line up for it, so there are two assertions.
//
// 1. `.rail` sets `overflow-y:auto` for a long index. A box that names ONE axis and leaves
//    the other alone does not get `visible` on the other: the used value computes to `auto`.
//    So the drawer was a horizontal scroller by accident, waiting for anything to be a pixel
//    too wide.
// 2. The IDE chrome then supplied that pixel. Its line-number ring hangs 23px outside the
//    row, on the gutter rail's divider hairline, and `.rail-inner` was widened by 32px and
//    padded back so the gutter's own `overflow-y:auto` could not clip it. Both of those are
//    facts about the DESKTOP rail. Ungated, they applied to a drawer that has no divider and
//    no inner scroller, and made it 32px too wide.

import { describe, expect, it } from 'bun:test'
import { PUBLIC_CSS } from '@/web/public.css'
import { IDE_CSS } from '@/web/ide.css'

describe('the mobile rail drawer', () => {
  it('names overflow-x explicitly, so overflow-y cannot make it scroll sideways', () => {
    // Matched on the mobile `.rail` block specifically: the gutter rules in rail-css.ts set
    // `overflow:visible` on the same class above the breakpoint, and that one is correct.
    const rule = PUBLIC_CSS.match(/\.rail\{position:fixed;[^}]+\}/)
    expect(rule).not.toBeNull()
    expect(rule?.[0]).toContain('overflow-y:auto')
    expect(rule?.[0]).toContain('overflow-x:hidden')
  })
})

describe('the IDE chrome rail', () => {
  // Everything that positions something outside a rail row, or widens the rail to make room
  // for it, belongs to the gutter. Below the breakpoint the rail is a drawer and there is no
  // gutter to hang anything in.
  const GUTTER_ONLY = [
    'html[data-ide-chrome=on] .rail-inner{width:calc(100% + 24px);padding-right:24px}',
    'html[data-ide-chrome=on] .toc .rail-inner{width:calc(100% + 32px);padding-right:32px}',
  ]

  it.each(GUTTER_ONLY)('keeps %s inside a min-width media query', (rule) => {
    const at = IDE_CSS.indexOf(rule)
    expect(at).toBeGreaterThan(-1)

    // Walk the braces from the top of the sheet to the rule and check we are still inside a
    // media block when we arrive. Counting `{` and `}` is enough here because these sheets
    // carry no brace inside a string or a comment, which `check:css-literal` also relies on.
    const before = IDE_CSS.slice(0, at)
    const opened = (before.match(/@media \(min-width:\d+px\)\{/g) ?? []).length
    expect(opened).toBeGreaterThan(0)

    const depth = (before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length
    expect(depth).toBeGreaterThan(0)
  })

  it('touches .rail-inner ONLY from inside a media block, wherever that rule is added', () => {
    // The property, not the two rules above: any future rule that reaches for `.rail-inner`
    // is reaching for the gutter, and must be gated. Stated as "every occurrence sits at
    // brace depth > 0" so it holds for rules nobody has written yet.
    //
    // The first draft of this test compared against `IDE_CSS.split(@media)[0]`, which covers
    // only the sheet ABOVE its first media block — and the rail rules live below it, so the
    // assertion passed with the bug present and could never have gone red.
    // Comments come out first. These sheets are commented the way the code is, so the prose
    // names the very selectors it explains — the first run of this test flagged the comment
    // that documents the fix — and a stray brace in a sentence would skew the depth count.
    const css = IDE_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    const ungated: string[] = []
    for (const match of css.matchAll(/\.rail-inner/g)) {
      const before = css.slice(0, match.index)
      const depth = (before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length
      if (depth === 0) ungated.push(css.slice(match.index, match.index + 60))
    }
    expect(ungated).toEqual([])
  })
})

// The two marks in the header, and which of them shows.
//
// `logoDark` is opt-in and no instance had ever set one, so the pair of rules that swaps
// them had never rendered anywhere. The dark twin is `class="logo logo-dark"`, so the rule
// hiding the light mark in dark mode matched BOTH — and at (0,6,2) against the show rule's
// (0,3,2) it won. A site that uploaded a dark logo got no logo at all in dark mode.
//
// Asserted on the SHEET rather than on a rendered page because the failure is a cascade
// result, and `bun test` has no cascade. The proof is the selector: the hide rule has to
// exclude the twin by name.
describe('the header logo pair', () => {
  it('hides only the LIGHT mark in dark mode, never the dark twin', () => {
    expect(PUBLIC_CSS).toContain('html.dark header.site .title:has(.logo-dark) .logo:not(.logo-dark){display:none}')
  })

  it('shows the dark twin in dark mode and hides it everywhere else', () => {
    expect(PUBLIC_CSS).toContain('header.site .logo-dark{display:none}')
    expect(PUBLIC_CSS).toContain('html.dark header.site .logo-dark{display:block}')
  })
})
