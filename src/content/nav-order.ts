// The admin rail's running order: the ids it is made of, and how a stored order is
// reconciled with the rail the code actually has.
//
// Pure and dependency-free (no DB, no React, no JSX) because BOTH sides need it: the server
// sanitises what a PUT sends, and the rail itself reconciles what it reads before drawing a
// single row. Two copies of this list would drift the first time a screen is added, and the
// symptom would be a door missing from one of them.
//
// AN EMPTY LIST MEANS "THE DEFAULT", and that is the whole migration story. A blog that has
// never been rearranged stores three empty arrays, so the rail keeps whatever the code says
// today — including the rule that the assistant only rides at the top once a model is
// plugged in, which is a decision the rail makes at render time and no stored order should
// freeze. Reset is the same thing said backwards: store empty again.
import type { NavOrder } from '@/types'

/**
 * Every row the rail can hold, by id.
 *
 * Ids, not paths: `/admin/content` has moved once already and a stored path would have taken
 * the row with it. Ids, not labels: a label is translated eleven ways.
 *
 * `more` is the group row itself — it is stored in `primary` because that is where it sits,
 * and what folds out under it is the `more` list. The last five are controls rather than
 * destinations; they are ids here all the same, because the owner may put a control among
 * the destinations or a destination down beside Sign out, and only the row itself cares
 * which of the two it is.
 */
export const NAV_IDS = [
  'home', 'assistant', 'write', 'media', 'newsletter', 'more',
  'analytics', 'comments', 'trash', 'settings', 'log', 'help', 'viewBlog',
  'collapse', 'theme', 'icons', 'cache', 'signout',
  // The two on the top row. They are NOT in any of the three lists — the wordmark and the
  // search button are chrome, not rows, and dragging a logo into a column of destinations
  // makes it a destination. They are ids all the same, because they can be switched OFF,
  // and `hidden` needs a name for them.
  'logo', 'search',
] as const

export type NavId = (typeof NAV_IDS)[number]

const KNOWN = new Set<string>(NAV_IDS)

export const isNavId = (v: unknown): v is NavId => typeof v === 'string' && KNOWN.has(v)

/** Never rearranged: the rail draws itself the way the code has it. */
export const EMPTY_NAV_ORDER: NavOrder = { primary: [], more: [], footer: [], hidden: [] }

/**
 * One stored list: known ids only, each at most once ACROSS THE WHOLE ORDER.
 *
 * The cross-list rule is the one that matters. A row that appears in two places is a rail
 * that answers "where is it?" twice, differently — the same fault `navDestinations` avoids
 * by keeping the assistant out of both lists at once — and it arrives from an interrupted
 * drag or a hand-edited payload, not from the UI.
 */
function list(input: unknown, taken: Set<string>): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const v of input) {
    if (!isNavId(v) || taken.has(v)) continue
    taken.add(v)
    out.push(v)
  }
  return out
}

/** What the server stores. Order is preserved; anything unrecognised is dropped. */
export function sanitizeNavOrder(input: unknown, fallback: NavOrder): NavOrder {
  if (input === undefined || input === null) return fallback
  const o = input as Partial<NavOrder>
  const taken = new Set<string>()
  return {
    primary: list(o.primary, taken),
    more: list(o.more, taken),
    footer: list(o.footer, taken),
    // Its own `taken` set: a hidden row is still IN a list — hiding the search button must
    // not make the id unavailable to the column it also belongs to.
    hidden: list(o.hidden, new Set<string>()),
  }
}

/** True when nothing has been arranged, so the rail should use its own defaults. */
export const isDefaultOrder = (o: NavOrder): boolean =>
  o.primary.length === 0 && o.more.length === 0 && o.footer.length === 0

/**
 * The stored order, made to fit the rail that exists right now.
 *
 * Two failures are being prevented, and they pull in opposite directions. An id that is no
 * longer a row would render nothing (or throw); a row the stored order has never heard of —
 * because the release that added it came after the owner last dragged anything — would
 * simply not appear, and a rail missing Settings is a rail nobody can fix from.
 *
 * So: keep the stored order for everything it names, then put every missing row back where
 * `defaults` has it, at the same index and in the same list. A release that adds a screen
 * therefore needs no migration, and an owner who rearranged three rows in 2.2 finds the new
 * one in 2.3 exactly where the product would have put it.
 */
export function reconcileNavOrder(stored: NavOrder, defaults: NavOrder): NavOrder {
  // `hidden` survives a reset of the ORDER: they are two decisions, and an owner who put the
  // rows back in their original order did not ask for the logo to come back.
  if (isDefaultOrder(stored)) return { ...defaults, hidden: stored.hidden }

  const present = new Set<string>([...stored.primary, ...stored.more, ...stored.footer])
  const live = new Set<string>([...defaults.primary, ...defaults.more, ...defaults.footer])
  const keep = (ids: string[]): string[] => ids.filter((id) => live.has(id))

  const out: NavOrder = {
    primary: keep(stored.primary),
    more: keep(stored.more),
    footer: keep(stored.footer),
    hidden: stored.hidden,
  }
  for (const key of ['primary', 'more', 'footer'] as const) {
    defaults[key].forEach((id, i) => {
      if (present.has(id)) return
      // At its own index, so a row lands where it was designed to sit rather than at the
      // bottom of whichever list it belongs to.
      out[key].splice(Math.min(i, out[key].length), 0, id)
    })
  }
  return out
}
