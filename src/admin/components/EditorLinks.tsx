// The three things you can do to a piece that are not editing it: read its past, look at
// it as a reader does, and see whether anybody did.
//
// They sit in the attributes sheet's header (`PublishPanel`'s `links`), because none of
// them is an attribute — they are ways OUT of the editor and back to the same piece seen
// from somewhere else.
//
// Analytics joined them on 2026-08-30. Its screen already existed and already had the
// numbers; what it did not have was a door reachable from the piece. The only route in was
// a row in the top-ten table, so the moment you most want a piece's figures — with that
// piece open in front of you — was the moment you could not get to them.
import Link from '@/admin/router'
import { useAdminT } from './I18nProvider'

export function EditorLinks({
  slug,
  published,
  scheduled,
  onHistory,
}: {
  /** The slug as SAVED. Null or empty while a piece has never been written to disk. */
  slug: string | null
  published: boolean
  scheduled: boolean
  onHistory: () => void
}) {
  const t = useAdminT()
  const quiet = 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
  // Both of the outward links need a piece that is actually public: there is nothing to
  // view and nothing measured otherwise, and a link to a certainly-empty screen is worse
  // than no link at all.
  const live = published && !!slug && !scheduled

  return (
    <>
      {!!slug && (
        <button type="button" onClick={onHistory} className={quiet}>{t.history}</button>
      )}
      {live && (
        <a href={`/${slug}`} target="_blank" rel="noopener" className={quiet}>{t.viewPost}</a>
      )}
      {live && (
        <Link
          href={`/admin/analytics?path=${encodeURIComponent(`/${slug}`)}`}
          data-piece-stats
          className={quiet}
        >
          {t.analyticsTitle}
        </Link>
      )}
    </>
  )
}
