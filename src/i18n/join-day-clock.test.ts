// One admin read two ways: Bun's ICU joins a day and a clock with "at" (`Oct 19, 2026 at 9:00 AM`,
// `19 oct. 2026 à 09:00`), workerd's V8 with a comma. The strings are given here, not asked of the
// engine, so the rule is tested the same on both.
import { describe, expect, it } from 'bun:test'
import { joinDayClock } from './format'

describe('joinDayClock', () => {
  it('drops a joint that is a word', () => {
    expect(joinDayClock('Oct 19, 2026', '9:00 AM', 'Oct 19, 2026 at 9:00 AM')).toBe('Oct 19, 2026, 9:00 AM')
    expect(joinDayClock('19 oct. 2026', '09:00', '19 oct. 2026 à 09:00')).toBe('19 oct. 2026, 09:00')
  })
  it("keeps the language's own punctuation or space", () => {
    expect(joinDayClock('Oct 19, 2026', '9:00 AM', 'Oct 19, 2026, 9:00 AM')).toBe('Oct 19, 2026, 9:00 AM')
    expect(joinDayClock('2026年10月19日', '09:00', '2026年10月19日 09:00')).toBe('2026年10月19日 09:00')
  })
  it('turns the clock first only where the caller allows it', () => {
    expect(joinDayClock('19 thg 10, 2026', '09:00', '09:00 19 thg 10, 2026', true)).toBe('09:00 19 thg 10, 2026')
    expect(joinDayClock('19 thg 10, 2026', '09:00', '09:00 19 thg 10, 2026')).toBe('19 thg 10, 2026, 09:00')
  })
})
