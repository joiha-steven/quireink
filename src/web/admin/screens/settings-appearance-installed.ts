// Settings → Appearance → "Theme": the themes installed from a zip (ADR 0072, T2c), drawn beside
// the four built in, and the controls that install, roll back and remove them.
//
// AN INSTALLED THEME IS CHOSEN THE WAY A BUILT-IN ONE IS. Its tile is a `data-choice` key in the
// same `data-choice-track` (`settings-appearance-look.ts`), wearing the same tile skin, so the
// island's `pickChoice` presses it and the sheet's one Save stores `theme` with no new code. What
// it adds sits around the key, never inside it: Rollback and Remove are buttons, and a button
// inside a button is not a thing HTML can hold.
//
// THE PICTURE HAS THE BUILT-IN DRAWING'S BOX, to the pixel. Both are an `<svg viewBox="0 0 160
// 96">` at the tile's width, so the name under it starts at the same height on every tile in a
// row. The screenshot is an `<img>` laid over it, cropped from the top, over a neutral drawing: a
// screenshot that does not load (a file the store lost) leaves the drawing, never a broken icon.
//
// The island is `admin/island/lib/settings-themes.ts`; its words ride on the picker as
// `data-theme-words`, because the settings screen's own dictionary is for its Save key.
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { InstalledTheme } from '@/content/installed-themes'
import type { ThemeHealth } from '@/content/theme-health'
import { buttonClass } from '@/admin-shared/kit'
import { NOTE, NOTE_ALERT } from '@/admin-shared/scale'
import { escapeAttr, escapeHtml } from '@/utils'

/** What the Look card needs that is not a setting. */
export type InstalledView = { installed: readonly InstalledTheme[]; health: ThemeHealth }

export const NO_INSTALLED: InstalledView = { installed: [], health: { ok: true } }

/**
 * A theme whose manifest does not read: the tile's shape and padding, a dashed edge (the admin's
 * mark for a thing that is there but not in use) and no hover, because it is not a key.
 */
const UNREADABLE = 'flex flex-col rounded-lg border border-dashed border-neutral-300 p-3 text-left text-neutral-700'
  + ' dark:border-neutral-700 dark:text-neutral-300'

/** The badge every zip theme wears: the same chip a setting's badge is (`fields.ts`). */
const BADGE = 'mt-2 self-start rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-normal'
  + ' text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'

/**
 * A framed page of evenly ruled lines in the built-in drawings' ink: what shows until the
 * screenshot paints, and instead of it when the file is not there. Not Plain's drawing, which
 * would say this theme looks like Plain.
 */
const PLACEHOLDER = '<rect x="0.5" y="0.5" width="159" height="95" rx="5" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-dasharray="4 3"/>'
  + [18, 30, 42, 54, 66].map((y, i) => `<rect x="20" y="${y}" width="${i === 4 ? 72 : 120}" height="4" rx="2" fill="currentColor" fill-opacity=".25"/>`).join('')

/**
 * The tile's picture: the placeholder in the built-in drawing's box, and the package's screenshot
 * laid over it, cropped from the top. An `<img>` with an empty `alt`, not an SVG `<image>`: a
 * screenshot the browser cannot decode drew Chrome's broken-image glyph across the whole tile as
 * an `<image>` (seen on the tour's test package), and an `<img alt="">` that fails draws nothing,
 * so the placeholder shows.
 */
const picture = (screenshot: string): string =>
  `<span class="relative mb-2 block">`
  + `<svg viewBox="0 0 160 96" class="block w-full text-neutral-500 dark:text-neutral-400"`
  + ` aria-hidden="true" focusable="false">${PLACEHOLDER}</svg>`
  // `data-theme-shot`: the island hides one that fails to decode, so the placeholder shows
  // rather than the broken-image glyph Chrome draws over an empty `alt` too (`settings-themes.ts`).
  + (screenshot ? `<img src="${escapeAttr(screenshot)}" alt="" decoding="async" data-theme-shot`
    + ` class="absolute inset-0 h-full w-full rounded-md object-cover object-top">` : '')
  + `</span>`

/** `{name}` and `{name2}` replaced in `template`, each value once. */
export const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)

/**
 * One installed theme: its key, then the keys that act on the package. `tile` is the built-in
 * tiles' own class pair (`tileClass`/`tileFaces`), handed in so both kinds wear one skin.
 */
export function installedTile(
  t: AdminStrings, theme: InstalledTheme, on: boolean,
  skin: { cls: string; faces: string },
): string {
  const { id, current } = theme
  const before = theme.previous[0]
  const rollback = before
    ? `<button type="button" data-theme-rollback="${escapeAttr(id)}" class="${buttonClass('secondary', 'sm')}">`
      + `${escapeHtml(fill(t.themeRollback, { version: before.version }))}</button>`
    : ''
  const name = `<span class="block text-sm font-semibold leading-tight break-words">${escapeHtml(current.name)}</span>`
  // A manifest that does not read (`readable: false`) is no key at all: the site could not draw
  // it, so it cannot be chosen, and the one thing left to do with it is Remove.
  const key = theme.readable
    ? `<button type="button" data-choice="${escapeAttr(id)}" aria-pressed="${on}"`
      // An installed theme suggests no built-in chrome font, so pressing it puts back one a
      // built-in tile moved; the settings it owns are drawn by part 2 of T2c with its pickers.
      + ` data-suggests="{}" data-owns="[]" data-name="${escapeAttr(current.name)}"`
      + `${skin.faces} class="${skin.cls}">${picture(current.screenshot)}${name}`
      + `<span class="mt-1 block text-xs font-normal text-neutral-600 break-words dark:text-neutral-300">`
      + `${escapeHtml(fill(t.themeVersionBy, { version: current.version, author: current.author }))}</span>`
      + `<span class="${BADGE}" title="${escapeAttr(t.themeUnreviewedHint)}" data-theme-badge>${escapeHtml(t.themeUnreviewed)}</span>`
      + `</button>`
    : `<div class="${UNREADABLE}" data-theme-unreadable>${picture('')}${name}`
      + `<span class="${NOTE_ALERT} mt-1 block">${escapeHtml(t.themeUnreadableTile)}</span></div>`
  // Two rows of the theme grid, shared with the cell beside it (`grid-rows-subgrid`): the key in
  // the first and its own keys in the second, so the two keys in a row are one height even when
  // one of them has a Rollback key that wraps under its Remove (measured at 375: 242 against 282).
  return `<div class="row-span-2 grid min-w-0 grid-rows-subgrid" data-theme-cell="${escapeAttr(id)}">${key}`
    + `<div class="flex flex-wrap gap-2 self-start">${rollback}`
    + `<button type="button" data-theme-remove="${escapeAttr(id)}" data-name="${escapeAttr(current.name)}"`
    + ` class="${buttonClass('danger', 'sm')}">${escapeHtml(t.themeRemove)}</button></div>`
    + `</div>`
}

const BROKEN: Record<Exclude<ThemeHealth, { ok: true }>['why'], 'themeBrokenMissing' | 'themeBrokenUnreadable' | 'themeBrokenSheet'> = {
  missing: 'themeBrokenMissing',
  unreadable: 'themeBrokenUnreadable',
  sheet_missing: 'themeBrokenSheet',
}

/**
 * The line that says the site is not wearing the theme the card shows as chosen. Drawn only
 * when that is so: the server knows, and an island asking again would only say it later.
 */
export function brokenWarning(t: AdminStrings, view: InstalledView): string {
  if (view.health.ok) return ''
  const { id, why } = view.health
  const name = view.installed.find((theme) => theme.id === id)?.current.name ?? id
  return `<p class="${NOTE_ALERT} mb-4" role="note" data-theme-broken="${escapeAttr(why)}">`
    + `${escapeHtml(fill(t[BROKEN[why]], { fallback: t.lookPlain, theme: name }))}</p>`
}

/**
 * Install from a file: the key, the sentence under it, and every answer it can give, drawn
 * hidden (one DOM per state). A refusal is a list of lines built from the `<template>`, one per
 * finding of the checker, so a package with forty problems shows forty, each with where it is.
 */
export function installControl(t: AdminStrings): string {
  return `<div class="mt-5" data-theme-install>`
    + `<input type="file" hidden data-theme-file accept=".zip,application/zip">`
    + `<button type="button" data-theme-choose class="${buttonClass('secondary', 'sm')}"`
    + ` data-label-idle="${escapeAttr(t.themeInstall)}" data-label-busy="${escapeAttr(t.themeInstalling)}">`
    + `${escapeHtml(t.themeInstall)}</button>`
    + `<p class="${NOTE}">${escapeHtml(t.themeInstallNote)}</p>`
    + `<div aria-live="polite">`
    + `<p class="mt-2 text-sm text-neutral-700 dark:text-neutral-200" data-theme-status hidden></p>`
    + `<p class="${NOTE_ALERT} mt-2" role="alert" data-theme-error hidden></p>`
    + `<div class="mt-2" data-theme-refusal hidden>`
    + `<p class="${NOTE_ALERT}" data-theme-refusal-head></p>`
    + `<ul class="mt-2 space-y-2" data-theme-violations></ul>`
    + `<template data-theme-violation><li class="min-w-0 text-sm">`
    + `<span class="block text-neutral-800 dark:text-neutral-200" data-theme-violation-what></span>`
    + `<span class="block font-mono text-xs text-neutral-500 break-all dark:text-neutral-400" data-theme-violation-where></span>`
    + `</li></template></div></div></div>`
}

/** The island's words: the sentences it says, and one line per rule code of the checker. */
export function themeWords(t: AdminStrings): string {
  return escapeAttr(JSON.stringify({
    fallback: t.lookPlain, reload: t.themeReloadToSee,
    installedOk: t.themeInstalledOk, unchanged: t.themeUnchanged, refusedHead: t.themeRefusedHead,
    tooBig: t.themeTooBig, network: t.themeNetwork, serverError: t.themeServerError,
    rolledBack: t.themeRolledBack, removed: t.themeRemoved, failed: t.themeActionFailed,
    askTitle: t.askThemeRemoveTitle, askBody: t.askThemeRemoveBody, yes: t.themeRemove, no: t.askCancel,
    rules: t.themeRules,
  }))
}
