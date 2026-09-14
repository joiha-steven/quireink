// WHERE THE ADMIN CAN GO — the React face of `@/admin-rail`.
//
// The list itself is not here any more. It moved to `src/admin-rail.ts` when the server had
// to draw the same rail (ADR 0054): a row's id, href, label and icon are facts about the
// product, and a fact kept in a `.tsx` file can only ever be read by React. What is left here
// is the wrapping — turning an icon NAME into an element — which is the only part that is
// about React at all.
import type { ReactNode } from 'react'
import type { AdminStrings } from '@/i18n/admin-i18n'
import type { NavId } from '@/content/nav-order'
import type { NavOrder } from '@/types'
import { defaultOrder, railRows, type RailRow } from '@/admin-rail'
import { NavIcon } from './navIcons'

export type Destination = { id: NavId; href: string; label: string; icon: ReactNode }

/** One shared row, dressed as this face needs it. Rows with no `href` are not destinations. */
const dress = (r: RailRow | undefined): Destination | null =>
  r && r.href ? { id: r.id, href: r.href, label: r.label, icon: r.icon ? <NavIcon name={r.icon} /> : null } : null

const pick = (t: AdminStrings, ids: readonly NavId[]): Destination[] => {
  const rows = railRows(t)
  return ids.map((id) => dress(rows.get(id))).filter((d): d is Destination => d !== null)
}

/**
 * Four destinations, and everything else one click further (ADR 0024 step 6).
 *
 * The rail held eleven rows, which is eleven decisions before the one that matters. These
 * four are what the owner is here to do: see how it went, write, put a picture in, send it
 * out. **Analytics is not among them and that is the point** — the numbers moved onto the
 * home screen, so the rail no longer offers a second door to them.
 *
 * The assistant is the one row that comes and goes, and it comes SECOND. The rule that the
 * rail is four is not a formality (the tour has failed a fifth row before), so the fifth
 * needs an argument, and here it is the owner's own act: nobody pastes an API key for a
 * screen they meant to visit twice a month. Until they do, it is a door onto a refusal.
 */
export function primaryNav(t: AdminStrings, aiConfigured: boolean): Destination[] {
  return pick(t, ['home', ...(aiConfigured ? (['assistant'] as const) : []), 'write', 'media', 'newsletter'])
}

/**
 * Everything that is not writing. Not removed, moved.
 *
 * The assistant appears here only while no model is configured, and never in both lists:
 * a row in two places is a rail that answers "where is it?" twice, differently.
 */
export function secondaryNav(t: AdminStrings, aiConfigured: boolean): Destination[] {
  return pick(t, [...(aiConfigured ? [] : (['assistant'] as const)), 'analytics', 'comments', 'trash', 'settings', 'log', 'help'])
}

/** The rail as the product ships it. Re-exported so call sites need not learn a second module. */
export const defaultNavOrder = (aiConfigured: boolean): NavOrder => defaultOrder(aiConfigured)
