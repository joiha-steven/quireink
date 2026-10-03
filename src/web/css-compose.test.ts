// The component names reach the sheet at the rules their utilities hold, and nowhere else.
import { describe, expect, it } from 'bun:test'
import { composeComponents } from '@/web/css-compose'

const kit = (entries: Record<string, string>) => new Map(Object.entries(entries))

describe('composeComponents', () => {
  it('adds the name beside each utility, in place, inside the same layer and media block', () => {
    const css = '@layer utilities{.rounded-md{border-radius:6px}.p-4{padding:1rem}'
      + '@media (hover:hover){.hover\\:bg-x:hover{background:red}}}.admin{color:red}'
    expect(composeComponents(css, kit({ 'kit-a': 'rounded-md hover:bg-x' }))).toBe(
      '@layer utilities{.rounded-md,.kit-a{border-radius:6px}.p-4{padding:1rem}'
      + '@media (hover:hover){.hover\\:bg-x:hover,.kit-a:hover{background:red}}}.admin{color:red}')
  })

  it('keeps the rest of the selector, so a variant stays the variant it was', () => {
    const css = '.dark\\:bg-neutral-900:where(.dark,.dark *){background:#111}'
      + '.\\[\\&\\>\\*\\]\\:mb-5>*{margin-bottom:1.25rem}.translate-x-0\\.5{translate:2px}'
    const out = composeComponents(css, kit({ 'kit-b': 'dark:bg-neutral-900 [&>*]:mb-5 translate-x-0.5' }))
    expect(out).toContain(',.kit-b:where(.dark,.dark *){')
    expect(out).toContain(',.kit-b>*{')
    expect(out).toContain('.translate-x-0\\.5,.kit-b{')
  })

  it('leaves a class inside an attribute selector alone, and copies keyframes and properties as they are', () => {
    const css = '[data-x=".p-4"]{color:red}@keyframes k{from{opacity:0}}@property --u{syntax:"*"}.p-4{padding:1rem}'
    expect(composeComponents(css, kit({ 'kit-c': 'p-4' })))
      .toBe('[data-x=".p-4"]{color:red}@keyframes k{from{opacity:0}}@property --u{syntax:"*"}.p-4,.kit-c{padding:1rem}')
  })

  it('refuses a utility no rule selects, a marker, and a selector it would have to swap twice', () => {
    expect(() => composeComponents('.p-4{padding:1rem}', kit({ 'kit-d': 'p-4 mt-7' }))).toThrow(/mt-7/)
    expect(() => composeComponents('.group{}', kit({ 'kit-e': 'group' }))).toThrow(/marker/)
    expect(() => composeComponents('.a .b{color:red}', kit({ 'kit-f': 'a b' }))).toThrow(/twice/)
  })
})
