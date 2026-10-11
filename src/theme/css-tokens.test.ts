// The tokenizer reads as a browser reads: escapes decoded, comments gone, strings and urls
// cut where CSS Syntax 3 cuts them. Each case is a shape the checker relies on.
import { describe, expect, it } from 'bun:test'
import { asciiLower, type CssToken, tokenizeCss } from '@/theme/css-tokens'
import { lineLocator } from '@/theme/line-locator'

const kinds = (css: string) =>
  tokenizeCss(css).tokens.filter((t) => t.type !== 'whitespace').map((t) => `${t.type}:${t.value}`)
const only = (css: string): CssToken => {
  const ts = tokenizeCss(css).tokens
  expect(ts.length).toBe(1)
  return ts[0]!
}

describe('css tokenizer', () => {
  it('splits a rule into the token types the spec names', () => {
    expect(kinds('a.b>#c[d="e"]{f:g;}')).toEqual([
      'ident:a', 'delim:.', 'ident:b', 'delim:>', 'hash:c', '[:', 'ident:d', 'delim:=', 'string:e',
      ']:', '{:', 'ident:f', 'colon:', 'ident:g', 'semicolon:', '}:',
    ])
  })

  it('drops comments wherever they sit, including between ! and important', () => {
    expect(kinds('a/* x */b ! /*y*/ IMPORTANT')).toEqual(['ident:a', 'ident:b', 'delim:!', 'ident:IMPORTANT'])
  })

  it('reports an unterminated comment instead of quietly eating the rest', () => {
    const { tokens, errors } = tokenizeCss('a{}/* b{}')
    expect(tokens.map((t) => t.type)).toEqual(['ident', '{', '}'])
    expect(errors).toEqual([{ kind: 'unclosed-comment', offset: 3 }])
  })

  it('decodes hex escapes, with their one optional trailing space, and character escapes', () => {
    expect(only('\\75 rl').value).toBe('url')
    expect(only('u\\72l').value).toBe('url')
    expect(only('\\@x').value).toBe('@x')
    expect(only('a\\000041').value).toBe('aA')
    expect(only('a\\41\r\nb').value).toBe('aAb')
  })

  it('turns an escape outside Unicode, a surrogate or zero into U+FFFD', () => {
    expect(only('\\110000').value).toBe('\uFFFD')
    expect(only('\\d800').value).toBe('\uFFFD')
    expect(only('\\0').value).toBe('\uFFFD')
  })

  it('reads an escaped url( as a url token, in any case', () => {
    for (const src of ['u\\72l(x.png)', '\\75 rl(x.png)', 'URL(x.png)', 'uRl(  x.png  )']) {
      const t = only(src)
      expect(t.type).toBe('url')
      expect(t.value).toBe('x.png')
    }
    expect(only('url(\\68 ttp://e)').value).toBe('http://e')
  })

  it('keeps the quoted form of url( as a function, so the string is checked as one', () => {
    expect(kinds('url( "a.png" )')).toEqual(['function:url', 'string:a.png', '):'])
  })

  it('decodes escapes in function names, at-keywords and hashes', () => {
    expect(kinds('\\65 xpression(1)')[0]).toBe('function:expression')
    expect(kinds('@\\69mport')).toEqual(['at-keyword:import'])
    expect(kinds('#\\66 00')).toEqual(['hash:f00'])
  })

  it('marks a hash that can be an id selector apart from one that cannot', () => {
    expect(only('#main').hashId).toBe(true)
    expect(only('#1ab').hashId).toBe(false)
    expect(only('#1ab').type).toBe('hash')
  })

  it('makes a string cut by a newline a bad-string, and a string cut by end of input an error', () => {
    expect(kinds('"abc\nd"')[0]).toBe('bad-string:')
    const { tokens, errors } = tokenizeCss('"abc')
    expect(tokens[0]!.type).toBe('string')
    expect(errors).toEqual([{ kind: 'unclosed-string', offset: 0 }])
  })

  it('continues a string over an escaped newline and decodes escapes inside it', () => {
    expect(only('"a\\\nb\\41"').value).toBe('abA')
  })

  it('makes a url with a quote, a bracket or inner space a bad-url, and reports one never closed', () => {
    expect(only('url(a"b)').type).toBe('bad-url')
    expect(only('url(a(b)').type).toBe('bad-url')
    expect(only('url(a b)').type).toBe('bad-url')
    const { tokens, errors } = tokenizeCss('url(a.png')
    expect(tokens[0]!.type).toBe('url')
    expect(errors).toEqual([{ kind: 'unclosed-url', offset: 0 }])
  })

  it('reads numbers, percentages and dimensions with their decoded unit', () => {
    const ts = tokenizeCss('1 -2.5 +.5e1 50% 1.2em 3\\70 x').tokens.filter((t) => t.type !== 'whitespace')
    expect(ts.map((t) => [t.type, t.num, t.value])).toEqual([
      ['number', 1, ''], ['number', -2.5, ''], ['number', 5, ''], ['percentage', 50, ''],
      ['dimension', 1.2, 'em'], ['dimension', 3, 'px'],
    ])
  })

  it('knows CDO and CDC from a delim and an ident', () => {
    expect(kinds('<!-- --> -->a -x')).toEqual(['CDO:', 'CDC:', 'CDC:', 'ident:a', 'ident:-x'])
  })

  it('reads a backslash that escapes nothing as a delim', () => {
    expect(kinds('\\\n')[0]).toBe('delim:\\')
  })

  it('treats NUL as U+FFFD inside a name', () => {
    expect(only('a\0b').value).toBe('a\uFFFDb')
  })

  it('skips a byte order mark the way a decoder does', () => {
    expect(kinds('\uFEFFa')).toEqual(['ident:a'])
  })

  it('lower-cases ASCII only, so a dotted capital I is not read as i', () => {
    expect(asciiLower('IMPORT')).toBe('import')
    expect(asciiLower('\u0130MPORT')).toBe('\u0130mport')
  })
})

describe('line locator', () => {
  it('counts CR, LF, CRLF and FF as line ends and columns in code points', () => {
    const src = 'a\r\nb\rc\fd\n\u{1F600}e'
    const at = lineLocator(src)
    expect(at(0)).toEqual({ line: 1, col: 1 })
    expect(at(src.indexOf('b'))).toEqual({ line: 2, col: 1 })
    expect(at(src.indexOf('c'))).toEqual({ line: 3, col: 1 })
    expect(at(src.indexOf('d'))).toEqual({ line: 4, col: 1 })
    expect(at(src.indexOf('e'))).toEqual({ line: 5, col: 2 })
  })
})
