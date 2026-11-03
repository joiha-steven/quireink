// `theme:preview`'s dropped declarations (scripts/theme-preview-dropped.ts) without a browser:
// what is read from the sheet, what is guessed, what each answer becomes, and the sentence under it
// in every language. The browser's half runs in theme-preview-dropped-e2e.test.ts.
import { describe, expect, it } from 'bun:test'
import { LANG_CODES } from '@/locales/langs'
import {
  distance, droppedFindings, droppedIn, droppedSentence, guesses, judged, nearest, sourceDeclarations,
  type Answer, type DroppedFinding, type SourceDeclaration,
} from '../../scripts/theme-preview-dropped'
import { reportText } from '../../scripts/theme-preview-report'
import en from '@/locales/admin/en'

const KNOWN = ['background', 'background-color', 'border-radius', 'color', 'display', 'font-weight', 'margin', 'padding', 'text-wrap', 'width']
const one = (css: string): SourceDeclaration => sourceDeclarations(css)[0]!

describe('sourceDeclarations', () => {
  it('reads every declaration with the line and column an editor shows, inside @media too', () => {
    const css = '.a{colour:#333}\n@media (min-width:40em){\n  .b{display:gird;gap:1rem}\n}'
    expect(sourceDeclarations(css).map((d) => [d.property, d.value, d.line, d.col])).toEqual([
      ['colour', '#333', 1, 4], ['display', 'gird', 3, 6], ['gap', '1rem', 3, 19],
    ])
  })

  it('leaves !important out of the value the browser is asked about', () => {
    expect(one('.a{color:red !important}').value).toBe('red')
  })

  it('keeps a run with no colon, as the browser reads it: a declaration it drops', () => {
    expect(one('.a{color red}')).toMatchObject({ property: '', value: 'color red', text: 'color red' })
  })

  it('finds a missing ; from the tokens, a var() in front included', () => {
    expect(one('.a{color:var(--c-text) font-weight:700}').runOn).toEqual({ next: 'font-weight', before: 'var(--c-text)' })
    expect(one('.a{color:red background:blue}').runOn).toEqual({ next: 'background', before: 'red' })
    expect(one('.a{background:url("a:b.webp")}').runOn).toBeUndefined()
    expect(one('.a{--t-x:a b:c}').runOn).toBeUndefined()
  })
})

describe('judged', () => {
  it('asks about everything but custom properties and another engine’s prefix', () => {
    expect(judged(one('.a{--t-x:anything}'))).toBe(false)
    expect(judged(one('.a{-moz-osx-font-smoothing:grayscale}'))).toBe(false)
    expect(judged(one('.a{display:-ms-grid}'))).toBe(false)
    expect(judged(one('.a{-webkit-line-clamp:2}'))).toBe(true)
    expect(judged(one('.a{colr:var(--c-text)}'))).toBe(true)
  })
})

describe('distance and nearest', () => {
  it('counts a swap of two neighbours as one edit', () => {
    expect(distance('gird', 'grid')).toBe(1)
    expect(distance('colour', 'color')).toBe(1)
    expect(distance('backround', 'background')).toBe(1)
  })

  it('offers a word only when it is close for its length', () => {
    expect(nearest('colour', KNOWN)).toBe('color')
    expect(nearest('paddin', KNOWN)).toBe('padding')
    expect(nearest('top', ['tip', 'pot'])).toBe('tip')
    expect(nearest('hanging-punctuation', KNOWN)).toBeNull()
  })
})

describe('guesses', () => {
  const g = (css: string, answer: Answer) => guesses(one(css), answer, KNOWN)

  it('a misspelt property: the nearest name with the same value', () => {
    expect(g('.a{colour:#333}', 'property')).toEqual([['color', '#333']])
    expect(g('.a{hanging-punctuation:first}', 'property')).toEqual([])
  })

  it('a length without its unit, leaving zero alone', () => {
    expect(g('.a{border-radius:999}', 'value')).toContainEqual(['border-radius', '999px'])
    expect(g('.a{margin:0 12}', 'value')).toContainEqual(['margin', '0 12px'])
  })

  it('a misspelt keyword, one at a time', () => {
    expect(g('.a{display:gird}', 'value')).toContainEqual(['display', 'grid'])
    expect(g('.a{text-wrap:balanced}', 'value')).toContainEqual(['text-wrap', 'balance'])
  })

  it('a missing ; is the value up to the next name; a missing colon puts it back', () => {
    expect(g('.a{color:red background:blue}', 'value')).toEqual([['color', 'red']])
    expect(g('.a{color red}', 'property')).toEqual([['color', 'red']])
  })
})

describe('droppedFindings', () => {
  const run = (css: string, answers: Answer[], fixes: Record<string, readonly [string, string]> = {}) =>
    droppedFindings(sourceDeclarations(css), answers, (d) => fixes[d.text] ?? null)
      .map((f) => [f.kind, f.fix ?? null, f.next ?? null])

  it('says nothing of a declaration the browser kept', () => {
    expect(run('.a{color:red}', ['kept'])).toEqual([])
  })

  it('names each way a declaration is dropped, with the guess the browser kept', () => {
    expect(run('.a{colour:red;hanging-punctuation:first;display:gird;width:;margin:1rem 2rem 3rem 4rem 5rem;color red}',
      ['property', 'property', 'value', 'value', 'value', 'property'],
      { 'colour:red': ['color', 'red'], 'display:gird': ['display', 'grid'], 'color red': ['color', 'red'] },
    )).toEqual([
      ['property', 'color: red', null], ['unknown', null, null], ['value', 'display: grid', null],
      ['empty', null, null], ['value', null, null], ['colon', 'color: red', null],
    ])
  })

  it('a missing ; is a finding even where the browser kept the run, as it keeps any var()', () => {
    expect(run('.a{color:var(--c-text) font-weight:700}', ['kept'], { 'color:var(--c-text) font-weight:700': ['color', 'var(--c-text)'] }))
      .toEqual([['semicolon', 'color: var(--c-text);', 'font-weight']])
  })
})

describe('droppedIn', () => {
  it('asks once for every declaration, then once for the guesses, and keeps the first guess kept', async () => {
    const asked: string[] = []
    const fake = async (expression: string): Promise<unknown> => {
      asked.push(expression)
      if (asked.length === 1) return { answers: ['property', 'kept'], known: KNOWN }
      return [true]
    }
    const found = await droppedIn('.a{colour:red;margin:0}', fake)
    expect(asked).toHaveLength(2)
    expect(found.map((f) => [f.line, f.col, f.kind, f.fix])).toEqual([[1, 4, 'property', 'color: red']])
  })

  it('refuses an answer it cannot read rather than report a clean sheet', async () => {
    await expect(droppedIn('.a{color:red}', async () => ({ answers: [] }))).rejects.toThrow('unexpected shape')
  })

  it('asks nothing of a sheet with nothing to judge', async () => {
    expect(await droppedIn('.a{--t-x:1}', async () => { throw new Error('asked') })).toEqual([])
  })
})

describe('the sentence under a finding', () => {
  const f = (over: Partial<DroppedFinding>): DroppedFinding => ({ line: 1, col: 4, text: 'colour:red', kind: 'property', property: 'colour', value: 'red', ...over })

  it('says what the browser did, then what to write instead', () => {
    expect(droppedSentence(f({ fix: 'color: red' }), en.themePreviewFindings))
      .toBe('The browser knows no property called colour, so it drops this declaration and it does nothing. Write color: red instead.')
    expect(droppedSentence(f({ kind: 'semicolon', property: 'color', value: 'red background:blue', next: 'background', fix: 'color: red;' }), en.themePreviewFindings))
      .toContain('A semicolon is missing before background')
  })

  it('every language has every sentence, each keeping the names it fills in', async () => {
    for (const lang of LANG_CODES) {
      const words = (await import(`@/locales/admin/${lang}`)).default.themePreviewFindings as Record<string, string>
      for (const [key, english] of Object.entries(en.themePreviewFindings)) {
        const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
        expect(words[key], `${lang}.${key}`).toBeTruthy()
        expect(holes(words[key]!), `${lang}.${key}`).toEqual(holes(english))
      }
    }
  })

  it('REPORT.txt says the sheet’s findings before the pages’, and keeps another engine’s property apart', () => {
    const info = { themeId: 'x', version: '1.0.0', name: 'X', seconds: 1, clock: 'now' }
    const text = reportText(info, [], [f({ fix: 'color: red' }), f({ kind: 'unknown', line: 2, property: 'hanging-punctuation', text: 'hanging-punctuation:first' })])
    expect(text).toContain('1 declaration in theme.css the browser drops:\ntheme.css:1:4 · colour:red\n    The browser knows no property called colour')
    expect(text).toContain('1 property in theme.css this browser does not have (not a finding):\ntheme.css:2:4 · hanging-punctuation:first')
  })
})
