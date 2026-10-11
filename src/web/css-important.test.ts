// `splitImportant` takes a sheet's `!important` declarations out, each under its own selector and
// inside the same at-rules, so the base sheet can be served in a layer without its `!important`s
// starting to beat the owner's (`web/css-important.ts`).
import { describe, expect, it } from 'bun:test'
import { splitImportant } from '@/web/css-important'
import { minifyCss } from '@/web/css-min'
import { PUBLIC_CSS } from '@/web/public.css'
import { SERVED_CSS } from '@/web/served-css'

const count = (css: string): number => (css.match(/!\s*important/gi) ?? []).length

describe('splitImportant', () => {
  it('moves only the important declarations, keeping selector, order and the rest of the rule', () => {
    expect(splitImportant('a{color:red;margin:0!important;padding:1px}b{top:0}')).toEqual({
      normal: 'a{color:red;padding:1px}b{top:0}',
      important: 'a{margin:0!important}',
    })
  })

  it('keeps each one inside the same @media and @supports, and drops what is left empty', () => {
    const css = '@media print{a{display:none!important}b{color:red}}@supports (x:y){@media (min-width:1px){c{top:0 ! important}}}'
    expect(splitImportant(css)).toEqual({
      normal: '@media print{b{color:red}}',
      important: '@media print{a{display:none!important}}@supports (x:y){@media (min-width:1px){c{top:0 ! important}}}',
    })
  })

  it('reads strings and parentheses as text: a semicolon or a brace inside them splits nothing', () => {
    const css = 'a{content:";}{";background:url(data:image/svg+xml;utf8,x)!important;b:c}'
    expect(splitImportant(css)).toEqual({
      normal: 'a{content:";}{";b:c}',
      important: 'a{background:url(data:image/svg+xml;utf8,x)!important}',
    })
  })

  it('leaves keyframes, font faces, pages and statements whole, in place', () => {
    const css = '@layer a,b;@keyframes k{from{opacity:0!important}}@font-face{font-family:x}@media print{@page{margin:1mm}}'
    expect(splitImportant(css)).toEqual({ normal: css, important: '' })
  })

  it('refuses a rule nested inside a style rule rather than guessing its selector', () => {
    expect(() => splitImportant('a{color:red;&:hover{color:blue!important}}')).toThrow(/nested/)
  })

  it('loses nothing from the real base sheet: every declaration lands on exactly one side', () => {
    const whole = minifyCss(PUBLIC_CSS)
    const { normal, important } = splitImportant(whole)
    expect(important).toBe(SERVED_CSS['site-important'])
    expect(normal).toBe(SERVED_CSS.site)
    expect(count(normal)).toBe(0)
    expect(count(important)).toBe(count(whole))
    expect(count(important)).toBeGreaterThan(10)
    // Same bytes apart from the selectors and wrappers restated for the important side.
    expect(normal.length + important.length).toBeGreaterThan(whole.length)
  })
})
