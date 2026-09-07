// The Write screen's SHEET — the empty paper beside the list.
//
// The list itself is no longer here. It is drawn by the shell (`App.tsx`), because a column
// rendered by the page is a column that is thrown away and rebuilt every time you click a row
// in it: the route changes, the page component is swapped, and the list goes with it — losing
// its scroll position on the one screen whose whole job is picking something out of a list.
// Its own drawers (taxonomy, series) went with it into `WritePane`, where they always belonged.
//
// What is left is the invitation, and it is deliberately not a dashboard. It does now offer
// the last three pieces touched: this sheet is reached most often by somebody returning to
// work, and until 2026-09-07 the only two things on it — New page, New post — both started
// something else.
import Link from '@/admin/router'
import { Button, buttonClass } from '@/admin/ui/Button'
import { CARD, EmptyState } from '@/admin/components/kit'
import { RecentPieces } from '@/admin/components/RecentPieces'
import { useAdminT } from '@/admin/components/I18nProvider'

export default function Content() {
  const t = useAdminT()
  return (
    // Hidden where the pane takes the whole width — the list IS the screen there.
    <div className={`hidden min-w-0 flex-1 xl:block ${CARD} lg:min-h-[calc(100vh-1.5rem)]`} data-write-empty>
      <div className="flex min-h-[calc(100vh-1.5rem)] flex-col items-center justify-center">
        <EmptyState
          glyph="blankPage"
          title={t.writeNothingOpen}
          description={t.writeEmpty}
          action={
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <Link href="/admin/page-editor" className={buttonClass('secondary')}>{t.newPage}</Link>
                <Link href="/admin/editor"><Button>{t.newPost}</Button></Link>
              </div>
              <RecentPieces />
            </div>
          }
        />
      </div>
    </div>
  )
}
