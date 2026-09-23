// THE COMMAND PALETTE'S BEHAVIOUR: a filter over rows that are already here, a cursor, and
// two verbs.
//
// Every destination is drawn (`web/admin/overlays.ts`) with its two search lanes on the
// element, so this narrows what is on the page rather than building a list — the rule the
// write column follows over forty-eight pieces. What it BUILDS is the writing: those come from
// `/api/admin/search`, which reaches into the body, and no markup can hold an answer to a
// question nobody has typed yet.
//
// ⚠️ THE TWO LANES ARE THE VIETNAMESE RULE, and they are `src/accent.ts`'s, not a second copy:
// an unaccented query finds every accent, an accented one finds only itself. Folding both sides
// would make `lề` match `lệ`, which is a different word.
import { indexIn, lanes } from '@/accent'
import { el } from '@/admin/components/node-dom'
import { say } from './media-bridge'

/**
 * Asked for by name, so nothing has to hold a setter.
 *
 * THE CHORD IS NOT DISCOVERABLE AND WAS NEVER GOING TO BE — a palette you must find before the
 * admin is usable is a lock rather than a door. The rail carries a search control that opens
 * this and PRINTS THE CHORD beside itself, so the way to learn the shortcut is to use the
 * mouse once.
 */
export const PALETTE_EVENT = 'quireink:palette'

/** The five most recently used rows, by id. A device preference: it never leaves this browser. */
const RECENT_KEY = 'quireink-admin-palette-recent'
const RECENT_MAX = 5
/** Enough to answer something. A search on the first letter matches everything and says nothing. */
const BODY_FROM = 2
const DEBOUNCE = 180

export type PaletteWords = {
  cacheCleared: string
  saveFailed: string
  paletteBackupDone: string
  kindPage: string
  scopePosts: string
}

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX)
      : []
  } catch {
    // A private window, or somebody's hand-edited value. An empty history answers both.
    return []
  }
}

function remember(id: string): void {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch { /* storage refused; the palette works, it just forgets */ }
}

export function wirePalette(words: PaletteWords): () => void {
  const at = <T extends HTMLElement>(hook: string): T | null => document.querySelector<T>(hook)
  const scrim = at('[data-palette-scrim]')
  const box = at<HTMLInputElement>('[data-palette-box]')
  const list = at('[data-palette-list]')
  const none = at('[data-palette-none]')
  const recentSlot = at('[data-pal-recent]')
  const postSlot = at('[data-pal-posts]')
  if (!scrim || !box || !list) return () => {}

  const rows = (): HTMLElement[] => [...list.querySelectorAll<HTMLElement>('[data-pal-row]')]
  let cursor = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let opener: HTMLElement | null = null

  /** The rows a person can currently choose, in the order they are drawn. */
  const live = (): HTMLElement[] => rows().filter((r) => !r.hidden)

  /**
   * Where the cursor is, said three ways: the tint for the eye, `aria-selected` for the row
   * itself, and `aria-activedescendant` on the input — which is how the pattern tells a screen
   * reader what Return would take while the keyboard never leaves the box. A highlight alone
   * said it to the eye only.
   */
  const mark = (): void => {
    const shown = live()
    cursor = Math.max(0, Math.min(cursor, shown.length - 1))
    shown.forEach((r, i) => {
      const on = i === cursor
      r.classList.toggle('bg-neutral-100', on)
      r.classList.toggle('dark:bg-neutral-800', on)
      r.setAttribute('aria-selected', String(on))
      if (on) {
        box!.setAttribute('aria-activedescendant', r.id)
        r.scrollIntoView({ block: 'nearest' })
      }
    })
    if (shown.length === 0) box!.removeAttribute('aria-activedescendant')
  }

  // A row's two lanes, folded the first time a query reaches it and kept: the markup carries the
  // words once (`web/admin/overlays.ts`), and a keystroke should not fold a hundred rows again.
  const folded = new WeakMap<HTMLElement, { text: string; lower: string; folded: string }>()
  const laneOf = (r: HTMLElement): { text: string; lower: string; folded: string } => {
    let lane = folded.get(r)
    if (!lane) {
      const l = lanes(r.dataset.palSearch ?? '')
      // `text` is the lower lane, as it always was here: the match is case-blind either way.
      lane = { text: l.lower, lower: l.lower, folded: l.folded }
      folded.set(r, lane)
    }
    return lane
  }

  const settle = (): void => {
    const needle = box.value.trim()
    const asked = needle !== ''
    for (const r of rows()) {
      // An empty box offers the short list, not a hundred and seven rows.
      if (!asked) {
        r.hidden = r.dataset.palGroup === 'setting'
        continue
      }
      r.hidden = indexIn(laneOf(r), needle) === -1
    }
    // A HEADING IS ONLY A HEADING IF SOMETHING FOLLOWS IT. The list is drawn in group order,
    // so each one shows exactly when its own group has a row left.
    let firstHead = true
    for (const head of list.querySelectorAll<HTMLElement>('[data-pal-head]')) {
      const group = head.dataset.palHead
      head.hidden = !rows().some((r) => !r.hidden && r.dataset.palGroup === group)
      // The top of the list wants less air above it than the gaps between groups do, and which
      // heading is at the top depends on what is showing — not on which is first in the markup.
      if (!head.hidden && firstHead) { head.dataset.palFirst = ''; firstHead = false }
      else delete head.dataset.palFirst
    }
    if (none) none.hidden = live().length > 0
    list.hidden = live().length === 0
    mark()
  }

  /**
   * The writing, from the admin's own search — the one that reaches into the body.
   *
   * Built rather than drawn, and it is the one part of this list that has to be: the answer
   * depends on what was typed.
   */
  const findWriting = async (q: string): Promise<void> => {
    if (!postSlot) return
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
      const json = await res.json() as {
        data?: { hits?: { kind: string; slug: string; title: string }[] }
      }
      // Still the query somebody is looking at? A slow answer to one they have moved on from
      // would put yesterday's post at the top of the list.
      if (box.value.trim() !== q) return
      postSlot.replaceChildren()
      for (const hit of (json.data?.hits ?? []).slice(0, 5)) {
        const label = hit.title || hit.slug
        const row = el('li', {
          className: 'flex cursor-pointer items-baseline justify-between gap-4 px-4 py-2 text-sm',
          role: 'option', 'aria-selected': 'false',
          id: `pal-p-${hit.kind}-${hit.slug.replace(/[^a-z0-9]+/gi, '-')}`,
          'data-pal-row': '', 'data-pal-group': 'post',
          'data-pal-id': `p:${hit.kind}:${hit.slug}`,
          'data-pal-search': label,
          'data-pal-href': `/admin/${hit.kind === 'page' ? 'page-editor' : 'editor'}/${hit.slug}`,
        })
        const name = el('span', { className: 'min-w-0 truncate text-neutral-900 dark:text-white' })
        name.textContent = label
        const kind = el('span', { className: 'shrink-0 text-xs text-neutral-500 dark:text-neutral-400' })
        kind.textContent = hit.kind === 'page' ? words.kindPage : words.scopePosts
        row.append(name, kind)
        postSlot.appendChild(row)
      }
      settle()
    } catch {
      // A failed search leaves the rest of the palette working.
      postSlot.replaceChildren()
      settle()
    }
  }

  const run = async (what: string): Promise<void> => {
    const path = what === 'backup' ? '/api/backup/run' : '/api/cache/clear'
    const res = await fetch(path, { method: 'POST' }).catch(() => null)
    const ok = res?.ok === true
    const done = what === 'backup' ? words.paletteBackupDone : words.cacheCleared
    say(ok ? done : words.saveFailed, ok ? undefined : 'error')
  }

  const choose = (row: HTMLElement | undefined): void => {
    if (!row) return
    show(false)
    // The RECENT copy remembers what it is a copy OF, so choosing it twice does not fill the
    // list with `r:r:r:` prefixes.
    const id = row.dataset.palId ?? ''
    remember(id.startsWith('r:') ? id.slice(2) : id)
    const verb = row.dataset.palRun
    if (verb) void run(verb)
    else if (row.dataset.palHref) location.href = row.dataset.palHref
  }

  /**
   * RECENT IS A COPY, not a move: a row that is both recent and an action appears twice on
   * purpose — once where you left it and once where it lives — because the second is how
   * somebody learns where it lives.
   */
  const fillRecent = (): void => {
    if (!recentSlot) return
    recentSlot.replaceChildren()
    const byId = new Map(rows().map((r) => [r.dataset.palId ?? '', r]))
    for (const id of readRecent()) {
      const source = byId.get(id)
      if (!source) continue
      const copy = source.cloneNode(true) as HTMLElement
      copy.dataset.palGroup = 'recent'
      copy.dataset.palId = `r:${id}`
      copy.hidden = false
      recentSlot.appendChild(copy)
    }
  }

  function show(on: boolean): void {
    if (on) opener = document.activeElement as HTMLElement | null
    scrim!.hidden = !on
    if (!on) {
      box!.value = ''
      opener?.focus()
      return
    }
    // Read on OPEN rather than at boot: the palette outlives every screen in the admin, and a
    // list read once would still be showing this morning's five at midnight.
    fillRecent()
    cursor = 0
    settle()
    box!.focus()
  }

  box.addEventListener('input', () => {
    cursor = 0
    settle()
    clearTimeout(timer)
    const q = box.value.trim()
    if (q.length < BODY_FROM) { postSlot?.replaceChildren(); settle(); return }
    timer = setTimeout(() => { void findWriting(q) }, DEBOUNCE)
  })

  box.addEventListener('keydown', (e) => {
    const shown = live()
    if (e.key === 'Escape') show(false)
    else if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(cursor + 1, shown.length - 1); mark() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(cursor - 1, 0); mark() }
    else if (e.key === 'Enter') { e.preventDefault(); choose(shown[cursor]) }
  })

  list.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-pal-row]')
    if (row) choose(row)
  })
  list.addEventListener('mouseover', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-pal-row]')
    if (!row) return
    const where = live().indexOf(row)
    if (where >= 0 && where !== cursor) { cursor = where; mark() }
  })
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) show(false) })

  const onKey = (e: KeyboardEvent): void => {
    // ⚠️ SHIFT IS REQUIRED. This listened for `Mod-k` unconditionally while the editor bound
    // the same chord to its link box, so pressing it mid-sentence ran both: the link box took
    // the selection and this opened on top of it. `Mod-k` is the link in every editor anybody
    // has used, so the palette moved rather than the link.
    if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey) || e.altKey || !e.shiftKey) return
    // And even then, not over something that has already answered the key.
    if (e.defaultPrevented) return
    e.preventDefault()
    show(scrim.hidden)
  }
  const onAsk = (): void => show(true)
  window.addEventListener('keydown', onKey)
  window.addEventListener(PALETTE_EVENT, onAsk)
  // The third door: a control on a screen that has nothing else to offer. The dead end's own
  // search IS this, rather than a fourth box to type a title into.
  for (const key of document.querySelectorAll('[data-open-palette]')) {
    key.addEventListener('click', onAsk)
  }

  return () => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener(PALETTE_EVENT, onAsk)
    clearTimeout(timer)
  }
}
