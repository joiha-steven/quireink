// Newsletter → People: who is on the list, and what each address has actually been sent
// (ADR 0054). Counts come from the `newsletter_sends` log, so "5 emails" means five emails
// really left the server, not five attempts. Open rate covers broadcasts only, since the
// tracking pixel rides on those; a dash means nothing to measure yet.
//
// ⚠️ A LIST OF PEOPLE IS A TABLE, and this was once a run-on sentence per person joined by
// middots. At 390px it wrapped to two lines with a separator starting the second, so a `·`
// read as a bullet; at 1440 the five facts sat at five different x positions on every row, so
// no column could be compared down the page, which is the only thing a subscriber list is FOR.
// Columns from 640px up, one card per person below it.
//
// ⚠️ EVERY ROW SHIPS, AND THE ISLAND PAGES BY HIDING. That is what the React face already did
// in memory: the endpoint has always handed back the whole list so that the search and the
// status filter could run over ALL of it, and a search that only looks at the fifty rows in
// front of you is worse than no search, because it answers "not found" about a list it never
// read. What changed is that the rows are now markup rather than JSON.
//
// THE COST OF THAT, MEASURED, so the next person has the number rather than a guess: one row
// is about 620 bytes of HTML against about 190 bytes of JSON for the same subscriber. A list
// of 500 is 310 KB and fine; a list of 20,000 would be 12 MB and is not, and at that size the
// JSON face was already 3.8 MB. Whoever meets that wall moves the search to the server for
// both faces at once; splitting them is what this screen must never do.
import type { SiteLang } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { formatCount } from '@/i18n/format'
import { CONTROL_SM, ICON_KEY, TABLE_SCROLL, THEAD, TROW } from '@/admin-shared/kit'

import { emptyState, icon, lamp, selectionBar, tabs, tick } from '@/web/admin/kit'
import { numBand } from '@/web/admin/kit-figures'
// Fifty a page. The island never draws a row; it decides which of these fifty-somethings
// show, and it reads the same constant so the two cannot disagree about what a page is.
import { SUBSCRIBERS_PER_PAGE as PER_PAGE } from '@/admin-shared/analytics'
import type { subscribersView } from '@/web/admin/views-news'

type People = Awaited<ReturnType<typeof subscribersView>>
type Row = People['subscribers'][number]


const shortDate = (iso?: string): string => (iso ? iso.slice(0, 10) : '—')

/**
 * Confirmed is the only state that is DONE. Pending is waiting on the reader and unsubscribed
 * is a decision they made, so neither is a fault and neither is red: the lamp's `off` is
 * exactly "there is nothing to be right or wrong about here".
 */
const LAMP = { confirmed: 'good', pending: 'attention', unsubscribed: 'off' } as const

const openRate = (s: Row['stats']): string | null =>
  s && s.broadcasts > 0 ? `${Math.round((s.opened / s.broadcasts) * 100)}%` : null


export function peoplePanel(t: AdminStrings, lang: SiteLang, data: People, open: boolean): string {
  const { subscribers, counts } = data
  const n = (x: number): string => escapeHtml(formatCount(x, lang))
  const statusLabel: Record<string, string> = {
    confirmed: t.nlConfirmed, pending: t.nlPending, unsubscribed: t.nlUnsub,
  }

  const band = numBand([
    { n: formatCount(counts.confirmed, lang), label: t.nlConfirmed },
    {
      n: formatCount(counts.pending, lang),
      // The pen's own mark in front of it, the same one the write list puts against an
      // unfinished piece: pending is not a fault, it is something still in motion.
      labelHtml: `<span aria-hidden="true" class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--pen-edge)] align-middle"></span>`
        + escapeHtml(t.nlPending),
    },
    { n: formatCount(counts.unsubscribed, lang), label: t.nlUnsub },
  ])

  if (subscribers.length === 0) {
    return `<div data-nl-panel="people"${open ? '' : ' hidden'}>${band}`
      + `<div class="p-8">${emptyState({ glyph: 'letter', title: t.nlNoSubs, description: t.nlNoSubsHint })}</div>`
      + `</div>`
  }

  // `data-find` is the address LOWERCASED and nothing else: not accent-folded, unlike the log
  // and the piece index. An address is a machine identifier, and folding `renée@` to `renee@`
  // would let one search claim two different mailboxes are the same person.
  const row = (s: Row, i: number): string => {
    const rate = openRate(s.stats)
    const failed = s.stats && s.stats.failed > 0
      ? `<span class="ml-1 text-[var(--pen-red)]" title="${escapeAttr(s.stats.lastError ?? '')}">+${n(s.stats.failed)}</span>`
      : ''
    // The five fields the CSV carries, on the row, because the island must not read them back
    // out of the cells: the Sent cell also prints failures and the rate cell prints an em-dash
    // where the export wants an empty field, so a file built from the rendering would differ
    // from the file the React face wrote in exactly two columns.
    return `<tr data-sub data-id="${s.id}" data-status="${escapeAttr(s.status)}"`
      + ` data-find="${escapeAttr(s.email.toLowerCase())}" data-email="${escapeAttr(s.email)}"`
      + ` data-joined="${escapeAttr(shortDate(s.createdAt))}" data-sent="${s.stats?.sent ?? 0}"`
      + ` data-rate="${escapeAttr(rate ?? '')}" class="${TROW}"${i < PER_PAGE ? '' : ' hidden'}>`
      + `<td class="px-4 py-2 align-middle">${tick({ label: s.email, attrs: `data-sub-pick data-id="${s.id}"` })}</td>`
      // `max-w-0` beside the head's `w-full`: without it every column shared the width evenly
      // and the one variable-length thing on the row, the address, was truncated beside 300px
      // of empty Status column.
      + `<td class="max-w-0 px-2 py-2 align-middle">`
      + `<span class="block truncate font-medium text-neutral-800 dark:text-neutral-200" title="${escapeAttr(s.email)}">${escapeHtml(s.email)}</span></td>`
      + `<td class="whitespace-nowrap px-2 py-2 align-middle">`
      + `<span class="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">`
      + lamp({ state: LAMP[s.status] }) + escapeHtml(statusLabel[s.status] ?? s.status) + `</span></td>`
      + `<td class="whitespace-nowrap px-2 py-2 align-middle tabular-nums text-neutral-500 dark:text-neutral-400">${escapeHtml(shortDate(s.createdAt))}</td>`
      // Failures are the whole point of keeping the log. Never hide them.
      + `<td class="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums text-neutral-500 dark:text-neutral-400">${n(s.stats?.sent ?? 0)}${failed}</td>`
      + `<td class="whitespace-nowrap px-2 py-2 text-right align-middle tabular-nums text-neutral-500 dark:text-neutral-400">${escapeHtml(rate ?? '—')}</td>`
      + `<td class="px-2 py-2 text-right align-middle">`
      + `<button type="button" data-sub-drop data-id="${s.id}" class="${ICON_KEY}" aria-label="${escapeAttr(t.nlDeleteSub)}">`
      + icon('close') + `</button></td></tr>`
  }

  const card = (s: Row, i: number): string => {
    const rate = openRate(s.stats)
    return `<li data-sub-card data-id="${s.id}" style="--i: ${i}"`
      + ` class="border-b border-neutral-100 px-5 py-3 dark:border-neutral-800"${i < PER_PAGE ? '' : ' hidden'}>`
      + `<div class="flex items-start gap-3">`
      + tick({ label: s.email, className: 'mt-0.5', attrs: `data-sub-pick data-id="${s.id}"` })
      + `<div class="min-w-0 flex-1">`
      + `<span class="block truncate text-sm font-medium text-neutral-800 dark:text-neutral-200" title="${escapeAttr(s.email)}">${escapeHtml(s.email)}</span>`
      + `<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">`
      + `<span class="flex items-center gap-1.5">${lamp({ state: LAMP[s.status] })}${escapeHtml(statusLabel[s.status] ?? s.status)}</span>`
      + `<span class="tabular-nums">${escapeHtml(shortDate(s.createdAt))}</span>`
      + `<span class="tabular-nums">${escapeHtml(t.nlColSent)} ${n(s.stats?.sent ?? 0)}</span>`
      + (rate ? `<span class="tabular-nums">${escapeHtml(t.nlColOpenRate)} ${escapeHtml(rate)}</span>` : '')
      + `</div></div>`
      + `<button type="button" data-sub-drop data-id="${s.id}" class="${ICON_KEY} -mr-1.5 shrink-0"`
      + ` aria-label="${escapeAttr(t.nlDeleteSub)}">${icon('close')}</button>`
      + `</div></li>`
  }

  const head = [t.nlColStatus, t.nlColJoined]
  const table = `<div class="hidden sm:block ${TABLE_SCROLL}"><table class="w-full text-sm">`
    + `<thead class="${THEAD}"><tr><th class="w-9 px-4 py-2.5"></th>`
    + `<th class="w-full px-2 py-2.5 font-medium">${escapeHtml(t.nlColEmail)}</th>`
    + head.map((h) => `<th class="px-2 py-2.5 font-medium">${escapeHtml(h)}</th>`).join('')
    + `<th class="px-2 py-2.5 text-right font-medium">${escapeHtml(t.nlColSent)}</th>`
    + `<th class="px-2 py-2.5 text-right font-medium">${escapeHtml(t.nlColOpenRate)}</th>`
    + `<th class="w-12 px-2 py-2.5"></th></tr></thead>`
    + `<tbody>${subscribers.map(row).join('')}</tbody></table></div>`
    + `<ul class="admin-stagger sm:hidden">${subscribers.map(card).join('')}</ul>`

  const tools = `<div class="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">`
    + `<input type="search" data-sub-search placeholder="${escapeAttr(t.nlSearchPlaceholder)}"`
    + ` aria-label="${escapeAttr(t.nlSearchPlaceholder)}" class="${CONTROL_SM} min-w-0 flex-1">`
    + tabs({
      items: [
        { key: 'all', label: t.filterAll },
        { key: 'confirmed', label: t.nlConfirmed },
        { key: 'pending', label: t.nlPending },
        { key: 'unsubscribed', label: t.nlUnsub },
      ],
      value: 'all',
      attrs: 'data-sub-scope',
    })
    + selectionBar({
      clearLabel: t.clearSelection,
      deleteLabel: t.deleteSelected,
      attrs: 'data-sub-bar',
      extras: `<button type="button" data-sub-export class="-my-2 py-2 text-sm text-neutral-500`
        + ` hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">${escapeHtml(t.nlExportCsv)}</button>`,
    })
    + `</div>`

  // A control that says "1-25 of 25" beside two dead arrows is furniture, so the paging line
  // ships hidden and the island raises it only when the filter leaves more than one page.
  const paging = `<div data-sub-paging class="flex items-center justify-between gap-3 px-5 py-3 text-xs text-neutral-500 dark:text-neutral-400" hidden>`
    + `<span data-sub-showing class="tabular-nums"></span><span class="flex items-center gap-3">`
    + `<button type="button" data-sub-prev class="-my-2 py-2 disabled:opacity-40 hover:text-neutral-900 dark:hover:text-white">${escapeHtml(t.nlPagePrev)}</button>`
    + `<button type="button" data-sub-next class="-my-2 py-2 disabled:opacity-40 hover:text-neutral-900 dark:hover:text-white">${escapeHtml(t.nlPageNext)}</button>`
    + `</span></div>`

  return `<div data-nl-panel="people"${open ? '' : ' hidden'}>${band}${tools}`
    + `<div data-sub-nomatch class="p-8" hidden>${emptyState({ glyph: 'lens', title: t.nlNoMatch })}</div>`
    + `<div data-sub-rows>${table}</div>${paging}</div>`
}
