// The Help screen, as HTML the server sends (ADR 0054).
//
// IT WAS ALWAYS THIS, and the file it replaced said so at the top: *"Pure server component
// (static), so it ships no client JS."* That was true of the design and false of the build —
// the screen shipped inside a 15 KB React chunk, behind the bundle, behind the route table.
// The comment is true now.
//
// NO ISLAND. It is the first screen registered with `island: null`, and the only interactive
// thing on it is an index of `#` links, which is the browser's own.
//
// WHO READS IT MATTERS HERE more than on any other screen. This is what somebody opens on their
// first day with a blog they just installed, on whatever connection they have — and the
// measurement that decides these conversions was taken at 500 KB/s for exactly that reason.
import type { SiteSettings } from '@/types'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { APP_VERSION } from '@/version'
import {
  A, CODE, P, SHEET, TABLE_FRAME, TABLE_SCROLL, THEAD, TROW,
} from '@/admin-shared/kit'
import { SECTION } from '@/admin-shared/scale'
import { chordSpellings } from '@/web/admin/rail-rows'
import { BUILTIN, SHORTCUTS } from '@/admin-shared/keys'
import { firstRunSteps } from '@/admin-shared/first-run'
import {
  HELP_INDEX, HELP_SECTIONS, MARKDOWN_ROWS, REPO, TROUBLE_ROWS, doc, type HelpRow,
} from '@/admin-shared/help'
import { pageHeader } from '@/web/admin/kit'

/**
 * A PANEL: a card living inside the one-sheet page. One radius step under the sheet's,
 * hairline edges, its title on a ruled header row. A card floating on the canvas keeps the
 * sheet register; a box in a box does not.
 */
const panel = (title: string, body: string): string =>
  `<section class="rounded-lg border border-neutral-100 dark:border-neutral-800">`
  + `<div class="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">`
  + `<h2 class="${SECTION}">${title}</h2></div>`
  + `<div class="card-body p-4">${body}</div></section>`

/**
 * Anchor target plus a scroll offset, so an index chip lands its heading BELOW the sticky
 * chrome rather than under it. `break-inside-avoid` keeps a card whole when the section grid is
 * laid out in CSS columns — without it a card can be sliced across the column break.
 */
const anchored = (id: string, body: string): string =>
  `<section id="${id}" class="mb-4 break-inside-avoid scroll-mt-24">${body}</section>`

/** A lookup table: you arrive knowing what you want and want the answer in one glance. */
function lookup(rows: HelpRow[], head: [string, string], firstWidth: string, literal: boolean): string {
  const cell = (text: string): string => literal
    ? `<code class="${CODE}">${escapeHtml(text)}</code>`
    : escapeHtml(text)
  return `<div class="${TABLE_FRAME}"><div class="${TABLE_SCROLL}"><table class="w-full text-sm">`
    + `<thead class="${THEAD}"><tr>`
    + `<th class="${firstWidth} px-4 py-2.5 font-medium">${escapeHtml(head[0])}</th>`
    + `<th class="px-4 py-2.5 font-medium">${escapeHtml(head[1])}</th></tr></thead><tbody>`
    + rows.map(([a, b]) =>
      `<tr class="${TROW}">`
      + `<td class="px-4 py-2.5 align-top${literal ? '' : ' font-medium text-neutral-800 dark:text-neutral-200'}">${cell(a)}</td>`
      + `<td class="px-4 py-2.5 align-top ${P}">${escapeHtml(b)}</td></tr>`).join('')
    + `</tbody></table></div></div>`
}

/**
 * The editor's keyboard, printed from the same list the handlers read.
 *
 * BOTH SPELLINGS, because the server has no platform to ask: the chord cell carries the Mac
 * form in `data-mac` and the boot script swaps it in before the first paint. The same mechanism
 * the rail's search key uses, and the reason it is called `data-chord` rather than something
 * about the rail.
 *
 * This product's own chords first, then the ones the editor brings. Somebody arriving here
 * already knows Ctrl+B; what they came to find out is that the highlighter has a key at all.
 */
function shortcuts(): string {
  const rows = [...SHORTCUTS, ...BUILTIN]
  return `<div class="${TABLE_FRAME}"><div class="${TABLE_SCROLL}"><table class="w-full text-sm">`
    + `<thead class="${THEAD}"><tr><th class="w-1/3 px-4 py-2.5 font-medium">Press</th>`
    + `<th class="px-4 py-2.5 font-medium">And it does</th></tr></thead><tbody>`
    + rows.map((s) =>
      `<tr class="${TROW}"><td class="px-4 py-2.5 align-top">`
      + `<code data-chord class="${CODE}">`
      + `${chordSpellings(s.chord)}</code></td>`
      + `<td class="px-4 py-2.5 align-top ${P}">${escapeHtml(s.does)}</td></tr>`).join('')
    + `</tbody></table></div></div>`
}

/**
 * The five, as reference rather than as a checklist.
 *
 * No ticks here, deliberately, and the React version said why: the Help page renders the same
 * five as a path to READ, and ticking them would answer a question nobody opened the page to
 * ask. `tabular-nums` on the counter, because five numbers in a column that do not line up read
 * as five unrelated things rather than one path.
 */
function firstRun(t: ReturnType<typeof adminT>): string {
  return `<ol class="grid gap-x-6 gap-y-4 sm:grid-cols-2">`
    + firstRunSteps(t).map((s, i) =>
      `<li class="flex gap-3">`
      + `<span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-xs font-medium tabular-nums text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">${i + 1}</span>`
      // A `div` and a `p`, not two spans: a paragraph is not phrasing content and may not sit
      // inside a span, and the admin's reading face is applied to `p` — as a span the body
      // rendered in the chrome font while the line above it rendered in the reading one.
      + `<div class="min-w-0">`
      + `<a href="${escapeAttr(s.href)}" class="text-sm font-medium underline-offset-2 hover:underline text-neutral-900 dark:text-neutral-100">${escapeHtml(s.label)}</a>`
      + `<p class="mt-0.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">${escapeHtml(s.body)}</p>`
      + `</div></li>`).join('')
    + `</ol>`
}

export async function helpScreen(settings: SiteSettings): Promise<string> {
  const t = adminT(settings.language)
  const ext = (href: string, text: string): string =>
    `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" class="${A}">${escapeHtml(text)}</a>`

  // ONE SHEET, sections packed TWO columns wide. Each section is a hairline PANEL inside the
  // sheet, and CSS COLUMNS pack them: the panels are wildly different heights, and a grid would
  // leave a dead gap under every short one.
  const body = `<div class="space-y-5 p-5">`
    + `<p class="text-sm text-neutral-500 dark:text-neutral-400">Everything this blog can do, and where each thing lives. Start at the top if it is a new site; jump to a section if you are looking something up.</p>`
    + panel(escapeHtml(t.firstRunTitle), firstRun(t))
    // The index is STICKY, and it is CSS rather than a widget: this page runs to about six
    // screens, and an index that scrolls away at screen one is an index you can only use before
    // you have read anything. `-mx-5 px-5` so the backdrop covers the sheet's own padding
    // instead of leaving 20px of text sliding past either end.
    //
    // ⚠️ NO SEARCH BOX, and that is the whole reason this screen has no island: a box that
    // filters needs script, and the settings search and the command palette already reach every
    // setting by name.
    + `<nav class="sticky top-0 z-10 -mx-5 flex flex-wrap gap-2 border-b border-neutral-100 bg-white/95 px-5 py-3 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-900/95">`
    + HELP_INDEX.map(([id, label]) =>
      `<a href="#${id}" class="rounded-lg border border-neutral-200 px-2.5 py-1 text-sm text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-neutral-100">${escapeHtml(label)}</a>`).join('')
    + `</nav>`
    + `<div class="columns-1 gap-5 xl:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid">`
    + HELP_SECTIONS.map((s) => anchored(s.id, panel(s.title, s.body))).join('')
    + `</div>`
    + anchored('markdown', panel('Markdown the editor understands',
      `<p class="${P} mb-3">Standard Markdown, plus these. The toolbar inserts most of them for you.</p>`
      + lookup(MARKDOWN_ROWS, ['Type this', 'And you get'], 'w-1/3', true)))
    + anchored('keys', panel('Keys the editor answers to',
      `<p class="${P} mb-3">On top of the usual bold, italic, headings and undo.</p>${shortcuts()}`))
    + anchored('trouble', panel('When something looks wrong',
      `<p class="${P} mb-3">The problems that actually come up, and what fixes each.</p>`
      + lookup(TROUBLE_ROWS, ['Symptom', 'What to do'], 'w-2/5', false)))
    + `<p class="pt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">`
    + `${ext(REPO, 'Quire Ink')} v${escapeHtml(APP_VERSION)} · `
    + `${ext(doc('LICENSE-EXCEPTION.md'), 'PolyForm NC + hosting')} · `
    + `${ext(`${REPO}#readme`, 'README')}</p>`
    + `</div>`

  return `<div data-screen="help">`
    + pageHeader({ title: t.navHelp })
    + `<div class="${SHEET}">${body}</div></div>`
}
