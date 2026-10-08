// THE SAVE KEY AND ⌘S: what a plain save sends, decided when it runs, and the two dates that ask.
//
// ⚠️ THE STATUS STAYS `published` AND THE PIECE STILL MOVES. Save never changes the status
// (`statusForSave`), but the DATE decides which side of the site a published piece is on, and
// moving it across now moves the piece:
//
// - LIVE, date moved ahead: it becomes scheduled and the site stops serving it. Save said
//   "Changes saved" and the header changed only after the fact.
// - SCHEDULED, date moved to now or before: it goes out at once, unasked.
//
// The main key already says which (Schedule, Publish); the Save key and the chord said nothing,
// so they ask. Three answers, the kit's dialog (`overlay-confirm.ts`): go ahead, KEEP the side it
// is on (the saved date goes back in the form, the rest is saved), or Cancel, which saves
// nothing. A question nobody answers — no dialog on the page — is Cancel.
//
// ⚠️ DECIDED WHEN IT RUNS (`saveChain`), from what the server holds after the save in front of
// it, never at the press. A draft being published when Save was pressed is published by the time
// this reads it, and Save keeps it so.
import { ahead, type Standing, type WallClock } from '@/admin-shared/sheet-state'
import type { SheetDraft, SheetWords } from '@/admin-shared/sheet-wire'
import { formatWallClock } from '@/i18n/format'
import type { SiteLang } from '@/types'
import { fill } from '@/utils'
import type { Plan, Planned } from './sheet-save'

/** Which way a save would move a published piece across now, if it would. */
export type Crossing = 'down' | 'up' | null

/**
 * Would this save take a piece off the site (`down`), or put a scheduled one out now (`up`)?
 *
 * Only for a save that keeps the piece published, and only from what the SERVER holds (`held`,
 * never the form). A draft is on neither side; a save that unpublishes is the status choice in
 * the panel, which asked its own question by being chosen; a scheduled piece moved to another
 * future date, or a live one to another past date, stays where it is.
 */
export function crossing(
  held: Standing, sending: SheetDraft['status'], date: WallClock, timezone: string, now: number = Date.now(),
): Crossing {
  if (sending !== 'published') return null
  if (held === 'published' && ahead(date, timezone, now)) return 'down'
  if (held === 'scheduled' && !ahead(date, timezone, now)) return 'up'
  return null
}

/** What the dialog's three keys answer: go ahead, keep the side it is on, or nothing. */
export type CrossAnswer = 'go' | 'keep' | 'cancel'

type CrossWords = Pick<SheetWords,
  | 'takeDownTitle' | 'takeDownBody' | 'schedule' | 'keepLive' | 'takenDownUntil' | 'keptLive'
  | 'publishNowTitle' | 'publishNowBody' | 'publishNow' | 'keepScheduled' | 'keptScheduled'
  | 'askCancel' | 'savedChanges' | 'savedDraft' | 'scheduled' | 'published'>

/**
 * Ask before the date moves the piece. `date` is the form's, `savedDate` the server's: going
 * down names the day it comes back, going up names the schedule it is leaving.
 */
export function askCrossing(
  t: CrossWords, lang: SiteLang, way: 'down' | 'up', date: WallClock, savedDate: WallClock,
): Promise<CrossAnswer> {
  const down = way === 'down'
  return new Promise((resolve) => {
    const unheard = window.dispatchEvent(new CustomEvent('quire:confirm', {
      cancelable: true,
      detail: {
        request: {
          title: down ? t.takeDownTitle : t.publishNowTitle,
          body: fill(down ? t.takeDownBody : t.publishNowBody, { date: formatWallClock(down ? date : savedDate, lang) }),
          confirmLabel: down ? t.schedule : t.publishNow,
          altLabel: down ? t.keepLive : t.keepScheduled,
          cancelLabel: t.askCancel,
        },
        respond: (a: string) => resolve(a === 'confirm' ? 'go' : a === 'alt' ? 'keep' : 'cancel'),
      },
    }))
    if (unheard) resolve('cancel')
  })
}

/** The toast after a live piece was scheduled: off the site until the date it names. */
export const takenDownSay = (t: CrossWords, lang: SiteLang, date: WallClock): string =>
  fill(t.takenDownUntil, { date: formatWallClock(date, lang) })

export type LiveSaveHooks = {
  t: CrossWords
  lang: SiteLang
  /** The site's zone the form's date is a wall clock in, as the save itself reads it (`ahead`). */
  timezone: string
  /** What the SERVER holds, and the date it holds: the question is about the site, not the form. */
  held: () => Standing
  savedDate: () => WallClock
  /** The form's date, and the status a plain Save writes (`statusForSave`). */
  date: () => WallClock
  status: () => SheetDraft['status']
  /** Put the saved date back in the draft and in the field. */
  keepDate: (date: WallClock) => void
  /** The sheet's one save queue (`saveChain`). */
  queue: (plan: () => Planned | Promise<Planned>) => Promise<boolean>
}

/**
 * The Save key and ⌘S, and the toast a scheduling main key says.
 *
 * ⚠️ ONE PRESS WAITING AT A TIME. A press while one is still queued, or while its question is
 * open, is the same press: the queued one reads everything when it runs anyway, and a second
 * question asked over the first would have answered it Cancel. A press while a save is already
 * WRITING queues behind it, so nothing typed during a save is left out of the next one.
 */
export function liveSave(h: LiveSaveHooks): { press: () => Promise<boolean>; scheduledSay: () => string } {
  let waiting = false
  const { t, lang } = h
  const scheduledSay = (): string =>
    h.held() === 'published' ? takenDownSay(t, lang, h.date()) : t.scheduled

  async function plan(): Promise<Plan | null> {
    try {
      const status = h.status()
      const date = h.date()
      const way = crossing(h.held(), status, date, h.timezone)
      if (!way) return { status, done: status === 'published' ? t.savedChanges : t.savedDraft, follow: true }
      const saved = h.savedDate()
      const answer = await askCrossing(t, lang, way, date, saved)
      if (answer === 'cancel') return null
      if (answer === 'keep') {
        h.keepDate(saved)
        const kept = way === 'down' ? t.keptLive : fill(t.keptScheduled, { date: formatWallClock(saved, lang) })
        return { status: 'published', done: kept, follow: true }
      }
      return { status: 'published', done: way === 'down' ? takenDownSay(t, lang, date) : t.published, follow: true }
    } finally {
      waiting = false
    }
  }

  const press = (): Promise<boolean> => {
    if (waiting) return Promise.resolve(false)
    waiting = true
    return h.queue(plan)
  }
  return { press, scheduledSay }
}
