// Settings → Server: WHAT THE SITE SAYS TO THE WORLD, and what it lets somebody else's code
// say inside its pages.
//
// Three of the tab's nine cards. The crawler switches and the two snippet boxes are ordinary
// settings keys and share one card with one Save; the redirect table and the importer are made
// of ACTIONS that each commit when pressed, so they are plain cards with no Save key at all —
// a card whose every control has already committed has nothing left for one to do.
//
// ⚠️ MARKUP AND NOTHING ELSE (ADR 0054). Every control here is inert: a `type="button"` with a
// hook on it, a field with a `data-*` name, and no behaviour behind either. There is no
// `<form>` on this tab, and on THIS file that is load-bearing rather than tidy — a form would
// let Return in the redirect's "From" box fire the importer.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SeoSettings, SiteSettings } from '@/types'
import type { Redirect } from '@/server/redirects'
import { formatCount } from '@/i18n/format'
import { escapeAttr, escapeHtml } from '@/utils'
import { unclosed, snippetBytes } from '@/admin-shared/snippet'
import { ICON_KEY, buttonClass } from '@/admin-shared/kit'
import { NOTE_TEXT, SETTING_GAP } from '@/admin-shared/scale'
import { group, panelCard, settingRow, switchList, switchRow, textControl } from '@/web/admin/fields'
import { pairGrid } from '@/web/admin/fields-box'
import { checkField } from '@/web/admin/fields-pick'
import { pickedImage } from '@/web/admin/fields-pic'
import { emptyState, icon } from '@/web/admin/kit'

/** One crawler feature: the key it stores, its name, the sentence under it, and the path it
 *  serves. Acronym labels (Sitemap, RSS Feed, llms.txt, robots.txt) stay literal. */
type Crawl = { k: Exclude<keyof SeoSettings, 'ogFallbackImage'>; label: string; note: string; path: string }

const CRAWL = (t: AdminStrings): Crawl[] => [
  { k: 'autoSchema', label: t.seoAutoSchema, note: t.seoAutoSchemaDesc, path: '' },
  { k: 'sitemap', label: 'Sitemap', note: t.seoSitemapDesc, path: '/sitemap.xml' },
  { k: 'rss', label: 'RSS Feed', note: t.seoRssDesc, path: '/feed.xml' },
  { k: 'llms', label: 'llms.txt', note: t.seoLlmsDesc, path: '/llms.txt' },
  { k: 'robots', label: 'robots.txt', note: t.seoRobotsDesc, path: '/robots.txt' },
  { k: 'ogImage', label: t.seoOgImage, note: t.seoOgImageDesc, path: '/og' },
]

/**
 * How machines see the site: six switches, and the picture used when a post has none.
 *
 * The fallback picker was hand-written in React — a 144×80 slot, the words beside it, and the
 * two keys after — under a comment saying it was the ONE picker that put its words inside the
 * slot and therefore landed its button 136px right of every other picker's. `pickedImage` with
 * `row` and a `slotClass` IS that arrangement, drawn once, so the drift the comment describes
 * cannot come back.
 */
function crawlers(t: AdminStrings, s: SiteSettings): string {
  const box = 'h-20 w-36 shrink-0 rounded-lg'
  return `<div class="${SETTING_GAP}">`
    + switchList(CRAWL(t).map((f) => switchRow({
      k: `seo.${f.k}`, label: f.label, note: f.note, badge: f.path || undefined,
      on: s.seo[f.k],
    })).join(''))
    + settingRow({
      label: t.seoFallbackLabel,
      control: pickedImage({
        k: 'seo.ogFallbackImage', value: s.seo.ogFallbackImage, row: true,
        chooseLabel: t.chooseImage, removeLabel: t.removeSelection, emptyLabel: t.noImageSelected,
        alt: 'OG', slotClass: box,
        previewClass: `${box} border border-neutral-200 object-cover dark:border-neutral-800`,
      }),
    })
    + `</div>`
}

/**
 * THE BOX WHERE SOMEBODY ELSE'S SERVICE GETS TO RUN, as HTML.
 *
 * Not `textArea`: that primitive boxes its input in the form chrome, and this is a code field
 * with a line gutter welded to it — the gutter SCROLLS with the text rather than being painted
 * into it, so a wrapped line keeps one number. Written out here for that reason and no other;
 * the classes are React's own, unchanged.
 *
 * ⚠️ THE STATUS SHIPS IN BOTH FACES AND ONE WRAPPER. "412 bytes" and "never closed: <script>"
 * are one span in React that changes colour; here they are two spans in a box that is hidden
 * while the field is empty — an empty box would still be a flex item, and the 12px gap beside
 * it would indent the note under a field nobody has typed in yet. Both boxes ship empty on
 * every install, so that is the state most owners meet.
 *
 * The three WORDS ride on the wrapper. The island has no locale dictionary to rebuild the
 * sentence from, the same reason the account screen's recovery count carries `data-tpl`.
 */
function snippetBox(t: AdminStrings, f: {
  k: string; value: string; label: string; note: string; placeholder: string; lang: SiteSettings['language']
}): string {
  const lines = f.value.split('\n').length
  const problem = f.value === '' ? null : unclosed(f.value)
  const said = problem
    ? (problem.depth > 0 ? `${t.snippetUnclosed} <${problem.tag}>` : `${t.snippetStray} </${problem.tag}>`)
    : ''
  const numbers = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('')
  return `<div class="space-y-2">`
    + `<p class="text-xs font-medium text-neutral-700 dark:text-neutral-300">${escapeHtml(f.label)}</p>`
    + `<div class="flex overflow-hidden rounded-md border border-neutral-300 focus-within:border-neutral-400 dark:border-neutral-700">`
    + `<div aria-hidden="true" data-snippet-gutter class="max-h-64 shrink-0 select-none overflow-hidden border-r border-neutral-200 bg-neutral-50 px-2 py-2 text-right font-mono text-xs leading-5 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-600">`
    + `${numbers}</div>`
    + `<textarea rows="6" spellcheck="false" data-snippet-editor data-k="${escapeAttr(f.k)}"`
    + ` aria-label="${escapeAttr(f.label)}" placeholder="${escapeAttr(f.placeholder)}"`
    + ` class="max-h-64 min-h-28 w-full resize-y bg-white px-3 py-2 font-mono text-xs leading-5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600">`
    + `${escapeHtml(f.value)}</textarea></div>`
    + `<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">`
    + `<span data-snippet-state data-word-bytes="${escapeAttr(t.cssBytes)}"`
    + ` data-word-unclosed="${escapeAttr(t.snippetUnclosed)}"`
    + ` data-word-stray="${escapeAttr(t.snippetStray)}"${f.value === '' ? ' hidden' : ''}>`
    + `<span class="text-xs tabular-nums text-neutral-500 dark:text-neutral-400" data-snippet-size`
    + `${problem ? ' hidden' : ''}>${escapeHtml(formatCount(snippetBytes(f.value), f.lang))} ${escapeHtml(t.cssBytes)}</span>`
    + `<span class="text-xs tabular-nums text-[var(--pen-edge)]" data-snippet-problem`
    + `${problem ? '' : ' hidden'}>${escapeHtml(said)}</span></span>`
    + `<span class="text-xs text-neutral-500 dark:text-neutral-400">${escapeHtml(f.note)}</span>`
    + `</div></div>`
}

const SCRIPT_PH = '<script defer src="https://example.com/script.js"></script>'
const BEACON_PH = '<script defer src="https://example.com/beacon.js"></script>'

/**
 * THE FIRST CARD: two questions with one Save between them.
 *
 * It was ONE card holding all five groups of ordinary keys, which measured 1,389px and took the
 * tab to 2,188 against the 1,800 the regrouping was measured to fix. The split is on the line
 * the tab already draws — what the SITE says to the world here, what the INSTALL does on its
 * own in `settings-server-ops.ts`.
 *
 * ⚠️ THE LAMP SHIPS GREEN. Nothing is dirty in a document just written and these keys need no
 * far end to answer, so `good` is what the server can see; `connectionCard`'s own rule — amber
 * beats green the moment there are unsaved edits — is the island's to apply from there.
 */
export function siteCard(t: AdminStrings, s: SiteSettings): string {
  // Crawlers and two code boxes: settings, with nothing to try and nothing to report. It wore
  // a hardcoded green lamp and a second Save key until 2026-09-19.
  return panelCard({
    title: t.cardServerSettings,
    body: group({ title: t.tabServer, first: true, body: crawlers(t, s) })
      + group({
        title: t.cardCustomCode, note: t.customCodeNote,
        body: `<div class="space-y-5">`
          + snippetBox(t, {
            k: 'customHead', value: s.customHead, label: t.customHeadLabel,
            note: t.customHeadHint, placeholder: SCRIPT_PH, lang: s.language,
          })
          + snippetBox(t, {
            k: 'customBodyEnd', value: s.customBodyEnd, label: t.customBodyEndLabel,
            note: t.customBodyEndHint, placeholder: BEACON_PH, lang: s.language,
          })
          + `</div>`,
      }),
  })
}

/**
 * ONE REDIRECT, and the same function draws the `<template>` the island clones.
 *
 * The rows the server knows ride in the markup; a row added after the page loaded is cloned
 * from the template, which keeps every WORD on the server where the locales are and stops the
 * island holding a second copy of this markup that drifts from it in silence.
 */
function redirectRow(t: AdminStrings, r?: Redirect): string {
  const code = r ? (r.permanent ? '301' : '302') : ''
  return `<li class="flex items-center gap-3 py-2 text-sm" data-redirect`
    + `${r ? ` data-redirect-id="${escapeAttr(String(r.id))}"` : ''}>`
    + `<span class="min-w-0 flex-1 truncate">`
    + `<code class="text-neutral-800 dark:text-neutral-200" data-redirect-from>`
    + `${escapeHtml(r?.source ?? '')}</code>`
    + `<span class="mx-1.5 text-neutral-500 dark:text-neutral-400">→</span>`
    + `<code class="text-neutral-600 dark:text-neutral-400" data-redirect-to>`
    + `${escapeHtml(r?.destination ?? '')}</code></span>`
    + `<span class="shrink-0 rounded-md border border-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400" data-redirect-code>`
    + `${code}</span>`
    // ⚠️ `ICON_KEY`, WHICH GIVES IT A BOX. This was a bare 16px glyph with no key around it —
    // a 16px hit target on a phone, where the same gesture on every other list row in the admin
    // is a 36px square with a 44px touch area behind it.
    + `<button type="button" data-redirect-delete aria-label="${escapeAttr(t.redirectDelete)}"`
    + ` title="${escapeAttr(t.redirectDelete)}" class="${escapeAttr(ICON_KEY)}">`
    + `${icon('close', 'h-4 w-4')}</button></li>`
}

/**
 * The redirect table and the row that adds one.
 *
 * ⚠️ THE ADD FIELDS CARRY NO `data-k`. They choose rather than store: what they make is a row
 * in the `redirects` table through `POST /api/redirects`, and a `data-k` would put them in the
 * sheet's diff and in the payload its one Save sends, where there is no settings key to receive
 * them. They wear `data-redirect-*` instead, which the form's reader does not look at.
 *
 * Both faces of the list ship drawn and in ONE box: the empty state and the `<ul>` are mutually
 * exclusive, and a stack that hides one of a pair hands the other a margin it never had
 * (`docs/admin-one-dom.md`, trap 5).
 *
 * The tick is `checkField`, where React had a bare `input[type=checkbox]` with no accent class —
 * one of the five controls that shipped painted in the OS blue on a monochrome admin.
 */
export function redirectsCard(t: AdminStrings, rows: Redirect[]): string {
  const list = `<div>`
    + emptyState({ title: t.redirectEmpty, hidden: rows.length > 0 })
    + `<ul class="divide-y divide-neutral-100 dark:divide-neutral-800" data-redirect-list`
    + `${rows.length > 0 ? '' : ' hidden'}>${rows.map((r) => redirectRow(t, r)).join('')}</ul>`
    + `<template data-redirect-row>${redirectRow(t)}</template></div>`
  return panelCard({
    title: t.redirectsTitle,
    body: `<div class="space-y-5">`
      + `<p class="${NOTE_TEXT}">${escapeHtml(t.redirectsHint)}</p>`
      + list
      + pairGrid(
        settingRow({
          label: t.redirectSource,
          control: textControl({
            value: '', label: t.redirectSource, placeholder: '/old-path', attrs: 'data-redirect-source',
          }),
        })
        + settingRow({
          label: t.redirectDestination,
          control: textControl({
            value: '', label: t.redirectDestination, placeholder: '/new-path',
            attrs: 'data-redirect-destination',
          }),
        }),
        'grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2 dark:border-neutral-800',
      )
      + `<div class="flex flex-wrap items-center justify-between gap-3">`
      + checkField({ label: t.redirectPermanent, on: true, attrs: 'data-redirect-permanent' })
      + `<button type="button" data-redirect-add disabled class="${buttonClass('primary', 'sm')}">`
      + `${escapeHtml(t.redirectAdd)}</button></div></div>`,
  })
}

/**
 * The importer: one file field, four platforms.
 *
 * The chosen file's name ships DRAWN AND EMPTY rather than absent, and the Import key ships
 * DISABLED — which is what React's first render also drew, with no file picked, and is the
 * right state for a page whose island has not started. A key that is live before anything is
 * wired is a key that does nothing when pressed, and this one bulk-writes posts.
 *
 * The three labels the button cycles through ride on it as attributes for the same reason the
 * snippet box carries its three words: the island has no dictionary, and the progress line
 * ("Bringing images home… 34/120") is built while the batches run.
 */
export function importCard(t: AdminStrings): string {
  const accept = '.xml,.json,.zip,text/xml,application/xml,application/json,application/zip'
  return panelCard({
    title: t.cardImport,
    body: `<div class="space-y-5">`
      + `<p class="${NOTE_TEXT}">${escapeHtml(t.importHelp)}</p>`
      + `<input type="file" hidden data-import-file accept="${accept}">`
      + `<div class="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-4 dark:border-neutral-700 dark:bg-neutral-900/50">`
      + `<div class="flex flex-wrap items-center gap-3">`
      + `<button type="button" data-import-choose class="${buttonClass('secondary', 'sm')}">`
      + `${escapeHtml(t.importChoose)}</button>`
      + `<span class="min-w-0 truncate text-sm text-neutral-600 dark:text-neutral-300" data-import-name hidden></span>`
      + `</div></div>`
      + `<button type="button" data-import-run disabled class="${buttonClass('primary', 'sm')}"`
      + ` data-label-idle="${escapeAttr(t.importRun)}" data-label-busy="${escapeAttr(`${t.importRun}…`)}"`
      + ` data-label-images="${escapeAttr(t.importImages)}">${escapeHtml(t.importRun)}</button>`
      + `</div>`,
  })
}
