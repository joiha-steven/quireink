// Manage post series across ALL posts (incl. drafts): rename or remove a series, and
// reorder its parts. Series data is derived from the same post index the dashboard
// already loaded (no extra fetch) — order matches the public series box (seriesOrder,
// date tiebreak). Each action calls POST /api/series then refreshes.
import { useRouter } from '@/admin/router'
import Link from '@/admin/router'
import type { Post, ApiResponse } from '@/types'
import { seriesEntries } from '@/content/series-order'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'
import { ICON_BTN, PencilIcon, TrashIcon } from './RowActions'

function ChevronUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SeriesManager({ posts }: { posts: Post[] }) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()

  const entries = seriesEntries(posts)

  async function post(body: Record<string, unknown>, okMsg: string) {
    try {
      const res = await fetch('/api/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      notify(okMsg)
      router.refresh()
    } catch {
      notify(t.saveFailed, 'error')
    }
  }

  function rename(name: string) {
    const input = window.prompt(t.renamePrompt, name)
    if (input === null) return
    const newName = input.trim()
    if (!newName || newName === name) return
    post({ action: 'rename', name, newName }, t.renamed)
  }

  function remove(name: string) {
    if (!confirm(t.confirmDeleteSeries)) return
    post({ action: 'delete', name }, t.deleted)
  }

  // Move the part at index i by delta (-1 up / +1 down) and persist the new order.
  function move(name: string, slugs: string[], i: number, delta: number) {
    const j = i + delta
    if (j < 0 || j >= slugs.length) return
    const order = [...slugs]
    ;[order[i], order[j]] = [order[j], order[i]]
    post({ action: 'reorder', name, order }, t.seriesReordered)
  }

  if (entries.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.noSeries}</p>
  }

  return (
    <div className="space-y-6">
      {entries.map((s) => {
        const slugs = s.parts.map((p) => p.slug)
        return (
          <div key={s.name} className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <Link href={`/series/${s.slug}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">
                {s.name}
              </Link>
              <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{s.parts.length}</span>
              <button type="button" onClick={() => rename(s.name)} aria-label={t.rename} title={t.rename} className={ICON_BTN}>
                <PencilIcon />
              </button>
              <button type="button" onClick={() => remove(s.name)} aria-label={t.delete} title={t.delete} className={ICON_BTN}>
                <TrashIcon />
              </button>
            </div>
            <ol>
              {s.parts.map((p, i) => (
                <li
                  key={p.slug}
                  className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5 last:border-0 dark:border-neutral-800"
                >
                  <span className="w-6 shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{i + 1}.</span>
                  <Link href={`/admin/editor/${p.slug}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
                    {p.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => move(s.name, slugs, i, -1)}
                    disabled={i === 0}
                    aria-label={t.moveUp}
                    title={t.moveUp}
                    className={`${ICON_BTN} disabled:pointer-events-none disabled:opacity-30`}
                  >
                    <ChevronUpIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(s.name, slugs, i, 1)}
                    disabled={i === s.parts.length - 1}
                    aria-label={t.moveDown}
                    title={t.moveDown}
                    className={`${ICON_BTN} disabled:pointer-events-none disabled:opacity-30`}
                  >
                    <ChevronDownIcon />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )
      })}
    </div>
  )
}
