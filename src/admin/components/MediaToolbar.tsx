// Library toolbar: total count + size on the left, a name search + sort on the
// right. Split out of MediaLibrary to keep that file thin; presentational, all
// state lives in the parent.
import { formatBytes } from '@/utils'
import { CONTROL, Select } from './kit'
import { useAdminT } from './I18nProvider'

export type MediaSort = 'new' | 'name' | 'size'

export function MediaToolbar({
  count,
  totalSize,
  query,
  onQuery,
  sort,
  onSort,
  className,
}: {
  count: number
  totalSize: number
  query: string
  onQuery: (v: string) => void
  sort: MediaSort
  onSort: (s: MediaSort) => void
  /** Override the band's chrome — the one-sheet Library bleeds it to the sheet's edges. */
  className?: string
}) {
  const t = useAdminT()
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className ?? 'border-b border-neutral-200 pb-4 dark:border-neutral-800'}`}>
      <span className="text-sm text-neutral-500 dark:text-neutral-400">
        <span className="font-medium text-neutral-700 tabular-nums dark:text-neutral-200">{count.toLocaleString()}</span> {t.mediaTotalImages}
        <span className="text-neutral-300 dark:text-neutral-600"> · </span>
        <span className="tabular-nums">{formatBytes(totalSize)}</span>
      </span>
      <div className="ml-auto flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t.mediaSearch}
          className={`${CONTROL} w-40 sm:w-52`}
        />
        <label className="sr-only" htmlFor="media-sort">{t.sortLabel}</label>
        <Select
          id="media-sort"
          value={sort}
          onChange={(e) => onSort(e.target.value as MediaSort)}
        >
          <option value="new">{t.sortNewest}</option>
          <option value="name">{t.sortName}</option>
          <option value="size">{t.sortSize}</option>
        </Select>
      </div>
    </div>
  )
}
