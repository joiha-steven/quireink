import { describe, expect, it } from 'bun:test'
import { blank, offScaleHits } from './admin-kit-scale'

describe('the off-scale type guard reads code, not comments', () => {
  it('a string holding a comment opener does not hide the lines after it', () => {
    const src = [
      "const accept = 'video/*'",
      'const a = `<b class="font-bold">x</b>`',
      '/** doc */',
      'const b = 1',
    ].join('\n')
    expect(offScaleHits(src)).toEqual([{ text: expect.stringContaining('font-bold'), line: 2, token: 'font-bold' }])
  })

  it('a real comment is blanked and keeps its line count', () => {
    const src = '/* font-bold\n text-lg */\n// text-xl\nconst c = "text-2xl"'
    expect(blank(src).split('\n')).toHaveLength(4)
    expect(offScaleHits(src).map((h) => h.token)).toEqual(['text-2xl'])
  })

  it('a template hole may hold its own quotes', () => {
    const src = "const d = `${x ? 'a' : \"b\"} font-black`\nconst e = 'text-[15px]'"
    expect(offScaleHits(src).map((h) => h.line)).toEqual([1, 2])
  })
})
