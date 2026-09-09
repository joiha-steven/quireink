// The pen at the head of a list, and the switch that takes it away.
import { describe, expect, it } from 'bun:test'
import { LISTS_INK_CSS, LISTS_PLAIN_CSS } from '@/pen/lists.css'
import { DASH_COUNT, DASH_MASKS, DOT_COUNT, DOT_MASKS, NUMERAL_LEANS } from '@/pen/dies-lists'

describe('the list marks', () => {
  it('deals every dot and every dash, as masks with no pigment in them', () => {
    expect(DOT_MASKS.length).toBe(DOT_COUNT)
    expect(DASH_MASKS.length).toBe(DASH_COUNT)
    for (const m of [...DOT_MASKS, ...DASH_MASKS]) {
      expect(LISTS_INK_CSS).toContain(m)
      // Black, because the shape is a mask: the colour is the text's, via currentColor.
      expect(m).toContain("%23000")
    }
    expect(LISTS_INK_CSS).toContain('background:currentColor')
    expect(LISTS_INK_CSS).not.toMatch(/#[0-9a-f]{6}\b/i)
  })

  it('declares the numeral face lazily and leans each numeral a little', () => {
    expect(LISTS_INK_CSS).toContain("font-family:'Kalam Digits'")
    expect(LISTS_INK_CSS).toContain('/fonts/kalam-digits.woff2')
    expect(LISTS_INK_CSS).toContain('unicode-range:U+0030-0039,U+002E')
    expect(LISTS_INK_CSS).not.toContain('font-size')
    for (const l of NUMERAL_LEANS) {
      expect(Math.abs(Number(l.rot))).toBeLessThanOrEqual(3.5)
      expect(LISTS_INK_CSS).toContain(`rotate(${l.rot}deg)`)
    }
  })

  it("leaves a task item, the editor's task list and a list that starts past 1 alone", () => {
    expect(LISTS_INK_CSS).toContain('.prose li.task::before,.prose ul[data-type=taskList]>li::before{content:none}')
    expect(LISTS_INK_CSS).toContain('.prose ol[start]{list-style:decimal')
  })

  it('has an off path that gives the browser its disc and decimal back', () => {
    expect(LISTS_PLAIN_CSS).toContain('.prose ul{list-style:disc')
    expect(LISTS_PLAIN_CSS).toContain('.prose ol{list-style:decimal')
    expect(LISTS_PLAIN_CSS).toContain('::before{content:none}')
  })
})
