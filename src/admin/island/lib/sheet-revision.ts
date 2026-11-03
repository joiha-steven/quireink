// An overwritten version, as the draft the editor loads when the writer restores it.
import type { PostRevision } from '@/types'
import type { SheetDraft } from '@/admin-shared/sheet-wire'

/**
 * Every field the revision carries (`pushRevision`), over the draft on screen. The slug, the date
 * and the STATUS stay current, because restoring words must not rename, reschedule or unpublish
 * the piece.
 *
 * It took the title, the terms, the excerpt and the picture only, so series, cover and meta came
 * back as they are now; and a DERIVED excerpt came back as if the writer had written it, frozen
 * from then on (2026-11-03). One is left empty here, exactly as opening the piece does
 * (`screens/sheet-frame.ts`), so the next save derives it again.
 */
export function draftFromRevision(current: SheetDraft, rev: PostRevision): SheetDraft {
  return {
    ...current,
    title: rev.title,
    categories: rev.categories,
    tags: rev.tags,
    series: rev.series ?? '',
    seriesOrder: rev.seriesOrder ?? 0,
    featuredImage: rev.featuredImage ?? '',
    coverImage: rev.coverImage ?? '',
    metaTitle: rev.metaTitle ?? '',
    metaDescription: rev.metaDescription ?? '',
    excerpt: rev.excerptAuto ? '' : (rev.excerpt ?? ''),
    lang: rev.lang ?? '',
    translationGroup: rev.translationGroup ?? '',
  }
}
