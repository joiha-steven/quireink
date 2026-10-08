// WHAT THE SHEET SAYS ABOUT WHERE THE PIECE STANDS: the line under the title, the main key's word,
// the live link and the figures link, and the name of the second status radio.
//
// Every one of them is read from what the SERVER holds (`admin-shared/sheet-state.ts`), never
// from the form: ticking Published on a draft nobody had saved turned the line to "Published"
// and raised a "View post" onto a 404. The form decides only what the main key would DO.
import { LIVE_PATH, type SheetDraft, type SheetKind, type SheetWords } from '@/admin-shared/sheet-wire'
import { mainWord, metaLineOf, type Standing } from '@/admin-shared/sheet-state'
import type { SiteLang } from '@/types'
import type { Bar } from './sheet-bar'

export type StandingParts = {
  bar: Bar
  metaLine: HTMLElement | null
  /** The published radio's label: Published or Scheduled, by the date the form holds. */
  statusOut: HTMLElement | null
  stats: HTMLAnchorElement | null
}

export type StandingNow = {
  kind: SheetKind
  slug: string
  /** What the server holds. */
  st: Standing
  savedDate: string
  /** What the form holds, and whether its date is ahead. */
  chosen: SheetDraft['status']
  chosenAhead: boolean
  /** The date part of the line for anything not scheduled, already formatted. */
  touched: string
}

export function sayStanding(parts: StandingParts, t: SheetWords, lang: SiteLang, now: StandingNow): void {
  const { bar, metaLine, statusOut, stats } = parts
  const { kind, slug, st } = now
  bar.setMain(mainWord(st, now.chosen, now.chosenAhead), st !== 'draft')
  if (statusOut) {
    statusOut.textContent = (now.chosenAhead ? statusOut.dataset.sayLater : statusOut.dataset.sayNow) ?? ''
  }
  const live = st === 'published' && slug !== ''
  bar.setLive(live ? LIVE_PATH[kind](slug) : null)
  if (stats) {
    stats.hidden = !live
    if (live) stats.href = `/admin/analytics?path=${encodeURIComponent(`/${slug}`)}`
  }
  // REWRITTEN rather than left as drawn: a Publish that left it reading "Draft" is the screen
  // disagreeing with itself about the thing the writer just did.
  if (metaLine) metaLine.textContent = metaLineOf(kind, t, st, now.savedDate, now.touched, lang)
}
