// The Write screen (ADR 0024; the mock's `.write` grid): the list of everything written,
// with an empty sheet beside it inviting the next piece. Opening a row swaps the sheet for
// that piece's editor; the pane rides along on the editor pages too.
//
// The taxonomy and series managers open as right-hand sheets from the pane's own tool
// line. They lived UNDER the panes first, and once the panes grew to window height that
// put them below the fold on every screen — "chỗ dưới đó xấu và ko ai thấy để xài" was
// the owner's verdict, and he was right: a door nobody can see is not a door.
import { useState } from 'react'
import Link from '@/admin/router'
import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import { Button } from '@/admin/ui/Button'
import { WritePane } from '@/admin/components/WritePane'
import { TaxonomyManager } from '@/admin/components/TaxonomyManager'
import { SeriesManager } from '@/admin/components/SeriesManager'
import { SlideOver } from '@/admin/components/SlideOver'
import { CARD } from '@/admin/components/kit'
import { useAdminT } from '@/admin/components/I18nProvider'
import { SHEET_TOOL } from '@/admin/components/sheet'

type Drawer = 'none' | 'taxonomy' | 'series'

// Same voice as the sort cycle beside them: one thin line of small print. It was a
// hand-copy of `SHEET_TOOL` missing only its `disabled:opacity-50` — and later its tap-target
// padding, which is the drift `check:admin-kit` now guards this string against.
const TOOL = SHEET_TOOL

export default function Content() {
  const t = useAdminT()
  const state = useView('content')
  const [drawer, setDrawer] = useState<Drawer>('none')
  const close = () => setDrawer('none')
  return (
    <View state={state}>
      {(data) => (
        <div>
          <div className="flex items-start gap-6">
            <WritePane
              always
              tools={
                <>
                  <button type="button" className={TOOL} onClick={() => setDrawer('taxonomy')}>
                    {t.tabTaxonomy}
                  </button>
                  <button type="button" className={TOOL} onClick={() => setDrawer('series')}>
                    {t.tabSeries}
                  </button>
                </>
              }
            />
            {/* The sheet's empty state: a quiet invitation, not a dashboard. Hidden where
                the pane takes the whole width — the list IS the screen there. */}
            <div className={`hidden min-w-0 flex-1 xl:block ${CARD} lg:min-h-[calc(100vh-1.5rem)]`}>
              <div className="flex min-h-[calc(100vh-1.5rem)] flex-col items-center justify-center gap-4 p-10 text-center">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.writeEmpty}</p>
                <div className="flex items-center gap-2">
                  <Link href="/admin/page-editor"><Button variant="secondary">{t.newPage}</Button></Link>
                  <Link href="/admin/editor"><Button>{t.newPost}</Button></Link>
                </div>
              </div>
            </div>
          </div>

          {drawer !== 'none' && (
            <SlideOver
              label={drawer === 'taxonomy' ? t.tabTaxonomy : t.tabSeries}
              onClose={close}
              footer={<Button variant="secondary" onClick={close}>{t.close}</Button>}
            >
              {drawer === 'taxonomy' ? <TaxonomyManager posts={data.posts} /> : <SeriesManager posts={data.posts} />}
            </SlideOver>
          )}
        </div>
      )}
    </View>
  )
}
