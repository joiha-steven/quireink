// Hostile stylesheets. Each case is a way to say something the checker refuses in words the
// checker might not recognise: escapes, case, comments, nesting, truncation. The browser
// decodes all of them, so the checker must too.
import { describe, expect, it } from 'bun:test'
import { checkThemeCss } from '@/theme/check-css'
import { brief, check, CONTRACT, PACKAGE_FILES, rulesOf } from '@/theme/test-fixtures'

describe('URL spelled to slip past a text search', () => {
  it('refuses url( written with escapes in its name', () => {
    expect(brief(check('.post{background:u\\72l(https://e.example/x)}\n.post{background:\\75 rl(//e.example/x)}')))
      .toEqual(['A2 1:18 u\\72l(https://e.example/x)', 'A2 2:18 \\75 rl(//e.example/x)'])
  })

  it('refuses URL( in capitals, quoted and not', () => {
    expect(rulesOf(check('.post{background:URL(https://e.example/x)}\n.post{background:URL("https://e.example/x")}')))
      .toEqual(['A2', 'A2'])
  })

  it('refuses src() and -webkit-image-set() spelled with escapes or capitals', () => {
    expect(rulesOf(check('.post{background:\\73rc("https://e.example")}\n.post{background:-WEBKIT-image-set("//e.example/a.png" 1x)}')))
      .toEqual(['A2', 'A2'])
  })

  it('refuses data:, javascript: and protocol-relative targets', () => {
    expect(brief(check([
      '.post{background:url(data:image/svg+xml,%3Csvg%3E)}',
      ".post{background:url('javascript:alert(1)')}",
      '.post{background:url(//evil.example/x.png)}',
    ].join('\n')))).toEqual([
      'A2 1:18 url(data:image/svg+xml,%3Csvg%3E)', "A2 2:18 url('javascript:alert(1)')",
      'A2 3:18 url(//evil.example/x.png)',
    ])
  })

  it('refuses an unquoted javascript: url, which the tokenizer reads as a bad url', () => {
    expect(rulesOf(check('.post{background:url(javascript:alert(1))}'))).toContain('X1')
  })

  it('refuses a backslash, percent-encoded dots, a query and a drive letter in a target', () => {
    expect(rulesOf(check([
      '.post{background:url(images\\5c paper.webp)}',
      '.post{background:url(images/%2e%2e/theme.json)}',
      '.post{background:url(images/paper.webp?v=1)}',
      '.post{background:url(C:/images/paper.webp)}',
      '.post{background:url(\\2f images/paper.webp)}',
    ].join('\n')))).toEqual(['A2', 'A2', 'A2', 'A2', 'A2'])
  })
})

describe('at-rules spelled to slip past a text search', () => {
  it('refuses @IMPORT and @\\69mport', () => {
    expect(brief(check('@IMPORT "x.css";\n@\\69mport url(images/paper.webp);'))).toEqual([
      'A1 1:1 @IMPORT "x.css"', 'A1 2:1 @\\69mport url(images/paper.webp)',
    ])
  })

  it('refuses @font-face hidden inside an allowed group', () => {
    expect(brief(check('@media screen{@supports (x:y){@FONT-FACE{src:url(fonts/body.woff2)}}}'))).toEqual([
      'A1 1:31 @FONT-FACE',
    ])
  })
})

describe('!important and colour spelled to slip past a text search', () => {
  it('refuses !important split by a comment and in capitals', () => {
    expect(rulesOf(check('.post{color:var(--c-text)!/**/IMPORTANT}'))).toEqual(['P1'])
  })

  it('refuses a hex inside nested @media and @supports', () => {
    expect(brief(check('@media screen {\n  @supports (color: red) {\n    @media (min-width: 1px) { .post { color: #f00 } }\n  }\n}')))
      .toEqual(['C1 3:46 #f00'])
  })

  it('refuses a hex and a colour name written with escapes', () => {
    expect(brief(check('.post{color:#\\66 00;background:r\\65 d}'))).toEqual(['C1 1:13 #\\66 00', 'C1 1:32 r\\65 d'])
  })

  it('refuses expression() with an escaped name', () => {
    expect(rulesOf(check('.post{width:\\65 xpression(alert(1))}'))).toEqual(['A1'])
  })
})

describe('selectors that hide a name', () => {
  it('refuses an unknown class deep inside :has(:not())', () => {
    expect(brief(check('.post:has(> :not(.x, .evil)) {}'))).toEqual(['S1 1:22 .evil'])
  })

  it('refuses a data attribute with a namespace prefix or in capitals', () => {
    expect(rulesOf(check('[*|data-user] {}\n[|DATA-USER] {}'))).toEqual(['S1', 'S1'])
  })
})

describe('truncated and malformed input', () => {
  it('refuses a string that never closes, and one cut by a newline', () => {
    expect(rulesOf(checkThemeCss('.post{}.fc{}.post::before{content:"', CONTRACT, PACKAGE_FILES))).toContain('X1')
    expect(brief(check('.post::before{content:"\n"}'))).toContain('X1 1:23 "')
  })

  it('refuses a url that never closes', () => {
    expect(rulesOf(checkThemeCss('.post{}.fc{}.post{background:url(images/paper.webp', CONTRACT, PACKAGE_FILES))).toContain('X1')
  })

  it('refuses a comment that never closes', () => {
    expect(brief(checkThemeCss('.post{}.fc{}/* .post{color:#000}', CONTRACT, PACKAGE_FILES))).toEqual(['X1 1:13 /* .post{color:#000}'])
  })

  it('survives 60,000 nested brackets without overflowing the stack, and refuses them', () => {
    const deep = `.post{width:${'('.repeat(60000)}}`
    const out = checkThemeCss(deep, CONTRACT, PACKAGE_FILES)
    expect(rulesOf(out)).toContain('X1')
  })

  it('refuses a stray semicolon that swallows the next selector', () => {
    expect(rulesOf(check('.post{};\n.fc{color:var(--c-text)}'))).toContain('X1')
  })
})
