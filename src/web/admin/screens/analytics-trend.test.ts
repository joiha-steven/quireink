// The trend mark is one line (arrow + ratio) so it never grows taller than the figure it sits in;
// the "vs N before" comparison is a separate note that goes into the cell's sub lines.
import { describe, expect, it } from 'bun:test'
import { adminT } from '@/i18n/admin-i18n'
import { numBand } from '@/web/admin/kit-figures'
import { trendLine, trendMark, trendNote } from './analytics-kit'

const t = adminT('en')

describe('the trend mark and its note', () => {
  it('keeps arrow and ratio on the figure line, with no comparison line inside the mark', () => {
    const mark = trendMark(44, 10, t, 'en')
    expect(mark).toContain('▲ ×4.4')
    expect(mark).not.toContain('class="block')
    expect(mark).not.toContain('vs 10 before')
    expect(mark).toContain('sr-only')
  })

  it('says the comparison in the note, and both are empty when there is nothing to compare', () => {
    expect(trendNote(44, 34, t, 'en')).toBe('vs 34 before')
    expect(trendMark(5, 0, t, 'en')).toBe('')
    expect(trendNote(5, 0, t, 'en')).toBe('')
  })

  it('puts mark and note together on one sub line, empty when there is no trend', () => {
    const line = trendLine(44, 34, t, 'en')
    expect(line).toContain('▲')
    expect(line.endsWith('vs 34 before')).toBe(true)
    expect(trendLine(5, 0, t, 'en')).toBe('')
  })

  it('numBand prints each sub line in its own block under the label, skipping empty ones', () => {
    const html = numBand([{ n: '9', label: 'Views', sub: ['vs 34 before', '', 'New 1'] }])
    expect(html.match(/<span class="block text-xs/g)?.length).toBe(3) // label + two sub lines
    expect(html.indexOf('Views')).toBeLessThan(html.indexOf('vs 34 before'))
    expect(html.indexOf('vs 34 before')).toBeLessThan(html.indexOf('New 1'))
  })
})
