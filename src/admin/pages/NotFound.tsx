// The admin's 404 — and, before 2026-09-07, its least helpful screen.
//
// It printed "404" in small grey type over an otherwise blank page, with one link back to
// Home. Everything a person needs at that moment was missing: what actually went wrong, a way
// to look for the thing they were after, and the pieces they were most likely reaching for.
// A dead end costs nothing to furnish and is the one screen where a link is worth most.
import Link from '@/admin/router'
import { Button, buttonClass } from '@/admin/ui/Button'
import { EmptyState } from '@/admin/components/kit'
import { openPalette } from '@/admin/components/CommandPalette'
import { RecentPieces } from '@/admin/components/RecentPieces'
import { useAdminT } from '@/admin/components/I18nProvider'

export default function NotFound() {
  const t = useAdminT()
  return (
    // `data-admin-404` so "the router found nothing" is a fact something can READ, rather than
    // the string "404" appearing somewhere in the text. The tour asserted on the text and
    // failed on the Help page, whose troubleshooting table has a row about an old URL that
    // 404s — a correct page reported as a broken one, which is the kind of false alarm that
    // teaches people to ignore a red run.
    <div className="min-w-0 flex-1" data-admin-404>
      <EmptyState
        glyph="compass"
        title={t.notFoundTitle}
        description={t.notFoundBody}
        action={
          <div className="flex flex-col items-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {/* The search is the palette, not a second box: it already reaches posts,
                  pages, settings and every screen by name, and a 404 that grew a search
                  field of its own would be a fourth place to type a title into. */}
              <Button onClick={openPalette}>{t.paletteTitle}</Button>
              <Link href="/admin" className={buttonClass('secondary')}>{t.navHome}</Link>
            </div>
            <RecentPieces />
          </div>
        }
      />
    </div>
  )
}
