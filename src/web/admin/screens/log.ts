// The activity log, as HTML the server sends (ADR 0054, step 1).
//
// THE FIRST SCREEN TO CONVERT, and it was chosen by measuring rather than by the plan: 0054
// names the forms first on the reasoning that a form is "mostly inputs that POST", but the
// settings screen is 7,120 lines across 62 components of its own, seven times the next
// heaviest. The log is 220 lines across two. Cheapest first is the right rule; which screen is
// cheapest was a guess.
//
// EVERY ROW IS IN THE MARKUP, and the three controls filter what is already there. That is not
// a compromise of the old behaviour, it is what the old behaviour already was: the endpoint
// caps at 200 entries, React fetched all of them and filtered in memory, and the search box
// has to answer a keystroke without a round trip. So the server sends the same 200 rows it
// used to send as JSON, spelled as sentences instead, and the island hides the ones that do
// not match. The same trick the rail uses, for the same reason.
//
// The clear control is the sheet-top's one tool, and it is the only thing on this screen that
// writes anything.
import type { ActivityEntry } from '@/server/activity'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { adminT } from '@/i18n/admin-i18n'
import { formatDateTimeShort, escapeAttr, escapeHtml } from '@/utils'
import { ICONS } from '@/icons'
import { SHEET_TOOL, SHEET_TOOL_DANGER } from '@/admin-shared/kit'
import { glyphOf, kindOf, logSentence, type LogKind } from '@/admin-shared/log-sentence'
import { fold } from '@/admin-shared/fold'
import { emptyState, pageHeader, select, sheet, sheetTop } from '@/web/admin/kit'
import { logView } from '@/web/admin/views'
import type { SiteSettings } from '@/types'

/** How many rows stand on screen before "show more". A rendering decision, not a round trip. */
const PAGE = 50

const KINDS: LogKind[] = ['writing', 'media', 'people', 'settings', 'system', 'security', 'error']

/** One 14px glyph, from the shared set, so the log looks like the rest of the admin. */
const rowGlyph = (action: string): string =>
  `<svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0 text-neutral-400 dark:text-neutral-500"`
  + ` fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"`
  + ` stroke-linejoin="round" aria-hidden="true">${ICONS[glyphOf(action)]}</svg>`

/**
 * One line of the ledger: time, the glyph, the sentence.
 *
 * `data-kind`, `data-at` and `data-find` are what the island filters on. They are written HERE
 * rather than re-derived in the browser because the answer is the server's: `kindOf` and
 * `logSentence` read the same tables either way, and a second implementation of "which kind is
 * this action" is a second place for the log to disagree with itself.
 *
 * `data-find` is the folded haystack — sentence, detail and code, accents stripped — so a
 * keystroke is one `includes` per row rather than a fold of two hundred strings.
 */
function row(t: AdminStrings, e: ActivityEntry, i: number): string {
  // PAST THE FIRST PAGE IT ARRIVES HIDDEN, so the first paint is the fifty rows the old screen
  // drew and not two hundred. The island owns it from there: a filter changes WHICH fifty, so
  // the count cannot be baked into the markup beyond this first answer.
  const sentence = logSentence(t, e.action, e.detail)
  const find = fold(`${sentence} ${e.detail} ${e.action}`)
  // The machine's own words, kept where somebody debugging an install can reach them and
  // nobody else has to read them.
  const title = `${e.action}${e.detail ? ` — ${e.detail}` : ''}`
  return `<li data-log-row${i >= PAGE ? ' hidden' : ''} data-kind="${kindOf(e.action)}" data-at="${new Date(e.at).getTime()}"`
    + ` data-find="${escapeAttr(find)}" style="--i:${i}"`
    + ` title="${escapeAttr(title)}"`
    + ` class="flex items-center gap-2.5 border-b border-neutral-100 px-5 py-2 text-xs transition-colors hover:bg-neutral-50/70 dark:border-neutral-800 dark:hover:bg-neutral-800/30">`
    + `<span class="whitespace-nowrap tabular-nums text-neutral-500 dark:text-neutral-400">${escapeHtml(formatDateTimeShort(e.at))}</span>`
    + rowGlyph(e.action)
    + `<span class="min-w-0 truncate ${e.action === 'error'
      ? 'font-medium text-neutral-900 dark:text-white'
      : 'text-neutral-600 dark:text-neutral-300'}">${escapeHtml(sentence)}</span>`
    + `</li>`
}

export async function logScreen(settings: SiteSettings): Promise<string> {
  const t = adminT(settings.language)
  const { entries, enabled } = await logView()

  const kindOptions: [string, string][] = [
    ['all', t.logKindAll],
    ...KINDS.map((k) => [k, {
      writing: t.logKindWriting, media: t.logKindMedia, people: t.logKindPeople,
      settings: t.logKindSettings, system: t.logKindSystem, security: t.logKindSecurity,
      error: t.logKindError,
    }[k]] as [string, string]),
  ]

  const tools = `<span data-log-count class="${SHEET_TOOL}">${entries.length} · ${escapeHtml(t.logTitle.toLowerCase())}</span>`
    + select({ name: 'kind', label: t.logKindAll, options: kindOptions, value: 'all', attrs: 'data-log-kind' })
    + select({
      name: 'when',
      label: t.logWhenAll,
      options: [['0', t.logWhenAll], ['7', t.logWhen7], ['30', t.logWhen30]],
      value: '0',
      attrs: 'data-log-days',
    })
    + `<input type="search" data-log-search placeholder="${escapeAttr(t.logSearch)}" aria-label="${escapeAttr(t.logSearch)}"`
    + ` class="h-8 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">`
    + (entries.length > 0
      ? `<button type="button" data-log-clear class="${SHEET_TOOL_DANGER}">${escapeHtml(t.logClear)}</button>`
      : '')

  // `logDisabled` names the tab it sends the owner to, and the dictionary marks the spot with
  // `{tab}`. The React face had a `useTabbed` hook for this; here it is one replace.
  const off = enabled ? '' : `<p class="border-b border-neutral-100 bg-neutral-50 px-5 py-2.5 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">`
    + `${escapeHtml(t.logDisabled.replace('{tab}', t.tabAccount))}</p>`

  // THREE STATES, all three drawn, and CSS picks — the rail's trick again. "Nothing has
  // happened yet" and "nothing matched what you typed" are different facts, and the DRAWING is
  // what tells them apart before the sentence is read; the lens is not the blank page.
  const body = entries.length === 0
    ? emptyState({ title: t.logEmpty, description: t.logEmptyHint, glyph: 'blankPage' })
    : `${emptyState({ title: t.logNoMatch, glyph: 'lens', hidden: true })}`
      + `<ul data-log-list class="admin-stagger paper-cols">${entries.map((e: ActivityEntry, i: number) => row(t, e, i)).join('')}</ul>`
      + `<div data-log-more class="px-5 py-3"${entries.length > PAGE ? '' : ' hidden'}>`
      + `<button type="button" class="${SHEET_TOOL}">${escapeHtml(t.logShowMore.replace('{n}', String(PAGE)))}</button></div>`

  // The four words the island can need to say, and only those. Not a dictionary: the server
  // has already written every other string on this screen into the markup.
  const ask = escapeAttr(JSON.stringify({
    title: t.askClearLogTitle, body: t.askClearLogBody,
    yes: t.askClear, no: t.askCancel, failed: t.deleteFailed,
  }))
  return `<div data-screen="log" data-log-page="${PAGE}" data-log-ask="${ask}">`
    + pageHeader({ title: t.logTitle })
    + sheet(sheetTop(tools) + off + body)
    + `</div>`
}
