// The palette's two positions in the rail, and why there are two.
//
// Search is CHROME when the wordmark is on: a small key balanced against the mark on the top
// row. Switch the wordmark off and that balance has nothing to balance against — one glyph
// floating over a column of left-aligned labels — so it becomes what everything else at that
// edge is: a row, with its label and its chord, sitting directly above Home.
//
// Split out of `NavColumn` when the rail's foot became a strip and that file passed its
// 400-line ceiling. The seam is honest: this is ONE control in two dresses, and nothing else
// in the column needs to know which one is on screen.
import type { ReactNode } from 'react'
import { openPalette } from './CommandPalette'
import { chordFor, printChord, tip } from './editorKeys'
import { IconSearch } from './navIcons'
import { useAdminT } from './I18nProvider'

/** The chord badge. It is the whole reason this control is visible at all — see `SearchKey`. */
function Chord({ className = '' }: { className?: string }): ReactNode {
  return (
    <span className={`rounded border border-neutral-200 px-1 py-px text-xs tabular-nums leading-none dark:border-neutral-700 ${className}`}>
      {printChord(chordFor('palette'))}
    </span>
  )
}

/**
 * Search as a ROW, for a rail with no wordmark.
 *
 * `data-nav-search` is the same handle the key carries: it is ONE control in two positions,
 * and which one is on screen is exactly what a test wants to ask. The `nav` scope in a
 * selector separates them — the row is in the column, the key is not.
 */
export function SearchRow({ collapsed, close, rowClass }: {
  collapsed: boolean
  close: () => void
  rowClass: string
}) {
  const t = useAdminT()
  return (
    <button
      type="button"
      data-nav-search
      onClick={() => { close(); openPalette() }}
      title={collapsed ? tip(t.paletteTitle, 'palette') : undefined}
      className={`${rowClass} ${!collapsed ? 'justify-between' : ''}`}
    >
      <span className={`flex min-w-0 items-center ${collapsed ? '' : 'gap-3'}`}>
        <IconSearch />
        {!collapsed && <span className="truncate">{t.paletteTitle}</span>}
      </span>
      {!collapsed && <Chord className="text-neutral-500 dark:text-neutral-400" />}
    </button>
  )
}

/**
 * Search as chrome, on the wordmark's row.
 *
 * THE CHORD STILL HAS TO BE PRINTED, which is the whole reason this control exists: a chord
 * cannot be discovered, and a mouse teaches a keyboard by showing the chord on the thing the
 * mouse clicks. Collapsed there is no room for the badge and it moves into the tooltip.
 */
export function SearchKey({ collapsed, close }: { collapsed: boolean; close: () => void }) {
  const t = useAdminT()
  return (
    <button
      type="button"
      data-nav-search
      onClick={() => { close(); openPalette() }}
      title={tip(t.paletteTitle, 'palette')}
      aria-label={t.paletteTitle}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-transparent px-2 text-neutral-500 transition-colors hover:border-neutral-200 hover:bg-neutral-50 hover:text-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
    >
      <IconSearch />
      {!collapsed && <Chord />}
    </button>
  )
}
