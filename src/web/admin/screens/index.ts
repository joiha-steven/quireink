// WHICH ADMIN SCREENS THE SERVER DRAWS, and what each one's island is called.
//
// ADR 0054 converted fourteen screens one at a time, and all fourteen are here: every admin
// address arrives as finished HTML, and this table is the only place a screen's name and its
// island are written down. An address the table does not claim is no longer a gap waiting for
// a second program to fill it, because there is no second program: `spa.ts` draws the dead end
// itself. The overlays that belong to no screen (the palette, the shortcut sheet, the confirm
// dialog, the toast) are drawn into the shell by `web/admin/overlays.ts`.
//
// WHAT THE STAMP IS FOR. `spa.ts` asks this table; when it answers, the screen's markup goes
// into the canvas and `<html>` is stamped `data-admin-screen` with the name used here, or with
// `not-found`. Nothing in the browser routes off it any more. It is kept because it is the one
// place the SERVER states which screen it decided to draw, and the tour reads it to prove a
// flow landed on the screen it asked for rather than on the dead end: markup that merely looks
// right cannot answer that question. One stamp, so there is no second list to disagree with.
//
// A screen leaves this table only by being deleted from it, which cannot happen quietly: the
// address falls through to the dead end the moment the entry goes, and `check:routes` and the
// tour both cover it either way.
import type { SiteSettings } from '@/types'
import { analyticsScreen } from '@/web/admin/screens/analytics'
import { assistantScreen } from '@/web/admin/screens/assistant'
import { commentsScreen } from '@/web/admin/screens/comments'
import { contentScreen, editorFrame } from '@/web/admin/screens/content'
import { dashboardScreen } from '@/web/admin/screens/dashboard'
import { helpScreen } from '@/web/admin/screens/help'
import { mediaScreen } from '@/web/admin/screens/media'
import { logScreen } from '@/web/admin/screens/log'
import { newsletterScreen } from '@/web/admin/screens/newsletter'
import { settingsScreen } from '@/web/admin/screens/settings'
import { trashScreen } from '@/web/admin/screens/trash'

export type Screen = {
  /**
   * The finished markup, for the canvas.
   *
   * `query` is the request's own, because a screen's state can be IN the address: the trash
   * opens on `?tab=media` the way the settings screen opens on `?tab=account`. A screen that
   * has no such state ignores it, which is most of them.
   */
  render: (settings: SiteSettings, query: URLSearchParams) => Promise<string>
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
  // The admin's front door, and almost pure reading: one island, for one dismissible band.
  '/admin': { render: dashboardScreen, island: 'dashboard' },
  // The one screen with no behaviour at all: an index of `#` links is the browser's own.
  '/admin/help': { render: helpScreen, island: null },
  '/admin/log': { render: logScreen, island: 'log' },
  // Seven kinds and five ways to write, all of it over rows that are already in the markup.
  '/admin/trash': { render: trashScreen, island: 'trash' },
  // Grouped by post BY THE SERVER, which is where the grouping always happened in effect.
  '/admin/comments': { render: commentsScreen, island: 'comments' },
  // Two faces behind one address, both drawn here: the summary, and one page's drill-down at
  // `?path=`. The island is a filter and a ten-second poll; everything else is reading.
  '/admin/analytics': { render: analyticsScreen, island: 'analytics' },
  // The one screen that streams. The conversation is in the address now (`?chat=`), so the
  // server draws the transcript it holds and the island only ever adds what arrives after.
  '/admin/assistant': { render: assistantScreen, island: 'assistant' },
  // Three kinds in one sheet, all three drawn and the kind in the address. The island is the
  // grid's behaviour: selection, search, sort, upload. The picker the other screens ask for
  // with `quire:pick-media` is NOT this island's, so it works on pages this screen never
  // loads on; it is an overlay the rail island imports on demand (`island/lib/media-picker.ts`).
  '/admin/media': { render: mediaScreen, island: 'media' },
  // Seven tabs over one form, ALL SEVEN drawn — the Save key stores the whole thing, so drawing
  // one tab and navigating between them would lose unsaved work at every switch. It holds the
  // admin's most dangerous routes, so nothing on it is a form: see `screens/settings.ts`.
  '/admin/settings': { render: settingsScreen, island: 'settings' },
  // Three tabs over one audience, all three drawn. It holds the admin's one irreversible
  // action, so nothing on it is a form: see `screens/newsletter-send.ts`.
  '/admin/newsletter': { render: newsletterScreen, island: 'newsletter' },
  // The write list and the empty paper beside it. Every piece is drawn once and the filters
  // hide (trap 2); the island is the search, the selection and the two drawers.
  '/admin/content': { render: contentScreen, island: 'content' },
}

/**
 * The three addresses that open a piece: the write column, and the writing sheet beside it.
 *
 * A prefix rather than a path, because each of them carries a slug — and `Screen.render` takes
 * the query rather than the path, so these get their own entry point that does. They share the
 * write column with `/admin/content`, which is the entire reason they converted with it: one
 * column drawn twice, once as HTML and once as React, is the drift this ADR's markup rules
 * exist to prevent. Their island is the SHEET's, and it wires the column by importing the
 * column's own — one module, not a second copy of it.
 */
const WRITING: [prefix: string, island: string][] = [
  ['/admin/editor', 'sheet'],
  ['/admin/page-editor', 'sheet'],
  ['/admin/note-editor', 'sheet'],
]

/** The screen for a path, or null when no entry claims it: `spa.ts` draws the dead end. */
export function screenFor(path: string): { name: string; screen: Screen } | null {
  const p = path.replace(/\/+$/, '') || '/admin'
  const screen = SCREENS[p]
  if (screen) return { name: p.slice('/admin/'.length) || 'home', screen }
  // A writing address, which carries a slug and so cannot be a key above.
  for (const [prefix, island] of WRITING) {
    if (p !== prefix && !p.startsWith(`${prefix}/`)) continue
    return {
      name: prefix.slice('/admin/'.length),
      screen: { render: (settings) => editorFrame(settings, p), island },
    }
  }
  return null
}
