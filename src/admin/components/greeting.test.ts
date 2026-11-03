// The line under Home's title says when the blog last published, and that is the one way it
// can say something false: "last published in 10 days", or "today" for yesterday, is worse
// than no line. The time-of-day greeting it sat beside went on 2026-11-03.
import { describe, expect, it } from 'bun:test'
import { relativeDay } from '@/admin-shared/when'

describe('when the last piece went out', () => {
  // `relativeDay` takes the word, the clock in ms and the language, rather than a `t` object
  // and a Date: a server renderer knows its language from settings and has no DOM to ask.
  const now = new Date('2026-08-30T14:00:00Z').getTime()
  const relative = (iso: string): string => relativeDay('today', iso, now, 'en')

  it('says today rather than a number for something published today', () => {
    expect(relative('2026-08-30T02:00:00.000Z')).toBe('today')
  })

  it('answers for a piece from last week', () => {
    expect(relative('2026-08-23T14:00:00.000Z')).toMatch(/7/)
  })

  it('drops to months, then years, rather than counting hundreds of days', () => {
    expect(relative('2026-05-30T14:00:00.000Z')).toMatch(/3/)
    expect(relative('2024-08-30T14:00:00.000Z')).toMatch(/2/)
  })

  // The demo's newest post is queued for next week, which is what found this: a plain maximum
  // over published posts read "last published in 10 days". The view now filters to what is
  // already out, and this holds the formatter honest about the shape it would have printed.
  it('would have printed a FUTURE date as a future date — hence the filter in the view', () => {
    const ahead = relative('2026-09-09T14:00:00.000Z')
    expect(ahead).not.toBe('')
    expect(ahead).toMatch(/10/)
  })

  it('says nothing at all for a date that is not one', () => {
    expect(relative('not-a-date')).toBe('')
  })
})
