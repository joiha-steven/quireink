// Manage categories + tags across ALL posts: rename (merges on collision) or
// remove a term. Counts are derived from the same post index the dashboard
// already has, so no extra fetch. Each action calls POST /api/taxonomy then
// refreshes. Two responsive columns on desktop, stacked on mobile.
import { useRouter } from '@/admin/router'
import type { Post, ApiResponse } from '@/types'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { useToast } from '@/admin/ui/Toast'
import { useAdminT } from './I18nProvider'
import { ICON_BTN, PencilIcon, TrashIcon } from './RowActions'

type Term = { name: string; count: number }
type Kind = 'category' | 'tag'

// Count occurrences of each term across all posts, sorted by name.
function tally(lists: string[][]): Term[] {
  const m = new Map<string, number>()
  for (const list of lists) for (const v of list) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// One taxonomy column (categories or tags). Top-level so it is a stable component.
function Section({
  title,
  terms,
  kind,
  t,
  onAct,
}: {
  title: string
  terms: Term[]
  kind: Kind
  t: AdminStrings
  onAct: (kind: Kind, name: string, action: 'rename' | 'delete') => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold dark:border-neutral-800">{title}</h2>
      {terms.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">{t.noTerms}</p>
      ) : (
        <ul>
          {terms.map((term) => (
            <li
              key={term.name}
              className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5 last:border-0 dark:border-neutral-800"
            >
              <span className={`min-w-0 flex-1 truncate text-sm ${kind === 'tag' ? 'lowercase' : ''}`}>{term.name}</span>
              <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{term.count}</span>
              <button type="button" onClick={() => onAct(kind, term.name, 'rename')} aria-label={t.rename} title={t.rename} className={ICON_BTN}>
                <PencilIcon />
              </button>
              <button type="button" onClick={() => onAct(kind, term.name, 'delete')} aria-label={t.delete} title={t.delete} className={ICON_BTN}>
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TaxonomyManager({ posts }: { posts: Post[] }) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()

  const categories = tally(posts.map((p) => p.categories ?? []))
  const tags = tally(posts.map((p) => p.tags ?? []))

  async function act(kind: Kind, name: string, action: 'rename' | 'delete') {
    let newName: string | undefined
    if (action === 'rename') {
      const input = window.prompt(t.renamePrompt, name)
      if (input === null) return
      newName = input.trim()
      if (!newName || newName === name) return
    } else if (!confirm(t.confirmDeleteTerm)) {
      return
    }
    try {
      const res = await fetch('/api/taxonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name, action, newName }),
      })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      notify(action === 'rename' ? t.renamed : t.deleted)
      router.refresh()
    } catch {
      notify(t.saveFailed, 'error')
    }
  }

  return (
    // One column: this lives in the right-hand sheet now (384px), where the old
    // `lg:grid-cols-2` would have squeezed two term lists into ~170px each — the lg:
    // breakpoint reads the VIEWPORT, not the box it is actually in.
    <div className="grid items-start gap-6">
      <Section title={t.categories} terms={categories} kind="category" t={t} onAct={act} />
      <Section title={t.tags} terms={tags} kind="tag" t={t} onAct={act} />
    </div>
  )
}
