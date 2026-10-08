// WHAT THE SHEET SAYS ABOUT THE PIECE: its standing, the date beside it, and the main key's word.
//
// Read by the server when it draws the sheet (`screens/sheet-frame.ts`) and by the island every
// time something changes (`island/sheet.ts`), so the first paint and every repaint after it
// answer from one rule rather than two that drift.
//
// ⚠️ THE HEADER SAYS WHAT IS SAVED. Ticking "Published" on a draft nobody has saved turned the
// line under the title to "Published" and raised a "View post" that would have 404ed: the
// header described the form instead of the piece. The standing is taken from the status and
// the date the SERVER holds; the form's choice only decides what the main key will do.
//
// ⚠️ A SCHEDULED PIECE IS DATED BY ITS SCHEDULE. The line read "Scheduled · <last save>", so a
// post scheduled for the 19th printed the 8th, and right after scheduling it printed the
// moment of the click. It now prints the publish date as the wall clock on the SITE's zone,
// which is what the Attributes panel says. The Write list dates it by the same publish date but
// formats that instant in the server process's own zone (`content-pane.ts`), so the two agree
// only where the server runs on the site's zone — a separate, older mismatch.
import type { PostStatus, SiteLang } from '@/types'
import { formatDateTimeShort } from '@/admin-shared/when'

export type Standing = 'draft' | 'scheduled' | 'published'

/** A wall clock on the site's zone (`2026-10-19T09:00`), as the draft carries its date. */
export type WallClock = string

/**
 * Is a wall-clock date still ahead? Read as the reading machine's own clock, which is what the
 * sheet has always done (`isScheduled` on the draft's date): the digits are the site's, the
 * comparison is local, and the two only part company for a writer in another zone in the hour
 * either side of the publish time.
 */
export function ahead(date: WallClock, now: number = Date.now()): boolean {
  if (!date) return false
  const at = new Date(date).getTime()
  return !Number.isNaN(at) && at > now
}

/** Draft, scheduled or published, from a status and a date — what the SERVER holds. */
export function standing(status: PostStatus, date: WallClock, now: number = Date.now()): Standing {
  if (status !== 'published') return 'draft'
  return ahead(date, now) ? 'scheduled' : 'published'
}

/**
 * The date printed after the standing. A scheduled piece prints WHEN IT GOES OUT, in the same
 * short shape the Write list uses; anything else prints when it was last touched.
 *
 * `new Date(wall)` with no offset is the reading machine's local time, so `formatDateTimeShort`
 * gives the wall clock's own digits back on the server and in any browser.
 */
export function standingDate(
  st: Standing, date: WallClock, touched: string, lang: SiteLang,
): string {
  if (st === 'scheduled' && date) return formatDateTimeShort(date, lang)
  return touched
}

/** The words the line under the title is made of. */
export type MetaWords = {
  scheduled: string; statusPublished: string; statusDraft: string; kindPage: string; kindNote: string
}

/**
 * `Page · Draft · 15/9/26 - 13:14`: what this is, what state the SERVER holds it in, and the date
 * `standingDate` picks. A post says only its state: it is the default kind, and the write column
 * beside it already says which of the three is open.
 */
export function metaLineOf(
  kind: 'post' | 'page' | 'note', w: MetaWords, st: Standing, date: WallClock, touched: string, lang: SiteLang,
): string {
  const state = st === 'scheduled' ? w.scheduled : st === 'published' ? w.statusPublished : w.statusDraft
  const head = kind === 'post' ? state : `${kind === 'page' ? w.kindPage : w.kindNote} · ${state}`
  return [head, standingDate(st, date, touched, lang)].filter(Boolean).join(' · ')
}

export type MainWord = 'publish' | 'schedule' | 'update'

/**
 * The main key's word.
 *
 * "Update" on a piece the server already holds as published or scheduled, when the form still
 * says published and would keep it on the same side of now: that press saves changes to
 * something already out (or already queued), and "Publish" greyed out on a live post read as a
 * key that was not available. Otherwise it says what the press WOULD do: a future date
 * schedules, anything else publishes.
 */
export function mainWord(saved: Standing, chosen: PostStatus, chosenAhead: boolean): MainWord {
  if (saved !== 'draft' && chosen === 'published' && chosenAhead === (saved === 'scheduled')) return 'update'
  return chosenAhead ? 'schedule' : 'publish'
}

/**
 * Whether the main key can be pressed. A draft can always be sent out; a piece already out (or
 * queued) has nothing to update until something changed.
 */
export function mainReady(saved: Standing, dirty: boolean, saving: boolean): boolean {
  if (saving) return false
  return saved === 'draft' || dirty
}
