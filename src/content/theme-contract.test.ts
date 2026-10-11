// The appearance contract as the theme checker reads it (ADR 0072).
import { describe, expect, it } from 'bun:test'
import { themeContract } from '@/content/theme-contract'
import { PROMISED_ATTRIBUTES, PROMISED_SELECTORS, PROMISED_VARS } from '@/content/appearance-contract'
import { checkThemeCss } from '@/theme'

const contract = themeContract()
const NO_FILES: ReadonlySet<string> = new Set()

describe('themeContract', () => {
  it('takes every class and id out of compound selectors', () => {
    // `header.site` and `html.dark` promise a class on a tag; the tag is free anyway.
    expect(contract.classes.has('site')).toBe(true)
    expect(contract.classes.has('dark')).toBe(true)
    expect(contract.classes.has('header')).toBe(false)
    expect(contract.classes.has('fc-title')).toBe(true)
    expect(contract.ids.has('comments')).toBe(true)
    expect(contract.classes.has('comments')).toBe(false)
  })

  it('holds exactly the names the contract promises, no more', () => {
    const fromSelectors = PROMISED_SELECTORS.flatMap((s) => s.name.match(/[.#][\w-]+/g) ?? [])
    expect(contract.classes.size + contract.ids.size).toBe(new Set(fromSelectors).size)
    expect([...contract.attributes].sort()).toEqual(PROMISED_ATTRIBUTES.map((a) => a.name).sort())
    expect([...contract.vars].sort()).toEqual(PROMISED_VARS.flatMap((g) => g.vars.map((v) => v.name)).sort())
  })

  it('gives a name the surface it is promised under, and none to shared furniture', () => {
    expect(contract.surfaceOf.get('.fc')).toBe('front')
    expect(contract.surfaceOf.get('.post-list')).toBe('blog')
    expect(contract.surfaceOf.get('#comments')).toBe('blog')
    expect(contract.surfaceOf.has('.rail')).toBe(false)
    expect(contract.surfaceOf.has('.site')).toBe(false)
    for (const s of PROMISED_SELECTORS.filter((x) => x.surface === 'shared')) {
      for (const name of s.name.match(/[.#][\w-]+/g) ?? []) expect(`${name} ${contract.surfaceOf.get(name)}`).toBe(`${name} undefined`)
    }
  })

  it('refuses a name the contract does not promise, through the real checker', () => {
    const css = '.post-list{color:var(--c-text)}\n.fc{color:var(--c-text)}\n.not-promised{color:var(--c-text)}\n[data-secret]{color:var(--c-text)}\n#nowhere{color:var(--c-text)}'
    expect(checkThemeCss(css, contract, NO_FILES).map((v) => `${v.rule} ${v.subject}`)).toEqual([
      'S1 .not-promised', 'S1 [data-secret]', 'S1 #nowhere',
    ])
  })

  it('refuses a variable the contract does not promise and lets the promised ones through', () => {
    const css = '.post-list{margin:var(--sp);color:var(--c-meta)}\n.fc{padding:var(--rail-w)}'
    expect(checkThemeCss(css, contract, NO_FILES).map((v) => v.rule)).toEqual(['V1'])
  })

  it('counts a sheet that styles only shared furniture as styling neither surface', () => {
    const css = '.rail{color:var(--c-text)}\nheader.site{color:var(--c-text)}'
    expect(checkThemeCss(css, contract, NO_FILES).map((v) => `${v.rule} ${v.subject}`)).toEqual(['S2 blog', 'S2 front'])
  })
})
