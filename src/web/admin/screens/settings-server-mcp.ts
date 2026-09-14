// Settings → Server: THE DOOR AN AGENT COMES IN BY. One switch that is an ordinary settings
// key, the address to point a client at, and the tokens that open it.
//
// ⚠️ THE TOKEN TABLE SHIPS EMPTY, and there is no server read that would fill it. Tokens come
// from `GET /api/mcp/tokens`, which the page drawing this has not called — and the plaintext of
// one is shown ONCE, on creation, and never retrievable after, so there is nothing here that
// could be written into the markup even if the list were at hand. The table is drawn with its
// head, an empty `<tbody>` and a `<template>` for a row; "No tokens yet." is what is VISIBLE,
// because that is the honest state of a render that knows of none.
//
// ⚠️ NOTHING HERE MINTS ANYTHING. Every key is inert: `data-mcp-generate` is a `type="button"`
// with no handler, and the box that shows a new token is empty. A credential in this markup
// would be a credential in the page source of every settings screen ever opened.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings } from '@/types'
import { escapeAttr, escapeHtml } from '@/utils'
import { TABLE_SCROLL, buttonClass } from '@/admin-shared/kit'
import { PANEL, connectionCard, loadFailure, panelList } from '@/web/admin/fields-box'
import { settingRow, switchRow } from '@/web/admin/fields'
import { checkField } from '@/web/admin/fields-pick'
import { gate } from '@/web/admin/fields-pic'

/** The box a copyable value sits in: `min-h-9` matches the key beside it, `min-w-0` is what
 *  lets a long URL truncate instead of shoving the key off the row. */
const COPY_BOX = 'flex min-h-9 min-w-0 flex-1 items-center truncate rounded-lg border'
  + ' border-neutral-300 px-3 text-xs dark:border-neutral-700'

const TH = 'px-3 py-2 font-medium'
/** Four of the five columns fold away under `sm`: a name and a way to revoke it are what a
 *  phone has room for, and they are what somebody on one came to do. */
const TD_WIDE = 'hidden whitespace-nowrap px-3 py-2 text-neutral-500 sm:table-cell dark:text-neutral-400'

/**
 * ONE TOKEN, as the `<template>` the island clones — never a row built out of a string in
 * JavaScript, which would be a second copy of this markup drifting from it in silence and would
 * carry the WORDS with it, away from the locales (`fields-pic.ts` states the rule).
 *
 * Every varying part ships in both faces: the scope badge holds its two names with both hidden,
 * "Never" stands beside the last-used date, and "Expired" beside the expiry.
 *
 * ⚠️ THE BADGE'S HOOKS ARE NOT THE TICK BOXES' HOOKS. `data-mcp-scope-read` is the tick that
 * decides the NEXT token's grant; this row's badge says what an EXISTING token was given, so it
 * is `data-mcp-badge-read`. A state attribute is named for the thing it is on and never reused
 * (`docs/admin-one-dom.md`, trap 5) — and the same rule renamed this row's created-at cell to
 * `data-mcp-made`, away from the box that shows a just-minted token.
 */
function tokenRow(t: AdminStrings): string {
  const badge = `<span class="ml-2 rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400" data-mcp-scope hidden>`
    + `<span data-mcp-badge-read hidden>${escapeHtml(t.mcpReadOnly)}</span>`
    + `<span data-mcp-badge-code hidden>${escapeHtml(t.mcpCustomCode)}</span></span>`
  // ⚠️ THE ROW IS WRAPPED IN A TABLE SKELETON INSIDE THE TEMPLATE, and the island reads
  // `content.querySelector('tr')`. A bare `<tr>` as a template's first child is correct per the
  // parsing spec and every real browser keeps it — but a simplified parser drops it on the floor
  // (measured 2026-09-14: happy-dom, which every unit test in this repository runs on, returned
  // zero `tr` from the template's content), so a suite that asserts this table fills would go
  // green against an empty clone. The skeleton costs 30 bytes and cannot be got wrong anywhere.
  return `<template data-mcp-row><table><tbody>`
    + `<tr class="border-b border-neutral-100 last:border-0 dark:border-neutral-800" data-mcp-token-row>`
    + `<td class="px-3 py-2"><span class="font-medium" data-mcp-name></span>`
    + `<code class="ml-2 text-xs text-neutral-500 dark:text-neutral-400" data-mcp-prefix></code>`
    + `${badge}</td>`
    + `<td class="${TD_WIDE}" data-mcp-made></td>`
    + `<td class="${TD_WIDE}"><span data-mcp-used></span>`
    + `<span data-mcp-never hidden>${escapeHtml(t.mcpNeverUsed)}</span></td>`
    + `<td class="hidden whitespace-nowrap px-3 py-2 sm:table-cell">`
    + `<span class="font-medium text-neutral-900 dark:text-white" data-mcp-expired hidden>`
    + `${escapeHtml(t.mcpExpired)}</span>`
    + `<span class="text-neutral-500 dark:text-neutral-400" data-mcp-expires></span></td>`
    + `<td class="px-3 py-2 text-right">`
    + `<button type="button" data-mcp-delete class="rounded-lg px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white">`
    + `${escapeHtml(t.delete)}</button></td></tr></tbody></table></template>`
}

/**
 * The manager: the two keys that mint and re-read, the scope of the NEXT token, the box that
 * shows one once, and the table.
 *
 * The two scope boxes travel TOGETHER on a row of their own. Loose in the key row they wrapped
 * one at a time, so at the width the settings column actually is, Read-only sat beside Refresh
 * and Custom code landed alone on the next line under the key — two halves of one question
 * drawn as if they were unrelated. `basis-full` rather than letting them wrap on their own: a
 * pair that sometimes fits beside the keys and sometimes does not is a layout that moves when
 * the window does.
 *
 * They are `checkField`, where React had two bare `input[type=checkbox]` with no accent class —
 * which is not unstyled but painted in the OS accent, i.e. blue, on a monochrome admin. Neither
 * box mints `full`, which is what every token was before scopes existed; `code` is the rarer
 * grant and is mutually exclusive with read-only, because "reads nothing but may set custom
 * head HTML" is not a thing anybody means. That exclusion is the island's — it is a rule about
 * two controls that store nothing, so no `data-k` hook expresses it.
 */
function tokens(t: AdminStrings): string {
  const keys = `<div class="flex flex-wrap items-center gap-2">`
    + `<button type="button" data-mcp-generate class="${buttonClass()}">`
    + `${escapeHtml(t.mcpGenerate)}</button>`
    + `<button type="button" data-mcp-refresh class="${buttonClass('ghost')}">`
    + `${escapeHtml(t.mcpRefresh)}</button>`
    + `<div class="flex w-full basis-full flex-wrap items-center gap-x-4 gap-y-1.5">`
    + checkField({
      label: t.mcpReadOnly, on: false,
      attrs: `data-mcp-scope-read title="${escapeAttr(t.mcpReadOnlyHint)}"`,
    })
    + checkField({
      label: t.mcpCustomCode, on: false,
      attrs: `data-mcp-scope-code title="${escapeAttr(t.mcpCustomCodeHint)}"`,
    })
    + `</div></div>`
  // Shown once and never again: the plaintext exists only in the reply that created it, so this
  // box ships EMPTY and hidden and the island writes into it.
  const once = `<div class="space-y-2 rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/60" data-mcp-created hidden>`
    + `<p class="text-xs font-medium text-neutral-600 dark:text-neutral-300">`
    + `${escapeHtml(t.mcpOnceWarning)}</p>`
    + `<div class="flex items-center gap-2">`
    + `<code class="${COPY_BOX} bg-white dark:bg-neutral-900" data-mcp-token></code>`
    + `<button type="button" data-mcp-copy-token class="${buttonClass()}">`
    + `${escapeHtml(t.mcpCopy)}</button>`
    + `<button type="button" data-mcp-close class="${buttonClass('ghost')}">`
    + `${escapeHtml(t.close)}</button></div></div>`
  const head = `<tr><th class="${TH}">${escapeHtml(t.mcpColName)}</th>`
    + `<th class="hidden ${TH} sm:table-cell">${escapeHtml(t.mcpColCreated)}</th>`
    + `<th class="hidden ${TH} sm:table-cell">${escapeHtml(t.mcpColLastUsed)}</th>`
    + `<th class="hidden ${TH} sm:table-cell">${escapeHtml(t.mcpColExpires)}</th>`
    + `<th class="px-3 py-2"></th></tr>`
  // The empty line and the table are mutually exclusive, so they share ONE box: a stack that
  // hides one of a pair hands the other a margin it never had (`docs/admin-one-dom.md`, trap 5).
  const table = `<div>`
    + `<p class="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400" data-mcp-none>`
    + `${escapeHtml(t.mcpNoTokens)}</p>`
    // The THIRD face of this box: no tokens, some tokens, and the question never got answered.
    + loadFailure(t, 'data-mcp-failed')
    + `<div class="${PANEL}" data-mcp-table hidden><div class="${TABLE_SCROLL}">`
    + `<table class="w-full text-sm">`
    + `<thead class="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">`
    + `${head}</thead><tbody data-mcp-rows></tbody></table></div></div>`
    + tokenRow(t) + `</div>`
  return `<div class="space-y-3">`
    + settingRow({ label: t.mcpTokensTitle, note: t.mcpTokensHint, inline: true, control: keys })
    + once + table + `</div>`
}

/**
 * The card.
 *
 * ⚠️ THE ADDRESS AND THE TOKENS ARE GATED ON THE SAVED SWITCH, not on the one in the form, and
 * `data-gate-live` is a different hook from `data-gate` for exactly that reason. This card has
 * its own Save, so flipping the switch leaves the endpoint off until the key is pressed — and
 * showing the URL on the flip meant the card handed out an address, and the manager below it
 * handed out a credential, for a door that was still shut. Measured 2026-09-11 on a fresh
 * install: switch flipped, token minted, URL copied, and every call answered 404 until the
 * settings row was actually written. So the island opens these two blocks only while the key is
 * on AND the card is clean, where `data-gate` follows the switch the instant it moves.
 *
 * The switch and the address live in ONE child of the list rather than two. `divide-y` draws its
 * rule between children and `:last-child` counts a node that is `hidden` — so as siblings, a
 * closed address block would leave the switch above it wearing a hairline with nothing under it
 * (`docs/admin-one-dom.md`, trap 4). Nested, the list has one child whichever way the switch is,
 * and the address keeps the `border-t` React drew on it. `.panel-list .switch-row.p-4` is a
 * DESCENDANT rule, so the row inside the wrapper still gets its 16px back.
 */
export function mcpCard(t: AdminStrings, s: SiteSettings, endpoint: string): string {
  const live = s.mcp.enabled
  const url = settingRow({
    label: t.mcpUrlLabel, note: t.mcpUrlHint,
    control: `<div class="flex items-center gap-2">`
      + `<code class="${COPY_BOX} bg-neutral-50 dark:bg-neutral-900" data-mcp-url>`
      + `${escapeHtml(endpoint)}</code>`
      + `<button type="button" data-mcp-copy class="${buttonClass('secondary')}">`
      + `${escapeHtml(t.mcpCopy)}</button></div>`,
  })
  return connectionCard({
    title: t.cardMcp,
    keys: ['mcp'],
    state: live ? 'good' : 'off',
    lampTitle: live ? t.connectionOk : t.connectionOff,
    saveLabel: t.save,
    // NO stack gap on this box: its last child is the one that can be hidden, and `space-y-*`
    // is `& > :not(:last-child)` — so the list above would keep a margin it only earns while
    // the manager is showing. The 20px rides on the gated block instead, where a `display:none`
    // box contributes nothing at all.
    body: `<div>`
      + panelList(`<div>`
        + switchRow({ k: 'mcp.enabled', label: t.mcpEnable, note: t.mcpEnableDesc, on: s.mcp.enabled })
        + gate(live, url,
          'class="border-t border-neutral-200 p-4 dark:border-neutral-800" data-gate-live="mcp.enabled"')
        + `</div>`)
      + gate(live, tokens(t), 'class="mt-5" data-gate-live="mcp.enabled"')
      + `</div>`,
  })
}
