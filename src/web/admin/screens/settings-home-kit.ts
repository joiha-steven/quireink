// The three pieces the Home tab's two halves both need, since the front page took a file of
// its own (2026-09-15, at the 400-line ceiling).
import { escapeAttr, escapeHtml } from '@/utils'
import { CONTROL } from '@/admin-shared/kit'
import { FIELD_W } from '@/admin-shared/scale'
import { icon } from '@/web/admin/kit'

export const BAND = 'border-t border-neutral-200 pt-5 dark:border-neutral-800'

/**
 * ⚠️ A LIST IS ONE VALUE, NOT ONE FIELD PER ROW — and that is the repair for a fault that was
 * live on this tab until 2026-09-15.
 *
 * The rows used to carry `data-k="menu.0.label"`, `data-k="featured.2"` and so on. The screen's
 * Save key sends a DEEP PARTIAL of only what changed, so editing one field of one row sent an
 * array with holes in every other index — which `JSON.stringify` writes as `null` — and the
 * sanitisers then dropped them. Editing one menu link deleted the whole menu. That half is
 * repaired in `content/settings-partial.ts`, but a per-row field cannot express the other half
 * at all: REMOVING a row renumbers the survivors back onto their own stored values, so nothing
 * is dirty, nothing is sent, and the row comes back on the next page load.
 *
 * So the list rides as ONE `data-k-json` field, the way `customFont` has since ADR 0053 — the
 * island owns the whole array and writes it here. The visible rows store nothing and wear
 * `data-menu-*` / `data-featured-*` / `data-strip-*` instead, which the form's reader does not
 * look at.
 *
 * It goes LAST in its stack: a `space-y-*` parent puts a top margin on every child but the
 * first, and a hidden field placed first would hand the next one a gap it never had.
 */
export function listField(k: string, value: unknown): string {
  const json = escapeAttr(JSON.stringify(value))
  return `<input type="hidden" data-k="${escapeAttr(k)}" data-k-json value="${json}" data-was="${json}">`
}

/**
 * A SELECT THAT STORES NOTHING: it is the way to ADD a row, and the row is what stores. Drawn
 * here rather than by `pickControl`, which demands a `k` — and a `data-k` would tell the form
 * this screen holds a setting called "add", and the sheet's search would offer it. Its only name
 * is its first option, which is gone the moment something is chosen, so it takes `aria-label`.
 */
export function addPick(f: {
  label: string; options: [string, string][]; attrs: string; taken?: ReadonlySet<string>
}): string {
  return `<span class="relative flex ${FIELD_W.full}">`
    + `<select aria-label="${escapeAttr(f.label)}" ${f.attrs}`
    + ` class="${CONTROL} ${FIELD_W.full} cursor-pointer appearance-none pr-9">`
    + `<option value="" selected>${escapeHtml(f.label)}</option>`
    // ⚠️ EVERY OPTION SHIPS, AND THE USED ONES SHIP `hidden`. Listing only the free ones is what
    // the server did until 2026-09-15, and it left the island with nothing to put back when a row
    // was removed: a category that had been taken at render time had no `<option>` to unhide, and
    // building one here would be this file's markup written in JavaScript, without its words.
    + f.options.map(([v, l]) =>
      `<option value="${escapeAttr(v)}"${f.taken?.has(v) ? ' hidden' : ''}>${escapeHtml(l)}</option>`)
      .join('')
    + `</select>`
    + icon('down', 'pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2'
      + ' text-neutral-500 dark:text-neutral-400')
    + `</span>`
}
