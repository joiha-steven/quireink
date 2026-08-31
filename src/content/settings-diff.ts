// What a settings save actually CHANGED.
//
// `settings.save` was written to the activity log with no detail at all, and it is the most
// frequent action there is: six rows of the same three words with an empty column beside
// them, which is what the home page's activity card was showing. The card had already been
// reported as too empty once, on 2026-08-15, and the answer then was to halve its width —
// which treated the air rather than the reason for it. There was nothing to say because
// nothing was being recorded.
//
// A ledger of changes should say which. Paths rather than prose, and stored raw like every
// other detail in this table, because the log outlives whatever language the admin happens
// to be in today.
import type { SiteSettings } from '@/types'

/**
 * Deep equality by serialisation.
 *
 * Enough here and not a shortcut worth apologising for: settings are the shape that came out
 * of `JSON.parse`, so there are no dates, sets, maps, functions or cycles to trip on, and key
 * order is stable because both sides came from the same defaults object.
 */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

const isGroup = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * The dotted paths a save touched, one level into each group.
 *
 * `comments` is a whole screen of controls, so naming the group alone would say about as
 * little as saying nothing; `comments.enabled` is the sentence somebody reading the log
 * wants. Two levels is where it stops: `themes.dusk` is a palette, and listing the nine
 * colours inside it would bury the save under its own detail.
 */
export function changedSettingPaths(before: SiteSettings, after: SiteSettings): string[] {
  const out: string[] = []
  const top = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of [...top].sort()) {
    const a = (before as unknown as Record<string, unknown>)[key]
    const b = (after as unknown as Record<string, unknown>)[key]
    if (same(a, b)) continue
    if (isGroup(a) && isGroup(b)) {
      for (const sub of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
        if (!same(a[sub], b[sub])) out.push(`${key}.${sub}`)
      }
      continue
    }
    out.push(key)
  }
  return out
}

/** How many paths a log line prints before it starts counting instead. */
const SHOWN = 5

/**
 * One line for the ledger.
 *
 * A save that changed nothing says so rather than going in blank: "the button was pressed and
 * nothing moved" is a fact worth being able to read, and a blank detail is the thing this
 * whole file exists to stop.
 */
export function describeSettingsSave(before: SiteSettings, after: SiteSettings): string {
  const paths = changedSettingPaths(before, after)
  if (paths.length === 0) return 'no change'
  const head = paths.slice(0, SHOWN).join(', ')
  return paths.length > SHOWN ? `${head} +${paths.length - SHOWN}` : head
}
