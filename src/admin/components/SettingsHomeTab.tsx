// Settings → Home & menu: what a reader sees when they open the front page.
//
// ADR 0041. It is the old Layout tab plus the listing switches that were filed under Reading —
// the sidebar's five blocks, infinite scroll, the grid view, the archive, the lead post. Those
// change what a LIST looks like and none of them appears on a post, so a tab called Reading was
// answering a question about the home page.
//
// Save-all: every key here goes through the sheet's one Save button.
import type { SiteSettings } from '@/types'
import { SettingsCard } from './SettingsCard'
import { useAdminT } from './I18nProvider'
import { LayoutMenuFields } from './LayoutMenuFields'
import { FrontFields } from './FrontFields'
import { FooterField } from './FooterField'
import { ListingFeatureFields } from './FeatureFields'
import { PostThumbField } from './PostImageFields'

export function SettingsHomeTab({ s, update, posts, pages, categories, grid, col }: {
  s: SiteSettings
  update: (partial: Partial<SiteSettings>) => void
  posts: { slug: string; title: string }[]
  pages: { slug: string; title: string }[]
  categories: string[]
  grid: string
  col: string
}) {
  const t = useAdminT()
  return (
    <div className={grid}>
      <div className={col}>
        <SettingsCard title={t.cardLayout}>
          <LayoutMenuFields s={s} update={update} posts={posts} pages={pages} />
        </SettingsCard>
        <SettingsCard title={t.footerContent}>
          <FooterField value={s.footer} onChange={(footer) => update({ footer })} />
        </SettingsCard>
      </div>
      <div className={col}>
        {/* Only when the site actually serves one. Twenty questions about a front page
            nobody is showing is how a settings screen becomes something people scroll past. */}
        {s.home.mode === 'front' && (
          <SettingsCard title={t.cardFront}>
            <FrontFields
              front={s.home.front}
              onChange={(front) => update({ home: { ...s.home, front } })}
              posts={posts}
              categories={categories}
            />
          </SettingsCard>
        )}
        {/* The rows in a list, and the picture beside one. The thumbnail arrives from the old
            Post pictures card, where it sat beside the hero because they share a stored shape
            — which is a fact about storage, not about the question. */}
        <SettingsCard title={t.cardListing}>
          <div className="space-y-5">
            <ListingFeatureFields features={s.features} onChange={(features) => update({ features })} />
            <PostThumbField postImage={s.postImage} onChange={(postImage) => update({ postImage })} />
          </div>
        </SettingsCard>
      </div>
    </div>
  )
}
