// The sheet's header and main key answer from what the SERVER holds, and a scheduled piece is
// dated by its schedule. Both shipped wrong: "Scheduled · <save time>", and "Published" with a
// "View post" on a draft whose box had only been ticked.
import { describe, expect, it } from 'bun:test'
import { ahead, mainReady, mainWord, standing, standingDate } from './sheet-state'
import { formatDateTimeShort } from './when'

const NOW = Date.parse('2026-10-08T10:54:00Z')

describe('the standing', () => {
  it('is draft whatever the date when the status is draft', () => {
    expect(standing('draft', '2026-10-19T09:00', 'UTC', NOW)).toBe('draft')
    expect(standing('draft', '2020-01-01T00:00', 'UTC', NOW)).toBe('draft')
  })
  it('is scheduled when published with a date still ahead', () => {
    expect(standing('published', '2026-10-19T09:00', 'UTC', NOW)).toBe('scheduled')
    expect(standing('published', '2026-10-08T10:55', 'UTC', NOW)).toBe('scheduled')
  })
  it('is published when the date has passed, is now, or is missing', () => {
    expect(standing('published', '2026-10-08T10:54', 'UTC', NOW)).toBe('published')
    expect(standing('published', '2026-01-01T00:00', 'UTC', NOW)).toBe('published')
    expect(standing('published', '', 'UTC', NOW)).toBe('published')
    expect(ahead('not a date', 'UTC', NOW)).toBe(false)
  })
})

describe('ahead, on the SITE’s clock whatever clock the machine reading it is on', () => {
  // 10:00 UTC is 17:00 in Hanoi and 03:00 in Los Angeles.
  const TEN_UTC = Date.parse('2026-10-08T10:00:00Z')
  const onMachine = (tz: string, run: () => void): void => {
    // Put back by NAME: `delete process.env.TZ` leaves Bun on that zone for good after.
    const was = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone
    process.env.TZ = tz
    try { run() } finally { process.env.TZ = was }
  }
  it('a site on UTC read from a browser in Hanoi: today 12:00 is still ahead', () => {
    onMachine('Asia/Ho_Chi_Minh', () => {
      expect(new Date('2026-10-08T12:00').getTime()).toBeLessThan(TEN_UTC) // what it used to compare
      expect(ahead('2026-10-08T12:00', 'UTC', TEN_UTC)).toBe(true)
      expect(standing('published', '2026-10-08T12:00', 'UTC', TEN_UTC)).toBe('scheduled')
    })
  })
  it('a site in Hanoi read from a browser on UTC: today 16:00 has already gone', () => {
    onMachine('UTC', () => {
      expect(new Date('2026-10-08T16:00').getTime()).toBeGreaterThan(TEN_UTC)
      expect(ahead('2026-10-08T16:00', 'Asia/Ho_Chi_Minh', TEN_UTC)).toBe(false)
      expect(standing('published', '2026-10-08T16:00', 'Asia/Ho_Chi_Minh', TEN_UTC)).toBe('published')
      expect(ahead('2026-10-08T17:01', 'Asia/Ho_Chi_Minh', TEN_UTC)).toBe(true)
    })
  })
})

describe('the date after the standing', () => {
  it('is the PUBLISH date on a scheduled piece, never the save time', () => {
    const saved = formatDateTimeShort(NOW, 'en')
    const line = standingDate('scheduled', '2026-10-19T09:00', saved, 'en')
    expect(line).toBe('10/19/26 - 09:00')
    expect(line).not.toBe(saved)
  })
  it('keeps the wall clock digits in another language too', () => {
    expect(standingDate('scheduled', '2026-10-09T09:00', '', 'vi')).toContain('09:00')
    expect(standingDate('scheduled', '2026-10-09T09:00', '', 'vi')).toContain('9')
  })
  it('is the last touch on a draft and on a published piece', () => {
    expect(standingDate('draft', '2026-10-19T09:00', 'T', 'en')).toBe('T')
    expect(standingDate('published', '2026-01-01T09:00', 'T', 'en')).toBe('T')
  })
})

describe('the main key', () => {
  it('publishes or schedules a draft, by the date chosen', () => {
    expect(mainWord('draft', 'draft', false)).toBe('publish')
    expect(mainWord('draft', 'published', false)).toBe('publish')
    expect(mainWord('draft', 'published', true)).toBe('schedule')
  })
  it('updates a published piece and a scheduled one', () => {
    expect(mainWord('published', 'published', false)).toBe('update')
    expect(mainWord('scheduled', 'published', true)).toBe('update')
  })
  it('says what changes when the date crosses now', () => {
    // A live post moved into the future is being scheduled; a queued one moved back goes out now.
    expect(mainWord('published', 'published', true)).toBe('schedule')
    expect(mainWord('scheduled', 'published', false)).toBe('publish')
  })
  it('does not say update when the form has switched the piece to draft', () => {
    expect(mainWord('published', 'draft', false)).toBe('publish')
  })
  it('is pressable on a draft, and on a live piece only with changes', () => {
    expect(mainReady('draft', false, false)).toBe(true)
    expect(mainReady('published', false, false)).toBe(false)
    expect(mainReady('published', true, false)).toBe(true)
    expect(mainReady('scheduled', false, false)).toBe(false)
    expect(mainReady('scheduled', true, false)).toBe(true)
    expect(mainReady('draft', true, true)).toBe(false)
  })
})
