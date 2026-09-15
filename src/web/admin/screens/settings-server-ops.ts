// Settings → Server: WHAT THIS INSTALL DOES ON ITS OWN — what it holds in memory, what it asks
// the internet once a day, what it will accept onto the disk, and what it copies before the
// disk is gone.
//
// Two cards. The first is four ordinary settings keys with one Save. The second was counted
// among the "made of actions" cards and should not have been: running a snapshot is an action,
// but the SCHEDULE beside it is three settings keys, and with no key on the card and none on
// the tab there was nowhere to store them from.
//
// ⚠️ MARKUP HERE, BEHAVIOUR IN THE ISLAND (ADR 0054). Every key on this tab is an inert
// `type="button"` in this file, carrying a hook; what a press does is
// `admin/island/lib/settings-lists.ts`.
//
// ⚠️ AND THIS COMMENT ONCE SAID THE SNAPSHOT DELETE HAD NO HANDLER. It gained one and the
// sentence stayed, so a reader checking whether that delete asked before unlinking an archive
// was told there was nothing to check. It fetched on its first statement for three days.
//
// ⚠️ THE BACKUP LIST IS NOT A SERVER READ. It comes from `GET /api/backup/list`, which the page
// that draws this has not called, so the list ships EMPTY with its row in a `<template>`, the
// lamp ships amber and the last-run line says "Never". That is the honest state of a render
// that knows of no snapshots — not a claim that there are none.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { SiteSettings } from '@/types'
import type { UpdateState } from '@/server/update-check'
import { escapeAttr, escapeHtml } from '@/utils'
import { SHEET_TOOL, SHEET_TOOL_DANGER, buttonClass } from '@/admin-shared/kit'
import { META, NOTE_TEXT, SETTING_GAP } from '@/admin-shared/scale'
import { group, settingRow, switchList, switchRow, textField } from '@/web/admin/fields'
import { PANEL_LIST, connectionCard, loadFailure, pairGrid } from '@/web/admin/fields-box'
import { gate } from '@/web/admin/fields-pic'
import { lamp } from '@/web/admin/kit'

/** Whether this deployment permits the check at all, and what it last learned. */
export type UpdateStatus = { blockedBy: string | null; update: UpdateState }

/**
 * The page cache, and the key that empties it now without switching it off.
 *
 * One switch for two layers — the copy inside this process, and what a shared cache in front of
 * it may keep. They move together because separating them is a trap: turning off only the
 * in-process cache leaves Cloudflare answering with the copy you are trying to get rid of, and
 * the switch looks broken from outside.
 */
const cache = (t: AdminStrings, s: SiteSettings): string =>
  `<div class="${SETTING_GAP}">`
  + switchList(switchRow({
    k: 'cache.enabled', label: t.cacheEnable, note: t.cacheEnableDesc, on: s.cache.enabled,
  }))
  + settingRow({
    label: t.clearCache, note: t.cacheClearDesc, inline: true,
    control: `<button type="button" data-cache-clear class="${buttonClass('secondary')}">`
      + `${escapeHtml(t.clearCache)}</button>`,
  })
  + `</div>`

/**
 * The update check: one switch, and the answer it buys.
 *
 * ⚠️ THE DISCLOSURE IS FOLDED, NOT SHORTENED, and the distinction is the whole point. It is a
 * 700-character privacy promise about what leaves the machine — the longest note in the admin
 * by a wide margin, and the clearest case of the long-windedness reported across this screen —
 * and it is the one note here that must not lose a word, because a summary of it would be a
 * weaker promise. So the text is untouched and the wall is gone: a `<summary>` saying what the
 * paragraph is about, which is an invitation to open it rather than a replacement for it.
 *
 * `badge`, not a disabled switch, and it prints the VARIABLE that is in the way rather than a
 * sentence about it. Two things override this setting — an operator's `UPDATE_CHECK=0`, and a
 * build started without `NODE_ENV=production` — and a switch left ON above a check that will
 * never run is a screen telling its owner something untrue. The switch itself stays live: the
 * value is the owner's and outlives whoever is hosting them this month.
 *
 * ⚠️ ONLY THE TRUE STATE OF THE RELEASE LINE IS DRAWN, which is the one place this tab departs
 * from "every state ships drawn" — and it is not a state the page can move to. Being behind is
 * a fact the SERVER learned on its own clock; the island cannot make it true, and the version,
 * the link and the date exist only when it is. Drawing an empty shell of it would be inventing
 * a release that does not exist.
 */
function updates(t: AdminStrings, s: SiteSettings, u: UpdateStatus): string {
  const note = `<details class="group">`
    + `<summary class="cursor-pointer list-none underline decoration-dotted underline-offset-2 marker:content-none hover:text-neutral-900 dark:hover:text-white">`
    + `${escapeHtml(t.updateCheckWhat)}</summary>`
    + `<p class="mt-1.5">${escapeHtml(t.updateCheckDesc)}</p></details>`
  const row = switchList(switchRow({
    k: 'updateCheck', label: t.updateCheckLabel, noteHtml: note, on: s.updateCheck,
    badge: u.blockedBy ?? undefined,
  }))
  if (u.update.state !== 'behind') return row
  const r = u.update.release
  return row + `<div class="mt-5">` + settingRow({
    label: t.updateAvailable.replace('{v}', r.latest), note: t.updateAvailableNote,
    // ⚠️ `META` AND NOT `NOTE_TEXT`, which is what React dressed this link in. `NOTE_TEXT`
    // carries `admin-note`, the handle one rule in `admin.css` uses to put every explanation on
    // this screen out of sight — so with the explanations hidden the row kept its headline
    // ("Quire Ink 2.3.0 is out") and lost the only way to go and read what changed. The way OUT
    // of a card is not an explanation somebody chose to switch off. Same greys, one step
    // smaller, upright: the register this link's own date already belongs to.
    control: `<a href="${escapeAttr(r.url)}" target="_blank" rel="noopener noreferrer"`
      + ` class="${META} underline underline-offset-2 hover:text-neutral-900 dark:hover:text-white">`
      + `${escapeHtml(t.updateAvailableLink)} (${escapeHtml(r.date)}) ↗</a>`,
  }) + `</div>`
}

/**
 * The two ceilings, and both only ever NARROW one they cannot raise.
 *
 * `MAX_UPLOAD_MB` and `STORAGE_QUOTA_GB` belong to whoever runs the server; 0 here means
 * "whatever they said", which is why the hints name that rather than printing a number this
 * screen cannot know. The dashboard is where the bytes actually in use are shown.
 *
 * `textField` at its own defaults, where React drew two full-width stacked fields: a number is
 * a short answer and sits beside its question (`fields.ts`), and the long hint is exactly the
 * case the row's `flex-wrap` is for. Same two keys, same limits, one less arrangement of a
 * label and a field on a screen that had several.
 */
const storage = (t: AdminStrings, s: SiteSettings): string =>
  `<div class="${SETTING_GAP}">`
  + textField({
    k: 'maxUploadMb', label: t.maxUploadLabel, note: t.maxUploadHint, type: 'number',
    value: s.maxUploadMb, attrs: 'min="0" max="4096"',
  })
  + textField({
    k: 'storageQuotaGb', label: t.storageQuotaLabel, note: t.storageQuotaHint, type: 'number',
    value: s.storageQuotaGb, attrs: 'min="0" max="4096"',
  })
  + `</div>`

/**
 * THE SECOND CARD OF ORDINARY KEYS on a tab that otherwise saves through five endpoints.
 *
 * Its Save calls the same `PUT /api/settings` the save-as-one tabs use, with only these four
 * keys in the body — the endpoint merges, so nothing else on the record is touched.
 */
export const installCard = (t: AdminStrings, s: SiteSettings, u: UpdateStatus): string =>
  connectionCard({
    title: t.cardInstall,
    keys: ['cache', 'updateCheck', 'maxUploadMb', 'storageQuotaGb'],
    state: 'good', lampTitle: t.connectionOk, saveLabel: t.save,
    body: group({ title: t.cacheTitle, first: true, body: cache(t, s) })
      + group({ title: t.updateTitle, body: updates(t, s, u) })
      + group({ title: t.storageTitle, body: storage(t, s) }),
  })

/**
 * ONE SNAPSHOT, and the same shape ships as the `<template>` the island clones.
 *
 * Nothing in the vocabulary builds a row (`fields-pic.ts` states the rule): a row built in
 * JavaScript is a second copy of this markup that drifts from it in silence, and it would carry
 * the WORDS too, which live on the server with the locales.
 */
const snapshotRow = (t: AdminStrings): string =>
  `<template data-backup-row>`
  + `<li class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm" data-backup>`
  + `<span class="min-w-0 truncate"><span data-backup-when></span>`
  + `<span class="ml-2 text-neutral-500 dark:text-neutral-400" data-backup-size></span></span>`
  + `<span class="flex shrink-0 items-center gap-3">`
  // ⚠️ THE TWO KEYS ARE NOT THE SAME KIND OF KEY. Download takes a copy; Delete unlinks the
  // archive and nothing brings it back — no trash, no restore. They wore the identical grey
  // underline until 2026-09-16, which is the exact pairing `SHEET_TOOL_DANGER` was written for:
  // "Restore" and "Delete permanently" sat side by side in the Trash looking alike, and a
  // destructive key that looks like its harmless neighbour is a key somebody presses by reflex.
  + `<button type="button" data-backup-download class="${escapeAttr(SHEET_TOOL)}">`
  + `${escapeHtml(t.download)}</button>`
  + `<button type="button" data-backup-delete class="${escapeAttr(SHEET_TOOL_DANGER)}">`
  + `${escapeHtml(t.delete)}</button></span></li></template>`

/**
 * The copy the owner takes away, and the copies the server keeps.
 *
 * ⚠️ THE DOWNLOAD IS A PLAIN LINK'S JOB, not a fetch and not a blob, and the key is drawn as a
 * `<button>` only because the island hands the URL to the browser. `/api/backup/export` streams
 * the archive with a declared length precisely so the browser can write it to disk as it
 * arrives and draw a progress bar; pulling it through `fetch().blob()` undid all of that and
 * held the whole file in the tab's memory. On a 262 MB archive over a real connection that is
 * minutes with nothing on screen, and a browser free to drop the tab's allocation at any point
 * in it. Reported 2026-09-13 by the owner, whose first backup was one he could not take away.
 *
 * ⚠️ THE LAMP SAYS WHETHER THERE IS ONE AT ALL, before the date is read. "Last run: never" and
 * "Last run: 3 days ago" are the same shape of sentence and read the same at a glance, which is
 * the wrong answer for the one line on this screen that can mean there is no copy of the blog
 * anywhere.
 *
 * `switchRow` in a `panelList`, where React drew a bare `ToggleField` with its sentence in a
 * paragraph underneath: label, note and switch as one padded row is what every other boolean in
 * the admin is, and it is what `[data-explanations=off]` knows how to quiet.
 */
export function backupsCard(t: AdminStrings, s: SiteSettings): string {
  const b = s.backups
  // ⚠️ THE NUMBER'S OWN WIDTH, which is `textField`'s default for `type="number"` and not an
  // oversight. `width: 'full'` stretched a box holding the digit 4 to 380px in a 503px column —
  // measured 2026-09-15, where React drew 112px. A SHORT ANSWER SITS IN A SHORT FIELD: the
  // width of a field is a claim about how much belongs in it.
  const count = (k: string, label: string, value: number): string => textField({
    k, label, type: 'number', value, inline: false, attrs: 'min="1" max="30"',
  })
  const body = `<div class="space-y-5">`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.exportHint)}</p>`
    + `<button type="button" data-backup-export class="${buttonClass()}">`
    + `${escapeHtml(t.exportNow)}</button>`
    + `<div class="space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">`
    + switchList(switchRow({
      k: 'backups.enabled', label: t.backupAuto, note: t.backupAutoDesc, on: b.enabled,
    }))
    // The schedule is only a question once there is one, so it appears with it — and a hidden
    // block in the MIDDLE of a stack costs nothing, because `space-y-*` gives its margin to
    // every child but the last and a `display:none` box contributes none at all.
    + gate(b.enabled, pairGrid(
      count('backups.intervalDays', t.backupIntervalLabel, b.intervalDays)
      + count('backups.keep', t.backupKeepLabel, b.keep),
    ), 'data-gate="backups.enabled"')
    + `<div class="flex items-center gap-3">`
    + `<button type="button" data-backup-run class="${buttonClass('secondary')}">`
    + `${escapeHtml(t.backupNow)}</button>`
    + `<span class="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">`
    // BOTH LAMPS SHIP DRAWN, one hidden. A lamp's colour is a class, and nothing in the island
    // builds markup — writing `LAMP_HUES` into JavaScript would be a second copy of the palette
    // that drifts from this one in silence. So the server draws the answer for each case and the
    // island picks. Hidden is `display:none`, which is not a flex item at all, so the `gap-2`
    // here never pays for the one that is not showing.
    + lamp({ state: 'good', title: t.backupLastRun, attrs: 'data-backup-lamp-some hidden' })
    + lamp({ state: 'attention', title: t.backupNever, attrs: 'data-backup-lamp-none' })
    // The words travel WITH the line, because the island has to rebuild "Last run: <date>" and
    // the label half is translated. Reading it back off the element keeps every string on the
    // server, where the locales are.
    + `<span data-backup-last data-word-label="${escapeAttr(t.backupLastRun)}"`
    + ` data-word-never="${escapeAttr(t.backupNever)}">`
    + `${escapeHtml(t.backupLastRun)}: ${escapeHtml(t.backupNever)}</span></span></div>`
    // Both faces, in ONE box: the sentence and the list are mutually exclusive, and a stack
    // that hides one of a pair hands the other a margin it never had (trap 5).
    + `<div><p class="text-sm text-neutral-500 dark:text-neutral-400" data-backup-none>`
    + `${escapeHtml(t.backupNone)}</p>`
    // The THIRD face: no snapshots, some snapshots, and the question never got answered. On
    // THIS card the difference is the whole point — "there are no backups" and "I could not
    // find out whether there are backups" are opposite instructions to the person reading it.
    + loadFailure(t, 'data-backup-failed')
    + `<ul class="${PANEL_LIST}" data-backup-list hidden></ul>${snapshotRow(t)}</div>`
    + `<p class="${NOTE_TEXT}">${escapeHtml(t.exportReplicationNote)}</p>`
    + `</div></div>`
  return connectionCard({
    title: t.backupTitle,
    keys: ['backups'],
    state: b.enabled ? 'good' : 'off',
    lampTitle: b.enabled ? t.connectionOk : t.connectionOff,
    saveLabel: t.save,
    body,
  })
}
