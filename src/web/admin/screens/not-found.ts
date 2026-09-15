// THE ADMIN'S 404 — and, before 2026-09-07, its least helpful screen.
//
// It printed "404" in small grey type over an otherwise blank page, with one link back to Home.
// Everything a person needs at that moment was missing: what actually went wrong, a way to look
// for the thing they were after, and the pieces they were most likely reaching for. A dead end
// costs nothing to furnish and is the one screen where a link is worth most.
//
// `data-admin-404` so "the address matched nothing" is a fact something can READ, rather than
// the string "404" appearing somewhere in the text. The tour asserted on the text and failed on
// the Help page, whose troubleshooting table has a row about an old URL that 404s — a correct
// page reported as a broken one, which is the kind of false alarm that teaches people to ignore
// a red run.
import type { SiteSettings } from '@/types'
import { adminT } from '@/i18n/admin-i18n'
import { escapeAttr, escapeHtml } from '@/utils'
import { buttonClass } from '@/admin-shared/kit'
import { emptyState } from '@/web/admin/kit'
import { getIndex } from '@/content/posts'
import { getPageIndex } from '@/content/pages'
import { getNoteIndex } from '@/content/notes'
import { writeItems } from '@/web/admin/screens/content-items'
import { recentPieces } from '@/web/admin/screens/recent-pieces'

export async function notFoundScreen(settings: SiteSettings): Promise<string> {
  const t = adminT(settings.language)
  const [posts, pages, notes] = await Promise.all([getIndex(), getPageIndex(), getNoteIndex()])

  // The SEARCH is the palette, not a second box: it already reaches posts, pages, settings and
  // every screen by name, and a 404 that grew a search field of its own would be a fourth place
  // to type a title into. It is drawn in the shell, so this only asks for it.
  const keys = `<div class="flex flex-col items-center">`
    + `<div class="flex flex-wrap items-center justify-center gap-2">`
    + `<button type="button" data-open-palette class="${escapeAttr(buttonClass())}">`
    + `${escapeHtml(t.paletteTitle)}</button>`
    + `<a href="/admin" class="${escapeAttr(buttonClass('secondary'))}">${escapeHtml(t.navHome)}</a>`
    + `</div>`
    + recentPieces(writeItems(posts, pages, notes), t)
    + `</div>`

  return `<div class="min-w-0 flex-1" data-admin-404>`
    + emptyState({
      glyph: 'compass', title: t.notFoundTitle, description: t.notFoundBody, actionHtml: keys,
    })
    + `</div>`
}
