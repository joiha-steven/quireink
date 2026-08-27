// Controlled Featured-posts picker. The owner curates an ORDERED list of published
// posts; it renders in the sidebar "Featured" block (first 5, in this order) between
// categories and tags. Parent owns state + save. Add from the dropdown, reorder with
// ↑/↓, remove with ×. A chosen slug whose post is no longer public is dropped on load.
import { NOTE_TEXT, Select } from './kit'
import { useAdminT } from './I18nProvider'

type Props = {
  posts: { slug: string; title: string }[]
  value: string[]
  onChange: (v: string[]) => void
}

const ROW = 'flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800'
const ICON = 'shrink-0 rounded-lg px-2 py-1 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800'

export function FeaturedField({ posts, value, onChange }: Props) {
  const t = useAdminT()
  const titleOf = (slug: string) => posts.find((p) => p.slug === slug)?.title ?? slug
  const chosen = value.filter((slug) => posts.some((p) => p.slug === slug)) // drop stale
  const available = posts.filter((p) => !chosen.includes(p.slug))

  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= chosen.length) return
    const next = [...chosen]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {chosen.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.featuredEmpty}</p>}
      {chosen.map((slug, i) => (
        <div key={slug} className={ROW}>
          <span className="flex-1 truncate">{titleOf(slug)}</span>
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t.moveUp} className={ICON}>↑</button>
          <button type="button" onClick={() => move(i, 1)} disabled={i === chosen.length - 1} aria-label={t.moveDown} className={ICON}>↓</button>
          <button type="button" onClick={() => onChange(chosen.filter((s) => s !== slug))} aria-label={t.delete} className={ICON}>×</button>
        </div>
      ))}
      {available.length > 0 && (
        <Select value="" onChange={(e) => e.target.value && onChange([...chosen, e.target.value])} wrapClassName="flex w-full" className="w-full">
          <option value="">{t.featuredAdd}</option>
          {available.map((p) => (
            <option key={p.slug} value={p.slug}>{p.title || p.slug}</option>
          ))}
        </Select>
      )}
      <p className={NOTE_TEXT}>{t.featuredHint}</p>
    </div>
  )
}
