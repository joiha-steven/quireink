// ⌘⇧K — the door that makes the arrangement stop mattering.
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
import { indexIn, lanes } from '@/accent'
import { SETTINGS_INDEX } from './settings-index'
import { useAdminT } from './I18nProvider'
import { OVERLAY } from './sheet'
import { UTIL } from './scale'
import { useToast } from '@/admin/ui/Toast'
import type { AdminStrings } from '@/locales/types'

/**
 * Asked for by name, so nothing has to hold a setter.
 *
 * THE CHORD IS NOT DISCOVERABLE AND WAS NEVER GOING TO BE. This file's own header says a palette you
 * must find before the admin is usable is a lock rather than a door, and it was written for
 * "hands that already know it is there" — which is every hand except a new one. The rail now
 * carries a search control that opens this and PRINTS THE CHORD beside itself, so the way to
 * learn the shortcut is to use the mouse once.
 */
export const PALETTE_EVENT = 'quireink:palette'
export const openPalette = (): void => { window.dispatchEvent(new Event(PALETTE_EVENT)) }

type Group = 'recent' | 'action' | 'post' | 'screen' | 'setting'

type Row = {
  id: string
  label: string
  /** The short right-hand word: which tab, which kind. It is `shrink-0`, so it must stay short. */
  hint: string
  /** What the typing is matched against — wider than what is shown. */
  search: string
  /** Where it goes. Empty for a row that DOES something instead of going somewhere. */
  href: string
  /** What it does, for the rows that are verbs rather than places. */
  run?: () => Promise<void> | void
  group: Group
}

/** The five most recently used rows, by id. A device preference: it never leaves this browser. */
const RECENT_KEY = 'quireink-admin-palette-recent'
const RECENT_MAX = 5

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : []
  } catch {
    // A private window, or somebody's hand-edited value. An empty history is the right
    // answer to both, and neither is worth a message.
    return []
  }
}

function rememberRecent(id: string): void {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch { /* storage refused; the palette still works, it just forgets */ }
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
  { label: 'newNote', href: '/admin/note-editor' },
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
    blog: t.tabBlog, home: t.tabHome, post: t.tabPost, appearance: t.tabAppearance,
    people: t.tabPeople, server: t.tabServer, account: t.tabAccount,
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

// RECENT FIRST, and it is the whole reason a palette beats a menu: the thing you did an
// hour ago is the thing you are most likely doing again. Then the verbs, then the writing,
// then the places, then the 107 settings rows which only ever appear once something is typed.
const GROUP_ORDER: Group[] = ['recent', 'action', 'post', 'screen', 'setting']

export function CommandPalette() {
  const t = useAdminT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [posts, setPosts] = useState<Row[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const { notify } = useToast()

  // Read on OPEN rather than on mount: the palette outlives every screen in the admin, and a
  // list read once at boot would still be showing this morning's five at midnight.
  useEffect(() => { if (open) setRecent(readRecent()) }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⚠️ SHIFT IS REQUIRED, since 2026-09-07. This listened for `Mod-k` unconditionally
      // while the editor bound the same chord to its link box, so pressing it mid-sentence
      // ran both: the link box took the selection and this opened on top of it. `Mod-k` is
      // the link in every editor anybody has used, so the palette moved rather than the link.
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey) || e.altKey || !e.shiftKey) return
      // And even then, not over something that has already answered the key.
      if (e.defaultPrevented) return
      e.preventDefault()
      setOpen((was) => !was)
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

  /**
   * The two verbs the palette carries that are not a destination.
   *
   * They live here rather than in `buildRows` because they need the toast and the refresh —
   * `buildRows` is a pure function of the dictionary, and keeping it that way is what lets it
   * be memoised on `t` alone.
   */
  const verbs: Row[] = useMemo(() => [
    {
      id: 'v:cache',
      label: t.clearCache,
      hint: '',
      search: t.clearCache,
      href: '',
      group: 'action',
      run: async () => {
        const res = await fetch('/api/cache/clear', { method: 'POST' })
        notify(res.ok ? t.cacheCleared : t.saveFailed, res.ok ? 'success' : 'error')
      },
    },
    {
      id: 'v:backup',
      label: t.paletteBackupNow,
      hint: '',
      search: t.paletteBackupNow,
      href: '',
      group: 'action',
      run: async () => {
        const res = await fetch('/api/backup/run', { method: 'POST' })
        notify(res.ok ? t.paletteBackupDone : t.saveFailed, res.ok ? 'success' : 'error')
      },
    },
  ], [t, notify])

  const rows = useMemo(() => [...buildRows(t), ...verbs], [t, verbs])
  const needle = query.trim()
  const shown = useMemo(() => {
    const all = [...rows, ...posts]
    const matched = needle
      ? all.filter((r) => indexIn(lanes(`${r.search} ${r.hint}`), needle) !== -1)
      : all.filter((r) => r.group !== 'setting') // an empty box offers the short list, not 107 rows
    // RECENT IS A COPY, not a move: a row that is both recent and an action appears twice on
    // purpose — once where you left it and once where it lives — because the second is how
    // somebody learns where it lives.
    const byId = new Map(all.map((r) => [r.id, r]))
    const recentRows: Row[] = needle
      ? []
      : recent.map((id) => byId.get(id)).filter((r): r is Row => r !== undefined)
        .map((r) => ({ ...r, id: `r:${r.id}`, group: 'recent' as const }))
    return [...recentRows, ...matched]
      .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
      .slice(0, 40)
  }, [rows, posts, needle, recent])

  /** The heading a row opens, or null when the row before it was in the same group. */
  const GROUP_LABEL: Record<Group, string> = {
    recent: t.paletteGroupRecent,
    action: t.paletteGroupAction,
    post: t.paletteGroupPost,
    screen: t.paletteGroupScreen,
    setting: t.paletteGroupSetting,
  }

  useEffect(() => setCursor(0), [query])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  if (!open) return null

  const go = (row: Row | undefined) => {
    if (!row) return
    setOpen(false)
    setQuery('')
    // The RECENT copy remembers what it is a copy OF, so choosing it twice does not fill the
    // list with `r:r:r:` prefixes.
    rememberRecent(row.id.startsWith('r:') ? row.id.slice(2) : row.id)
    if (row.run) void row.run()
    else router.push(row.href)
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
        className={`w-full max-w-xl overflow-hidden ${OVERLAY}`}
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
                {/* THE HEADING, drawn by the FIRST row of each group rather than by a second
                    pass over the list. The list was sorted into groups already and showed no
                    sign of it, so "Settings" and "Screens" ran together as one column of
                    forty rows with a change of subject somewhere in the middle. */}
                {(i === 0 || shown[i - 1]?.group !== row.group) && (
                  <p className={`${UTIL} px-4 pb-1 ${i === 0 ? 'pt-1.5' : 'pt-3'}`}>{GROUP_LABEL[row.group]}</p>
                )}
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
