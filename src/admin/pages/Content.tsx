// The Write screen (ADR 0024; the mock's `.write` grid): the list of everything written,
// with an empty sheet beside it inviting the next piece. Opening a row swaps the sheet for
// that piece's editor; the pane rides along on the editor pages too.
//
// The taxonomy and series managers stay one click away UNDER the panes, at every width —
// they are maintenance, not content, and this is their only home (ADR 0024 step 2).
import { useState } from 'react'
import Link from '@/admin/router'
import { useView } from '@/admin/useView'
import { View } from '@/admin/pages/state'
import type { Post, Page } from '@/types'
import { Button } from '@/admin/ui/Button'
import { WritePane } from '@/admin/components/WritePane'
import { TaxonomyManager } from '@/admin/components/TaxonomyManager'
import { SeriesManager } from '@/admin/components/SeriesManager'
import { CARD, GROUP_GAP } from '@/admin/components/kit'
import { useAdminT } from '@/admin/components/I18nProvider'

type Props = {
  posts: Post[]
  pages: Page[]
}

type Drawer = 'none' | 'taxonomy' | 'series'

export default function Content() {
  const t = useAdminT()
  const state = useView<Props>('content')
  const [drawer, setDrawer] = useState<Drawer>('none')
  const toggle = (which: Exclude<Drawer, 'none'>) => setDrawer((now) => (now === which ? 'none' : which))
  return (
    <View state={state}>
      {(data) => (
        <div>
          <div className="flex items-start gap-6">
            <WritePane always />
            {/* The sheet's empty state: a quiet invitation, not a dashboard. Hidden where
                the pane takes the whole width — the list IS the screen there. */}
            <div className={`hidden min-w-0 flex-1 xl:block ${CARD}`}>
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-10 text-center">
                <p className="text-sm text-neutral-400 dark:text-neutral-500">{t.writeEmpty}</p>
                <div className="flex items-center gap-2">
                  <Link href="/admin/page-editor"><Button variant="secondary">{t.newPage}</Button></Link>
                  <Link href="/admin/editor"><Button>{t.newPost}</Button></Link>
                </div>
              </div>
            </div>
          </div>

          <div className={`${GROUP_GAP} flex flex-wrap items-center gap-2`}>
            <Button variant="ghost" size="sm" aria-pressed={drawer === 'taxonomy'} onClick={() => toggle('taxonomy')}>
              {t.tabTaxonomy}
            </Button>
            <Button variant="ghost" size="sm" aria-pressed={drawer === 'series'} onClick={() => toggle('series')}>
              {t.tabSeries}
            </Button>
          </div>
          {drawer === 'taxonomy' && <TaxonomyManager posts={data.posts} />}
          {drawer === 'series' && <SeriesManager posts={data.posts} />}
        </div>
      )}
    </View>
  )
}
