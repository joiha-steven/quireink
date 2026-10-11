// The structural rules of theme.css: only contract names in selectors (S1), both surfaces
// styled (S2), only the four at-rules and no code-running properties (A1), URLs only into the
// package (A2), no syntax a browser would repair or drop (X1), and the size ceiling (A5).
import { describe, expect, it } from 'bun:test'
import { checkThemeCss } from '@/theme/check-css'
import { brief, check, CONTRACT, PACKAGE_FILES } from '@/theme/test-fixtures'

describe('S1: selectors name only what the contract promises', () => {
  it('accepts contract classes, ids and data attributes, free tags and other attributes', () => {
    expect(check([
      '.post-list > li a[href^="http"]:hover {}',
      '#comments .x[data-palette="sepia"] {}',
      'html[lang] :is(.prose, .site-header) p::first-line {}',
      '[DATA-LOOK] details[open] summary {}',
      '.post [class~="x"] [id=main] {}',
    ].join('\n'))).toEqual([])
  })

  it('refuses an unknown class, id or data attribute, with its position', () => {
    expect(brief(check('.post .secret {}\n#admin {}\n[data-user] {}'))).toEqual([
      'S1 1:7 .secret', 'S1 2:1 #admin', 'S1 3:1 [data-user]',
    ])
  })

  it('looks inside every functional pseudo-class, at any depth', () => {
    expect(brief(check('.post:has(:not(.y)) {}\n:where(.x, :is(#z)) {}\nli:nth-child(2 of .w) {}'))).toEqual([
      'S1 1:16 .y', 'S1 2:16 #z', 'S1 3:19 .w',
    ])
  })

  it('applies inside @media, @supports and @container', () => {
    expect(brief(check('@media (min-width: 40em) { @supports (display: grid) { .q {} } }\n@container (width > 1px) { .r {} }')))
      .toEqual(['S1 1:56 .q', 'S1 2:28 .r'])
  })

  it('reads escaped names decoded, as the browser matches them', () => {
    expect(check('.\\70 ost {}')).toEqual([])
    expect(brief(check('.\\73 ecret {}'))).toEqual(['S1 1:1 .\\73 ecret'])
  })

  it('refuses substring matches on class or id, which reach names nobody promised', () => {
    expect(brief(check('[class*="post"] {}\n[id^=c] {}\n[class~="nope"] {}'))).toEqual([
      'S1 1:1 [class*="post"]', 'S1 2:1 [id^=c]', 'S1 3:1 [class~="nope"]',
    ])
  })
})

describe('S2: both surfaces are styled', () => {
  it('accepts a sheet with a blog rule and a front-page rule, at any nesting', () => {
    expect(checkThemeCss('@media print { .post-list a {} }\n:is(.fc-title) {}', CONTRACT, PACKAGE_FILES)).toEqual([])
  })

  it('refuses a sheet that styles only one, once per missing surface, unplaced', () => {
    expect(brief(checkThemeCss('.post {}', CONTRACT, PACKAGE_FILES))).toEqual(['S2 0:0 front'])
    expect(brief(checkThemeCss('.prose {}', CONTRACT, PACKAGE_FILES))).toEqual(['S2 0:0 blog', 'S2 0:0 front'])
  })

  it('does not count keyframe selectors or at-rule preludes', () => {
    expect(brief(checkThemeCss('@supports selector(.fc) { @keyframes k { from {} } }\n.post {}', CONTRACT, PACKAGE_FILES)))
      .toEqual(['S2 0:0 front'])
  })
})

describe('A1: only @media, @supports, @container, @keyframes; no code-running CSS', () => {
  it('accepts the four at-rules', () => {
    expect(check('@media screen { @supports (gap: 1em) { @container (width > 1em) { .post {} } } }\n@keyframes fade { from { opacity: 0 } 50% { opacity: .5 } }'))
      .toEqual([])
  })

  it('refuses every other at-rule, nested or not', () => {
    expect(brief(check([
      '@import "x.css";',
      '@font-face { font-family: x }',
      '@layer base;',
      '@media screen { @property --t-x { syntax: "*" } }',
      '@-webkit-keyframes k {}',
      '@charset "utf-8";',
    ].join('\n')))).toEqual([
      'A1 1:1 @import "x.css"', 'A1 2:1 @font-face', 'A1 3:1 @layer base',
      'A1 4:17 @property --t-x', 'A1 5:1 @-webkit-keyframes k', 'A1 6:1 @charset "utf-8"',
    ])
  })

  it('refuses behavior, -moz-binding and expression()', () => {
    expect(brief(check('.post{behavior:url(x.htc);-moz-binding:none;width:expression(alert(1))}'))).toEqual([
      'A1 1:7 behavior', 'A2 1:16 url(x.htc)', 'A1 1:27 -moz-binding', 'A1 1:51 expression(alert(1))',
    ])
  })

  it('refuses attr() outside generated content', () => {
    expect(brief(check('.post{width:attr(data-w px)}'))).toEqual(['A1 1:13 attr(data-w px)'])
  })
})

describe('A2: URLs point into the package', () => {
  it('accepts a package file, quoted, unquoted, in image-set and src()', () => {
    expect(check([
      '.post{background:url(images/paper.webp)}',
      '.post{background:url( "images/paper.webp" )}',
      '.post{background:image-set("images/paper.webp" 1x, url(images/paper.webp) 2x)}',
      '.post{background:src("images/paper.webp")}',
    ].join('\n'))).toEqual([])
  })

  it('refuses a file not in the package, remote, data:, rooted or climbing', () => {
    expect(brief(check([
      '.post{background:url(images/missing.webp)}',
      '.post{background:url(https://e.example/x.png)}',
      '.post{background:url("data:image/png;base64,AAAA")}',
      '.post{background:url(/images/paper.webp)}',
      '.post{background:url(images/../theme.json)}',
    ].join('\n')))).toEqual([
      'A2 1:18 url(images/missing.webp)', 'A2 2:18 url(https://e.example/x.png)',
      'A2 3:18 url("data:image/png;base64,AAAA")', 'A2 4:18 url(/images/paper.webp)',
      'A2 5:18 url(images/../theme.json)',
    ])
  })

  it('refuses a URL a variable could choose', () => {
    expect(brief(check('.post{background:src(var(--t-u))}\n.post{background:image-set(var(--t-u) 1x)}'))).toEqual([
      'A2 1:18 src(var(--t-u))', 'A2 2:28 var(--t-u)',
    ])
  })

  it('refuses a path that is in the package list but is not a safe shape', () => {
    expect(brief(check('.post{background:url("images/a b.png")}'))).toEqual(['A2 1:18 url("images/a b.png")'])
  })
})

describe('X1: syntax a browser would repair or drop', () => {
  it('accepts a sheet whose blocks all close', () => {
    expect(check('.post { color: var(--c-text); }\n@media print { .post { margin: 0 } }')).toEqual([])
  })

  it('refuses a block left open and a closer with nothing to close', () => {
    expect(brief(checkThemeCss('.post{color:var(--c-text)\n.fc{}', CONTRACT, PACKAGE_FILES))).toContain('X1 1:6 {')
    expect(brief(check('.post{})'))).toContain('X1 1:8 )')
  })

  it('refuses CSS nesting, in every form', () => {
    expect(brief(check('.post{color:var(--c-text);.x{}}\n.post{&:hover{}}\n.post{a:hover{}}\n.post{@media print{}}'))).toEqual([
      'X1 1:27 .x{}', 'X1 2:7 &:hover{}', 'X1 3:7 a:hover{}', 'X1 4:7 @media print{}',
    ])
  })

  it('refuses a declaration with no colon, and a rule with no block', () => {
    expect(brief(check('.post{color var(--c-text)}'))).toEqual(['X1 1:7 color var(--c-text)'])
    expect(brief(checkThemeCss('.post{}\n.fc{}\n.post', CONTRACT, PACKAGE_FILES))).toEqual(['X1 3:1 .post'])
  })
})

describe('A5: theme.css is at most 64 KB', () => {
  it('accepts exactly 65,536 bytes and refuses one more, counting UTF-8 bytes', () => {
    const base = '.post{}.fc{}/*'
    const pad = (n: number) => `${base}${'x'.repeat(n - base.length - 2)}*/`
    expect(checkThemeCss(pad(65536), CONTRACT, PACKAGE_FILES)).toEqual([])
    expect(brief(checkThemeCss(pad(65537), CONTRACT, PACKAGE_FILES))).toEqual(['A5 0:0 65537'])
    // 21,846 three-byte characters plus the comment marks: 65,542 bytes in 21,850 UTF-16 units.
    expect(brief(checkThemeCss(`/*${'ạ'.repeat(21846)}*/`, CONTRACT, PACKAGE_FILES))).toEqual(['A5 0:0 65542'])
  })
})
