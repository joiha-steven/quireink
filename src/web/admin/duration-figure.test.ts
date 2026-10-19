// A dwell time as a headline figure: the digits at the figure's size, the language's units at
// body size, so "1 phút 52 giây" fits the dashboard's 135px figure at 375 instead of breaking.
import { describe, expect, it } from 'bun:test'
import { durationFigure } from '@/web/admin/kit-figures'
import { formatDuration } from '@/admin-shared/analytics'

// The figure's only markup is the unit span, so removing exactly that span leaves the words.
const text = (html: string): string => html.split(/<span class="text-base leading-none font-normal">|<\/span>/).join('')

describe('the duration figure', () => {
  it('reads as the same words as the text form', () => {
    for (const lang of ['en', 'vi', 'de', 'ja'] as const) {
      expect(text(durationFigure(112_000, lang))).toBe(formatDuration(112_000, lang))
    }
  })

  it('sets the units apart from the digits', () => {
    const html = durationFigure(112_000, 'vi')
    expect(html).toBe('1<span class="text-base leading-none font-normal"> phút </span>52<span class="text-base leading-none font-normal"> giây</span>')
  })
})
