// The value rules of theme.css: the owner's palette, sizes and fonts always reach the page
// (C1, T1, F1, P1), generated text comes only from labels (S3), and a theme's own variables
// carry its prefix (V1). Each rule has a value that passes and one that is refused, with the
// position the admin will point at.
import { describe, expect, it } from 'bun:test'
import { NAMED_COLOURS } from '@/theme/css-names'
import { brief, check } from '@/theme/test-fixtures'

describe('C1: no hardcoded colour', () => {
  it('accepts variables, relative colour from a variable, color-mix of variables, transparent, currentcolor', () => {
    expect(check([
      '.post {',
      '  color: var(--c-text);',
      '  border-color: oklch(from var(--c-rule) calc(l - .1) c h);',
      '  background: color-mix(in oklab, var(--c-bg) 80%, transparent);',
      '  outline-color: color-mix(in srgb, rgb(from var(--c-link) r g b / .5), currentColor 20%);',
      '  --t-wash: color-mix(in oklch, var(--c-accent), var(--c-bg));',
      '}',
    ].join('\n'))).toEqual([])
  })

  it('refuses a hex, at its own line and column', () => {
    expect(brief(check('.post {\n  color: #c00;\n}'))).toEqual(['C1 2:10 #c00'])
  })

  it('refuses colour functions written from numbers, in any case', () => {
    expect(brief(check('.post{color:rgb(1 2 3);background:OKLCH(.5 .1 30)}'))).toEqual([
      'C1 1:13 rgb(1 2 3)', 'C1 1:35 OKLCH(.5 .1 30)',
    ])
  })

  it('refuses relative colour whose origin is not a variable', () => {
    expect(brief(check('.post{color:hsl(from red h s l)}'))).toEqual([
      'C1 1:13 hsl(from red h s l)', 'C1 1:22 red',
    ])
  })

  it('accepts relative colour whose every channel is derived from the origin', () => {
    expect(check([
      '.post{color:oklch(from var(--c-bg) calc(l*.72) c h)}',
      '.post{color:hsl(from var(--c-bg) h s min(l, 40%) / 50%)}',
      '.post{color:color(from var(--c-link) srgb r g calc((b + .1) * .5) / .5)}',
      '.post{color:color(from var(--c-link) xyz-d65 x y z)}',
    ].join('\n'))).toEqual([])
  })

  it('refuses relative colour with a channel that ignores the origin', () => {
    expect(brief(check([
      '.post{color:oklch(from var(--c-bg) .5 .2 30)}',
      '.post{color:oklch(from var(--c-bg) calc(.5 + .1) c h)}',
      '.post{color:rgb(from var(--c-bg) r g 0)}',
      '.post{color:color(from var(--c-bg) srgb 1 0 0)}',
      '.post{color:lab(from var(--c-bg) c a b)}',
      '.post{color:oklch(from var(--c-bg) l c none)}',
      '.post{color:rgb(from var(--c-bg) r g)}',
      // A variable as a channel can hold a constant: the review's bypass of the channel rule.
      '.post{--t-l:.6;color:oklch(from var(--c-bg) var(--t-l) c h)}',
    ].join('\n')))).toEqual([
      'C1 1:13 oklch(from var(--c-bg) .5 .2 30)', 'C1 2:13 oklch(from var(--c-bg) calc(.5 + .1) c h)',
      'C1 3:13 rgb(from var(--c-bg) r g 0)', 'C1 4:13 color(from var(--c-bg) srgb 1 0 0)',
      'C1 5:13 lab(from var(--c-bg) c a b)', 'C1 6:13 oklch(from var(--c-bg) l c none)',
      'C1 7:13 rgb(from var(--c-bg) r g)', 'C1 8:22 oklch(from var(--c-bg) var(--t-l) c h)',
    ])
  })

  it('refuses a colour inside color-mix that is not a variable, derived, transparent or currentcolor', () => {
    expect(brief(check('.post{color:color-mix(in srgb, var(--c-text), white)}'))).toEqual(['C1 1:47 white'])
    expect(brief(check('.post{color:color-mix(in srgb, var(--c-text), light-dark(var(--c-bg), var(--c-text)))}')))
      .toEqual(['C1 1:47 light-dark(var(--c-bg), var(--c-text))'])
  })

  it('refuses all 148 named colours and the system colours, in any case', () => {
    expect(NAMED_COLOURS.size).toBe(148)
    expect(brief(check('.post{color:RebeccaPurple;background:Canvas;border-color:-webkit-link}'))).toEqual([
      'C1 1:13 RebeccaPurple', 'C1 1:38 Canvas', 'C1 1:58 -webkit-link',
    ])
  })

  it('refuses a colour hidden in a var() fallback or a theme variable', () => {
    expect(brief(check('.post{color:var(--c-text, #000);--t-ink:navy}'))).toEqual(['C1 1:27 #000', 'C1 1:41 navy'])
  })

  it('leaves names alone where a property takes names, not colours', () => {
    expect(check('.post{animation-name:red;grid-area:menu;counter-reset:tan;content:counter(red)}')).toEqual([])
  })
})

describe('T1: font sizes follow the owner', () => {
  it('accepts --fs-* variables, arithmetic on them, em, % and the global keywords', () => {
    expect(check([
      '.post{font-size:var(--fs-body)}',
      '.post{font-size:calc(var(--fs-h1) * .8)}',
      '.post{font-size:clamp(1em, var(--fs-small), 120%)}',
      '.post{font-size:.62em}',
      '.post{font-size:90%}',
      '.post{font-size:inherit}',
      '.post{font:inherit}',
    ].join('\n'))).toEqual([])
  })

  it('refuses absolute units and size keywords', () => {
    expect(brief(check('.post{font-size:14px}\n.post{font-size:1rem}\n.post{font-size:large}'))).toEqual([
      'T1 1:17 14px', 'T1 2:17 1rem', 'T1 3:17 large',
    ])
  })

  it('refuses arithmetic with an absolute unit or without a --fs-* variable', () => {
    expect(brief(check('.post{font-size:calc(var(--fs-body) + 2px)}\n.post{font-size:calc(1em * 2)}'))).toEqual([
      'T1 1:17 calc(var(--fs-body) + 2px)', 'T1 2:17 calc(1em * 2)',
    ])
  })

  it('refuses a variable that is not a size, and a fallback in px', () => {
    expect(brief(check('.post{font-size:var(--c-text)}\n.post{font-size:var(--fs-body, 16px)}'))).toEqual([
      'T1 1:17 var(--c-text)', 'T1 2:17 var(--fs-body, 16px)',
    ])
  })

  it('refuses the font shorthand unless it is inherit', () => {
    expect(brief(check('.post{\nfont: 700 1em var(--font-sans)}'))).toEqual(['T1 2:1 font: 700 1em var(--font-sans)'])
  })
})

describe('F1: font families follow the owner', () => {
  it('accepts the four family variables and inherit', () => {
    expect(check([
      '.post{font-family:var(--font-reading)}', '.post{font-family:var(--font-sans)}',
      '.post{font-family:var(--font-mono)}', '.post{font-family:var(--font-display)}',
      '.post{font-family:inherit}',
    ].join('\n'))).toEqual([])
  })

  it('refuses a named family, a list, and a variable with a fallback', () => {
    expect(brief(check([
      '.post{font-family:Georgia}',
      '.post{font-family:var(--font-sans),serif}',
      '.post{font-family:var(--font-sans, Arial)}',
    ].join('\n')))).toEqual([
      'F1 1:19 Georgia', 'F1 2:19 var(--font-sans),serif', 'F1 3:19 var(--font-sans, Arial)',
    ])
  })
})

describe('P1: no !important', () => {
  it('accepts a declaration without it', () => {
    expect(check('.post{color:var(--c-text)}')).toEqual([])
  })

  it('refuses it in any spelling, with whitespace, comments or escapes between', () => {
    expect(brief(check([
      '.post{color:var(--c-text)!important}',
      '.post{color:var(--c-text) ! /*x*/ IMPORTANT}',
      '.post{--t-a:1 !\\69mportant}',
    ].join('\n')))).toEqual(['P1 1:26 !important', 'P1 2:27 ! /*x*/ IMPORTANT', 'P1 3:15 !\\69mportant'])
  })
})

describe('S3: no words in generated content', () => {
  it('accepts counters, label variables, quotes keywords and symbol-only strings', () => {
    expect(check([
      '.post::before{content:counter(h2) "." counter(h3)}',
      '.post::after{content:var(--l-figure) " " counter(fig) ". "}',
      '.post::before{content:open-quote}',
      '.post::before{content:"\\2192 // []"}',
      '.post::before{content:none}',
    ].join('\n'))).toEqual([])
  })

  it('refuses a string holding a letter, in any script', () => {
    expect(brief(check('.post::before{content:"Hình "}\n.post::before{content:"\\41"}'))).toEqual([
      'S3 1:23 "Hình "', 'S3 2:23 "\\41"',
    ])
  })

  it('refuses attr() and any variable but a --l-* label', () => {
    expect(brief(check('.post::before{content:attr(title)}\n.post::before{content:var(--t-label)}'))).toEqual([
      'S3 1:23 attr(title)', 'S3 2:23 var(--t-label)',
    ])
  })

  it('holds the other properties that print text, and theme variables, to the same rule', () => {
    expect(brief(check('.post{quotes:"Hi" "!"}\n.post{list-style-type:"Note: "}\n.post{--t-x:"Words"}'))).toEqual([
      'S3 1:14 "Hi"', 'S3 2:23 "Note: "', 'S3 3:13 "Words"',
    ])
  })
})

describe('V1: a theme names its own variables --t-*', () => {
  it('accepts --t-* declared and read, --l-* read, and contract variables read', () => {
    expect(check('.post{--t-gap:1em;margin:var(--t-gap);color:var(--c-meta)}\n.post::before{content:var(--l-table)}'))
      .toEqual([])
  })

  it('refuses declaring a variable without the prefix, an engine one included', () => {
    expect(brief(check('.post{--gap:1em;--c-bg:var(--c-text)}'))).toEqual(['V1 1:7 --gap', 'V1 1:17 --c-bg'])
  })

  it('refuses reading a variable outside the contract, including in a fallback', () => {
    expect(brief(check('.post{margin:var(--rail-gap)}\n.post{color:var(--c-text, var(--secret))}'))).toEqual([
      'V1 1:14 var(--rail-gap)', 'V1 2:27 var(--secret)',
    ])
  })

  it('treats custom property names as case-sensitive', () => {
    expect(brief(check('.post{--T-gap:1em}'))).toEqual(['V1 1:7 --T-gap'])
  })
})
