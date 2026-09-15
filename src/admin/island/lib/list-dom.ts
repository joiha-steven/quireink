// The five moves every list on the settings screen makes, in one place.
//
// They were private to `settings-lists.ts` until the MCP card got its own file (2026-09-15).
// A second copy of `row()` in particular would be a second opinion on how a row is built, and
// the whole point of that function is that there is only one — the server's `<template>`.
import { say } from './media-bridge'

export type ListWords = Partial<Record<string, string>>

export const show = (el: Element | null, on: boolean): void => {
  if (el instanceof HTMLElement) el.hidden = !on
}

/**
 * One row from the list's own template, with its fields filled in.
 *
 * ⚠️ THE `<tr>` FIRST, AND THE TEMPLATE'S FIRST CHILD ONLY AS A FALLBACK. A table row cannot be
 * a template's first child and survive every parser — `settings-server-mcp.ts` explains why it
 * ships wrapped in a `<table><tbody>` skeleton — so taking `firstElementChild` there clones the
 * whole SKELETON and drops a nested table inside the real `<tbody>`. It fills, and the fields
 * read back, and every assertion on text passes: what is wrong is only that the row is its own
 * table and its columns no longer line up with the header above them. A list whose rows are
 * `<li>` has no `tr` and falls through to the first child, which is the row itself.
 */
export function row(list: HTMLElement, fill: (el: HTMLElement) => void): HTMLElement | null {
  const tpl = list.closest('section')?.querySelector('template')
  const source = tpl?.content.querySelector('tr') ?? tpl?.content.firstElementChild
  const clone = source?.cloneNode(true)
  if (!(clone instanceof HTMLElement)) return null
  fill(clone)
  return clone
}

export const put = (el: HTMLElement, hook: string, text: string): void => {
  const slot = el.querySelector<HTMLElement>(`[${hook}]`)
  if (slot) slot.textContent = text
}

/**
 * ⚠️ NULL IS "THE QUESTION BROKE", NOT "THE ANSWER WAS EMPTY", and every caller has to keep
 * them apart. A list that prints its empty state after a refused request tells the owner their
 * rows are gone when all of them are still on the server — and on the backups card that same
 * sentence says there is no copy of the blog anywhere. Each filler shows the failure box the
 * server drew for exactly this, and the box carries a key that asks again in place.
 */
export async function read<T>(url: string): Promise<T | null> {
  const res = await fetch(url).catch(() => null)
  if (!res) return null
  if (res.status === 401) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
    return null
  }
  const json = await res.json().catch(() => null) as { success?: boolean; data?: T } | null
  return json?.success && json.data !== undefined ? json.data : null
}

/** Show the failure box, and hide everything that would otherwise claim to be the answer. */
export function broke(card: Element | null, hook: string, faces: string[]): void {
  for (const face of faces) show(card?.querySelector(`[${face}]`) ?? null, false)
  show(card?.querySelector<HTMLElement>(`[${hook}]`) ?? null, true)
}

/**
 * Put a value on the clipboard and say so.
 *
 * ⚠️ IT CAN BE REFUSED, and then nothing is said. `navigator.clipboard` needs a secure context,
 * and an owner running this on plain HTTP over a LAN is exactly the audience this product has.
 * Saying nothing is what the library's two copy keys do (`media-attachments.ts`,
 * `media-images.ts`); the alternative is a twelfth sentence in eleven languages, and what the
 * owner is told when a browser refuses the clipboard is a content decision, not this file's.
 */
export async function copy(text: string, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    say(done)
  } catch { /* refused: see above */ }
}
