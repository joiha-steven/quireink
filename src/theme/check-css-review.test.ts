// Cases from the security review of the stylesheet checker, each one a sheet the checker
// accepted before the fix: vendor-prefixed text properties, spelling with counters and
// letter-shaped symbols, size properties beside font-size, variables read without var(), and
// hostile sheets that produced tens of thousands of findings in seconds.
import { describe, expect, it } from 'bun:test'
import { checkThemeCss } from '@/theme/check-css'
import { MAX_FINDINGS } from '@/theme/findings'
import { brief, check, CONTRACT, PACKAGE_FILES, rulesOf } from '@/theme/test-fixtures'

describe('vendor prefixes do not step around a rule', () => {
  it('holds -webkit- text properties to S3', () => {
    expect(brief(check('.post{-webkit-hyphenate-character:"Buy now"}\n.post{-webkit-text-emphasis-style:"B";-webkit-text-emphasis:"Buy"}')))
      .toEqual(['S3 1:35 "Buy now"', 'S3 2:35 "B"', 'S3 2:61 "Buy"'])
  })

  it('holds prefixed size and code properties to T1 and A1', () => {
    expect(rulesOf(check('html{-webkit-text-size-adjust:300%}\n.post{-ms-behavior:none;-moz-binding:none}'))).toEqual(['T1', 'A1', 'A1'])
  })
})

describe('S3: counters and symbols cannot spell', () => {
  it('accepts digit and symbol counter styles', () => {
    expect(check('.post::before{content:counter(a) counter(b, decimal-leading-zero) counters(c, ".", decimal) counter(d, disc)}'))
      .toEqual([])
  })

  it('refuses alphabetic counter styles, symbols() and a style held in a variable', () => {
    expect(brief(check([
      '.post{counter-reset:a 8 b 9}.post::before{content:counter(a, upper-alpha) counter(b, upper-alpha)}',
      '.post::before{content:counters(x, ".", lower-greek)}',
      '.post::before{content:counter(x, symbols(cyclic "1"))}',
      '.post::before{content:counter(x, var(--t-style))}',
    ].join('\n')))).toEqual([
      'S3 1:51 counter(a, upper-alpha)', 'S3 1:75 counter(b, upper-alpha)',
      'S3 2:23 counters(x, ".", lower-greek)', 'S3 3:23 counter(x, symbols(cyclic "1"))',
      'S3 4:23 counter(x, var(--t-style))', 'S3 4:34 var(--t-style)',
    ])
  })

  it('refuses alphabetic list markers, and a marker style in a variable', () => {
    expect(check('ol{list-style:decimal inside}\nul{list-style-type:square}')).toEqual([])
    expect(brief(check('ol{list-style-type:upper-alpha}\nol{list-style:lower-latin outside}\nol{list-style-type:var(--t-m)}'))).toEqual([
      'S3 1:20 upper-alpha', 'S3 2:15 lower-latin', 'S3 3:20 var(--t-m)',
    ])
  })

  it('refuses letter-shaped symbols and non-ASCII digits, keeps ASCII digits and arrows', () => {
    expect(check('.post::before{content:"1. \\2192 \\2022"}')).toEqual([])
    for (const s of ['ⒽⒺⓁ', '\u{1F171}\u{1F184}', '\u{1D400}', '㊀', '٣', '²']) {
      expect(rulesOf(check(`.post::before{content:"${s}"}`))).toEqual(['S3'])
    }
  })

  it('refuses alt text after the slash', () => {
    expect(brief(check('.post::before{content:"" / "Hello"}'))).toEqual(['S3 1:28 "Hello"'])
  })
})

describe('T1: no other way to resize text', () => {
  it('refuses zoom, text-size-adjust and font-size-adjust', () => {
    expect(brief(check('body{zoom:3}\nhtml{text-size-adjust:300%}\nbody{font-size-adjust:3}'))).toEqual([
      'T1 1:6 zoom:3', 'T1 2:6 text-size-adjust:300%', 'T1 3:6 font-size-adjust:3',
    ])
  })
})

describe('V1: no variable read without var()', () => {
  it('refuses inherit() and if()', () => {
    expect(brief(check('.post{color:inherit(--secret-engine-var)}\n.post{color:if(style(--x: 1): var(--c-text); else: var(--c-bg))}')))
      .toEqual(['V1 1:13 inherit(--secret-engine-var)', 'V1 2:13 if(style(--x: 1): var(--c-text); else: var(--c-bg))'])
  })
})

describe('X1: rules a browser reads that the checker would not', () => {
  it('refuses a custom property whose block is not its whole value, which browsers re-read as a nested rule', () => {
    expect(brief(check('.post{--t-x:is(*), body{font-size:40px;font-family:Papyrus}}'))).toEqual([
      'X1 1:7 --t-x:is(*), body{font-size:40px;font-family:Papyrus}',
    ])
    expect(check('.post{--t-x:{}; color:var(--c-text)}')).toEqual([])
  })

  it('refuses a keyframe selector that is not from, to, a percentage or a timeline range', () => {
    expect(check('@keyframes k{from{opacity:0}50%,to{opacity:1}entry 10%{opacity:1}}')).toEqual([])
    expect(brief(check('@keyframes k{.evil{color:var(--c-text)}}'))).toEqual(['X1 1:14 .evil'])
  })

  it('refuses <!-- inside a group, where it is part of a selector', () => {
    expect(brief(check('@media all{<!-- .post{color:var(--c-text)}}'))).toEqual(['X1 1:12 <!-- .post'])
  })
})

describe('hostile sheets end quickly with at most 200 findings', () => {
  const N = 65536
  const cases: [string, string][] = [
    ['64 KB of }', '}'.repeat(N)],
    ['64 KB of .y on one line', `${'.y'.repeat(N / 2 - 1)}{}`],
    ['64 KB of hex on one line', `.post{color:${'#0 '.repeat(21840)}}`],
    ['64 KB of empty rules', '.y{}'.repeat(N / 4)],
  ]
  for (const [name, css] of cases) {
    it(`${name}: under 200 ms, capped, the cap reported last`, () => {
      const t = performance.now()
      const out = checkThemeCss(css, CONTRACT, PACKAGE_FILES)
      expect(performance.now() - t).toBeLessThan(200)
      expect(out.length).toBe(MAX_FINDINGS + 1)
      expect(out[out.length - 1]).toEqual({ rule: 'X1', file: 'theme.css', line: 0, col: 0, subject: 'truncated' })
    })
  }

  it('does not add the cap marker below the cap', () => {
    expect(rulesOf(checkThemeCss('.y{}', CONTRACT, PACKAGE_FILES))).toEqual(['S2', 'S2', 'S1'])
  })
})

describe('second review: the remaining ways around C1 and S3', () => {
  it('refuses a channel that reaches a constant through alpha or a variable inside calc()', () => {
    expect(rulesOf(check([
      '.post{--t-l:.6;color:oklch(from var(--c-bg) calc(alpha * var(--t-l)) c h)}',
      '.post{color:rgb(from var(--c-bg) calc(alpha*255) calc(alpha*0) calc(alpha*0))}',
      '.post{color:oklch(from var(--c-bg) l c calc(h*0 + var(--t-h)))}',
    ].join('\n')))).toEqual(['C1', 'C1', 'C1'])
  })

  it('still accepts alpha after the slash', () => {
    expect(check('.post{color:oklch(from var(--c-bg) calc(l*.72) c h / calc(alpha*.5))}')).toEqual([])
  })

  it('holds any vendor prefix to the same rules, -epub- included', () => {
    expect(rulesOf(check('.post{-epub-text-emphasis-style:"BUY"}'))).toEqual(['S3'])
  })

  it('refuses the roman counter styles, which spell with I V X L C D M', () => {
    expect(rulesOf(check('.post::before{content:counter(a, upper-roman)}\nol{list-style-type:lower-roman}'))).toEqual(['S3', 'S3'])
  })

  it('refuses letterlike symbols and braille in content', () => {
    expect(rulesOf(check('.post::before{content:"\\2121"}\n.post::after{content:"\\2813\\2811\\2807\\2807\\2815"}'))).toEqual(['S3', 'S3'])
  })
})
