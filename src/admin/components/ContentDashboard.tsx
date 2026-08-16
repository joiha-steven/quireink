// The content screen: ONE list of everything written, and two managers underneath it.
//
// It was four tabs — Posts · Pages · Taxonomy · Series — and the owner's verdict on that was
// that it read as WordPress: to find a thing you had to know which drawer it was in first.
// ADR 0024 collapses the first two into one stream and demotes the other two, which are not
// content at all: renaming a category and ordering a series are maintenance, done rarely,
// and they were taking a quarter of the screen's top-level attention every day.
//
// They are still one click away, and nothing about them changed.
import { useState } from 'react'
import Link from '@/admin/router'
import type { Post, Page } from '@/types'
import { Button } from '@/admin/ui/Button'
import { WritingList } from './WritingList'
import { TaxonomyManager } from './TaxonomyManager'
import { SeriesManager } from './SeriesManager'
import { GROUP_GAP, PageHeader } from './kit'
import { useAdminT } from './I18nProvider'

type Drawer = 'none' | 'taxonomy' | 'series'

export function ContentDashboard({
  posts,
  pages,
  views,
  commentCounts,
  commentsEnabled,
}: {
  posts: Post[]
  pages: Page[]
  views: Record<string, number>
  commentCounts: Record<string, number>
  commentsEnabled: boolean
}) {
  const t = useAdminT()
  const [drawer, setDrawer] = useState<Drawer>('none')

  const toggle = (which: Exclude<Drawer, 'none'>) => setDrawer((now) => (now === which ? 'none' : which))

  return (
    <div>
      {/* Both "new" buttons, because the list no longer has a tab to tell it which kind you
          are looking at. A page is the rarer of the two, so it is the quieter button. */}
      <PageHeader
        title={t.navDashboard}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/page-editor">
              <Button variant="secondary">{t.newPage}</Button>
            </Link>
            <Link href="/admin/editor">
              <Button>{t.newPost}</Button>
            </Link>
          </div>
        }
      />

      <WritingList
        initialPosts={posts}
        initialPages={pages}
        views={views}
        commentCounts={commentCounts}
        commentsEnabled={commentsEnabled}
      />

      <div className={`${GROUP_GAP} flex flex-wrap items-center gap-2`}>
        <Button variant="ghost" size="sm" aria-pressed={drawer === 'taxonomy'} onClick={() => toggle('taxonomy')}>
          {t.tabTaxonomy}
        </Button>
        <Button variant="ghost" size="sm" aria-pressed={drawer === 'series'} onClick={() => toggle('series')}>
          {t.tabSeries}
        </Button>
      </div>

      {drawer === 'taxonomy' && <TaxonomyManager posts={posts} />}
      {drawer === 'series' && <SeriesManager posts={posts} />}
    </div>
  )
}
