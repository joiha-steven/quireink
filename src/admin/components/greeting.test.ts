// The greeting's two pieces of arithmetic, which are the two ways it can say something false.
//
// The home screen used to open with the word "Overview". It now opens with a name and a
// portrait, and the whole value of that is being TRUE about a person — a greeting that says
// good morning at midnight, or "last published in 10 days", is worse than the category name
// it replaced, because it is personal AND wrong.
import { describe, expect, it } from 'bun:test'
import { partOfDay, relative } from './Greeting'

describe('what part of the day it is', () => {
  it('walks the four boundaries', () => {
    const at = (h: number) => partOfDay(h).replace('greet', '').toLowerCase()
    expect([0, 4].map(at)).toEqual(['night', 'night'])
    expect([5, 11].map(at)).toEqual(['morning', 'morning'])
    expect([12, 17].map(at)).toEqual(['afternoon', 'afternoon'])
    expect([18, 21].map(at)).toEqual(['evening', 'evening'])
    expect([22, 23].map(at)).toEqual(['night', 'night'])
  })

  it('covers every hour, with no gap and no second answer', () => {
    for (let h = 0; h < 24; h++) expect(typeof partOfDay(h)).toBe('string')
  })
})

describe('when the last piece went out', () => {
  const T = { greetToday: 'today' }
  const now = new Date('2026-08-30T14:00:00Z')

  it('says today rather than a number for something published today', () => {
    expect(relative(T, '2026-08-30T02:00:00.000Z', now)).toBe('today')
  })

  it('answers for a piece from last week', () => {
    expect(relative(T, '2026-08-23T14:00:00.000Z', now)).toMatch(/7/)
  })

  it('drops to months, then years, rather than counting hundreds of days', () => {
    expect(relative(T, '2026-05-30T14:00:00.000Z', now)).toMatch(/3/)
    expect(relative(T, '2024-08-30T14:00:00.000Z', now)).toMatch(/2/)
  })

  // The demo's newest post is queued for next week, which is what found this: a plain maximum
  // over published posts read "last published in 10 days". The view now filters to what is
  // already out, and this holds the formatter honest about the shape it would have printed.
  it('would have printed a FUTURE date as a future date — hence the filter in the view', () => {
    const ahead = relative(T, '2026-09-09T14:00:00.000Z', now)
    expect(ahead).not.toBe('')
    expect(ahead).toMatch(/10/)
  })

  it('says nothing at all for a date that is not one', () => {
    expect(relative(T, 'not-a-date', now)).toBe('')
  })
})
