// WHICH ADMIN SCREENS THE SERVER DRAWS, and what each one's island is called.
//
// ADR 0054 converts fourteen screens one at a time, so for a while the admin is two programs
// at once: a screen listed here arrives as finished HTML, and a screen that is not still comes
// from the React bundle. This table is the only place that difference is written down.
//
// HOW THE TWO LIVE TOGETHER. `spa.ts` asks this table; when it answers, the screen's markup
// goes into the canvas and `<html>` is stamped `data-admin-screen`. React reads that stamp and
// renders NO route — it keeps drawing the overlays that are still its (the palette, the
// shortcut sheet, the confirm dialog, the toast), which every page needs and no screen owns.
// One stamp, so there is no second list for the browser to disagree with.
//
// A screen leaves this table only by being deleted from it, which cannot happen quietly: the
// React route it used to have is deleted in the same commit, and `check:routes-guarded` and
// the tour both cover the address either way.
import type { SiteSettings } from '@/types'
import { helpScreen } from '@/web/admin/screens/help'
import { logScreen } from '@/web/admin/screens/log'

export type Screen = {
  /** The finished markup, for the canvas. */
  render: (settings: SiteSettings) => Promise<string>
  /**
   * The island's build name, or null for a screen that needs no JavaScript at all.
   *
   * It is the ENTRY NAME and not a URL: `spa.ts` resolves it against the built assets, where
   * the bundler's hash decides the filename.
   */
  island: string | null
}

/** Keyed by the exact path. A screen with children states its own prefix rule here later. */
export const SCREENS: Record<string, Screen> = {
  // The one screen with no behaviour at all: an index of `#` links is the browser's own.
  '/admin/help': { render: helpScreen, island: null },
  '/admin/log': { render: logScreen, island: 'log' },
}

/** The screen for a path, or null while it is still React's. */
export function screenFor(path: string): { name: string; screen: Screen } | null {
  const p = path.replace(/\/+$/, '') || '/admin'
  const screen = SCREENS[p]
  return screen ? { name: p.slice('/admin/'.length) || 'home', screen } : null
}

/**
 * Every path the server draws, for the one thing the browser cannot work out on its own.
 *
 * The React router intercepts rail clicks while the screens are still its (see `router.tsx`),
 * and it has to decline the ones that are not: pushing a converted path would change the
 * address and leave the server's markup for the OLD screen sitting in the canvas. A list,
 * because "is this path mine?" is a question about the target rather than about the page doing
 * the asking — and it comes from the table above, so it cannot drift from it.
 *
 * It gets shorter as this work finishes, and leaves with React.
 */
export const SERVER_PATHS = Object.keys(SCREENS).join(' ')
