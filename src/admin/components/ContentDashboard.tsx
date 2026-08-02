// Unified content dashboard: tabs to switch between Posts and Pages, each with
// its own "new" button. Replaces the old status-filter tabs.
import { useState } from 'react'
import Link from '@/admin/router'
import type { Post, Page } from '@/types'
import { Button } from '@/admin/ui/Button'
import { PostsTable } from './PostsTable'
import { PagesTable } from './PagesTable'
import { TaxonomyManager } from './TaxonomyManager'
import { SeriesManager } from './SeriesManager'
import { PageHeader, Tabs } from './kit'
import { useAdminT } from './I18nProvider'

type Tab = 'posts' | 'pages' | 'taxonomy' | 'series'

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
  const [tab, setTab] = useState<Tab>('posts')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'posts', label: t.tabPosts },
    { key: 'pages', label: t.tabPages },
    { key: 'taxonomy', label: t.tabTaxonomy },
    { key: 'series', label: t.tabSeries },
  ]

  return (
    <div>
      <PageHeader
        title={t.navDashboard}
        actions={tab === 'posts' || tab === 'pages' ? (
          <Link href={tab === 'posts' ? '/admin/editor' : '/admin/page-editor'}>
            <Button>{tab === 'posts' ? t.newPost : t.newPage}</Button>
          </Link>
        ) : undefined}
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-6" />

      {tab === 'posts' && (
        <PostsTable initialPosts={posts} views={views} commentCounts={commentCounts} commentsEnabled={commentsEnabled} />
      )}
      {tab === 'pages' && <PagesTable initialPages={pages} views={views} />}
      {tab === 'taxonomy' && <TaxonomyManager posts={posts} />}
      {tab === 'series' && <SeriesManager posts={posts} />}
    </div>
  )
}
