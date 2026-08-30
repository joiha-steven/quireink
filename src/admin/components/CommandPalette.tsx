// ⌘K — the door that makes the arrangement stop mattering.
//
// The rail lists ten destinations, Settings holds 107 named controls behind eight tabs, and
// [ADR 0011](../../../docs/decisions/0011-settings-regrouped-into-seven.md) already recorded
// what happens when the answer to "I cannot find it" is a better arrangement: five tangled
// tabs became seven defined ones, and TWO WEEKS LATER the tabs were still reported as
// confusing. `settings-index.ts` was written that day with the conclusion in its header —
// no grouping makes a person remember which of eight boxes holds a thing, and what makes the
// grouping stop mattering is being able to type a word.
//
// That index has driven exactly one search box on one screen ever since. This is the same
// index reached from anywhere, with the screens and the actions beside it, so "make the text
// bigger" and "go to the trash" and "write something" are one gesture and not three.
//
// NOTHING IS REPLACED. The rail stays, the tabs stay, the settings search stays. A palette
// that removes the menus it shortcuts is a palette that has to be discovered before the admin
// can be used at all; this one is for the hands that already know it is there.
//
// IT NAVIGATES, IT DOES NOT SET. Landing on the tab with the setting on it is honest about
// what the index knows — a label and where it lives. Changing a value by name is
// `settings-path.ts`, and it has its own doors (MCP, the assistant) where an agent can read
// the current value back and say what it did.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '@/admin/router'
import { foldAccents } from '@/utils'
import { SETTINGS_INDEX } from './settings-index'
import { useAdminT } from './I18nProvider'
import type { AdminStrings } from '@/locales/types'

/**
 * Asked for by name, so nothing has to hold a setter.
 *
 * ⌘K IS NOT DISCOVERABLE AND WAS NEVER GOING TO BE. This file's own header says a palette you
 * must find before the admin is usable is a lock rather than a door, and it was written for
 * "hands that already know it is there" — which is every hand except a new one. The rail now
 * carries a search control that opens this and PRINTS THE CHORD beside itself, so the way to
 * learn the shortcut is to use the mouse once.
 */
export const PALETTE_EVENT = 'quireink:palette'
export const openPalette = (): void => { window.dispatchEvent(new Event(PALETTE_EVENT)) }

type Row = {
  id: string
  label: string
  /** The short right-hand word: which tab, which kind. It is `shrink-0`, so it must stay short. */
  hint: string
  /** What the typing is matched against — wider than what is shown. */
  search: string
  href: string
  group: 'action' | 'screen' | 'setting' | 'post'
}

/**
 * Dictionary keys whose value is a STRING — the same narrowing `settings-index.ts` carries,
 * and for the same reason: `paletteNames` is a nested record, and a row pointing at it
 * typechecks and then renders `[object Object]`.
 */
type StringKey = { [K in keyof AdminStrings]: AdminStrings[K] extends string ? K : never }[keyof AdminStrings]

/** The screens, in the rail's own order. Labels come from the dictionary the rail uses. */
const SCREENS: { label: StringKey; href: string }[] = [
  { label: 'navHome', href: '/admin' },
  { label: 'navWrite', href: '/admin/content' },
  { label: 'navMedia', href: '/admin/media' },
  { label: 'navNewsletter', href: '/admin/newsletter' },
  { label: 'navAssistant', href: '/admin/assistant' },
  { label: 'navAnalytics', href: '/admin/analytics' },
  { label: 'commentsNavTitle', href: '/admin/comments' },
  { label: 'navTrash', href: '/admin/trash' },
  { label: 'navSettings', href: '/admin/settings' },
  { label: 'navLog', href: '/admin/log' },
  { label: 'navHelp', href: '/admin/help' },
]

const ACTIONS: { label: StringKey; href: string }[] = [
  { label: 'newPost', href: '/admin/editor' },
  { label: 'newPage', href: '/admin/page-editor' },
]

/**
 * Everything the palette can reach, built once per open.
 *
 * The settings rows carry their TAB NAME as the hint, which is the fact the index exists to
 * supply: somebody typing "excerpt" does not want to be told it is called Excerpt length,
 * they want to be told it is behind Site.
 */
function buildRows(t: AdminStrings): Row[] {
  const tabName: Record<string, string> = {
    site: t.tabSite, layout: t.tabLayout, reading: t.tabReading, appearance: t.tabAppearance,
    seo: t.tabSeo, connections: t.tabConnections, ai: t.tabAi, system: t.tabSystem,
  }
  return [
    ...ACTIONS.map((a) => ({ id: `a:${a.href}`, label: t[a.label], hint: '', search: t[a.label], href: a.href, group: 'action' as const })),
    ...SCREENS.map((s) => ({ id: `s:${s.href}`, label: t[s.label], hint: '', search: t[s.label], href: s.href, group: 'screen' as const })),
    ...SETTINGS_INDEX.map((entry, i) => ({
      id: `g:${i}`,
      label: t[entry.label],
      // SHOWN: the tab, and only the tab. The note is a whole sentence — "The interface font
      // — header, footer, menu, dates…" — and putting it in a `shrink-0` right-hand column
      // took the entire row and squeezed the label it was explaining down to nothing.
      hint: tabName[entry.tab] ?? entry.tab,
      // SEARCHED: the note as well, because people describe a setting rather than name it.
      // That is the rule the settings search follows and the reason `note` is in the index.
      search: `${t[entry.label]} ${entry.note ? t[entry.note] : ''}`,
      href: `/admin/settings?tab=${entry.tab}`,
      group: 'setting' as const,
    })),
  ]
}

const GROUP_ORDER: Row['group'][] = ['action', 'post', 'screen', 'setting']

export function CommandPalette() {
  const t = useAdminT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [posts, setPosts] = useState<Row[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault()
        setOpen((was) => !was)
      }
    }
    // A WINDOW EVENT is the second door, and it is why the rail can offer this without
    // importing it: the rail is drawn once at the top of the shell and the palette once at
    // the bottom, and neither is the other's parent. `useFocusMode.ts` keeps three components
    // in step the same way and for the same reason.
    const onAsk = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(PALETTE_EVENT, onAsk)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(PALETTE_EVENT, onAsk)
    }
  }, [])

  // The writing, from the admin's own search — the one that reaches into the body. Debounced
  // and only past two characters, the same threshold the write pane uses, because a search
  // per keystroke on the first letter matches everything and answers nothing.
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) { setPosts([]); return }
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
          const json = (await res.json()) as { data?: { hits?: { kind: string; slug: string; title: string }[] } }
          setPosts((json.data?.hits ?? []).slice(0, 5).map((h) => ({
            id: `p:${h.kind}:${h.slug}`,
            label: h.title || h.slug,
            hint: h.kind === 'page' ? t.kindPage : t.scopePosts,
            search: h.title || h.slug,
            href: `/admin/${h.kind === 'page' ? 'page-editor' : 'editor'}/${h.slug}`,
            group: 'post' as const,
          })))
        } catch {
          setPosts([]) // a failed search leaves the rest of the palette working
        }
      })()
    }, 180)
    return () => clearTimeout(timer)
  }, [open, query, t])

  const rows = useMemo(() => buildRows(t), [t])
  const needle = foldAccents(query.trim())
  const shown = useMemo(() => {
    const all = [...rows, ...posts]
    const matched = needle
      ? all.filter((r) => foldAccents(`${r.search} ${r.hint}`).includes(needle))
      : all.filter((r) => r.group !== 'setting') // an empty box offers the short list, not 107 rows
    return [...matched].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)).slice(0, 40)
  }, [rows, posts, needle])

  useEffect(() => setCursor(0), [query])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  if (!open) return null

  const go = (row: Row | undefined) => {
    if (!row) return
    setOpen(false)
    setQuery('')
    router.push(row.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(shown[cursor]) }
  }

  return (
    // `items-start` with a top offset rather than centred: a centred box jumps as the result
    // list grows and shrinks under the typing, and the thing that must not move is the input.
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-950/30 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={() => { setOpen(false); setQuery('') }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.paletteTitle}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t.palettePlaceholder}
          aria-label={t.palettePlaceholder}
          className="w-full border-b border-neutral-200 bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-neutral-400 dark:border-neutral-700 dark:placeholder:text-neutral-500"
        />
        {shown.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">{t.filterEmpty}</p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto py-1">
            {shown.map((row, i) => (
              <li key={row.id}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(row)}
                  className={`flex w-full items-baseline justify-between gap-4 px-4 py-2 text-left text-sm ${
                    i === cursor ? 'bg-neutral-100 dark:bg-neutral-800' : ''
                  }`}
                >
                  <span className="min-w-0 truncate text-neutral-900 dark:text-white">{row.label}</span>
                  {row.hint && <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{row.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
