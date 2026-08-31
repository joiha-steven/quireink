// The way past the tabs.
//
// Split out of `SettingsView` when that file passed the 400-line ceiling — the same seam the
// tour was split on: this file knows about matching and results and nothing about which tab
// is open, and `SettingsView` knows about tabs and nothing about matching. `onPick` is the
// whole contract between them.
//
// Why a search rather than a third rearrangement of the tabs: `settings-index.ts`.

import { useState } from 'react'
import { CONTROL_SM } from './kit'
import { OVERLAY } from './sheet'
import { useAdminT } from './I18nProvider'
import { searchSettings, type SettingEntry, type SettingsTab } from './settings-index'

export function SettingsSearch({ tabLabel, onPick }: {
  /** What to call a tab in a result row — the caller owns the tab list. */
  tabLabel: (tab: SettingsTab) => string
  /** Chosen: go to this setting. The caller switches tab and scrolls. */
  onPick: (entry: SettingEntry) => void
}) {
  const t = useAdminT()
  const [query, setQuery] = useState('')
  const results = searchSettings(query, t)
  // Two characters is where `searchSettings` starts answering; below it the panel would
  // flash open on the first keystroke with the whole index in it.
  const showing = query.trim().length >= 2

  return (
    // NO BOTTOM MARGIN. This sits in the sheet's header row beside the tabs, and that row
    // is `items-center` — which centres a flex item's MARGIN box, not its border box. A
    // `mb-4` here therefore pushed the field up by half of it: measured 2026-08-28, the
    // field's centre sat 8px above the tab strip's, which is exactly the misalignment
    // against the tabs that was reported. `CLUSTER_GAP` is a token for STACKING clusters
    // vertically; in a horizontal row it separates the field from nothing and moves it.
    //
    // `relative`, because the results hang off this box. They used to be the NEXT FLEX ITEM
    // in the sheet's tools row, which is a thing a row of tools cannot survive: measured at
    // 1648px with three hits showing, the row went from 61px to 169 and the list — 311px of
    // it — took a place on the row and pushed the tabs, the save key and the field around it.
    // A list of results is not a tool. It is an overlay over the page, and the admin has one:
    // `OVERLAY`, the same paper the command palette and the media picker are drawn on.
    // 208px on a wide screen and not 320: the field was as wide as the eight tabs at the
    // other end of the band and looked like the point of the row rather than the way past
    // it. It is the width the library's tools row already gives the same control.
    <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.settingsSearch}
        aria-label={t.settingsSearch}
        className={`${CONTROL_SM} w-full`}
      />

      {showing && (
        // Hung from the field's RIGHT edge, which is the sheet's right edge: anchored left it
        // would run off the paper on the narrow screens where the field itself is full width.
        // Its own width rather than the field's: on a phone the field gives up its width to
        // the save key beside it and measures 165px, and a 165px list broke "Font smoothing
        // (anti-aliasing)" over three lines. The viewport cap is what keeps 320px of panel
        // from hanging off the left edge of a 375px screen.
        <div className={`absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden ${OVERLAY}`}>
          {results.length === 0
            ? <p className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">{t.settingsSearchEmpty}</p>
            : (
              <ul className="max-h-80 divide-y divide-neutral-200 overflow-y-auto dark:divide-neutral-800">
                {results.map((r) => (
                  <li key={`${r.tab}:${String(r.label)}`}>
                    {/* One row is one jump: it names the setting AND the tab, and clicking it
                        does both halves — switch and scroll — so landing on the right tab is
                        not followed by hunting the card. */}
                    <button
                      type="button"
                      onClick={() => { onPick(r); setQuery('') }}
                      className="flex w-full items-baseline justify-between gap-4 px-4 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                    >
                      <span className="text-sm text-neutral-800 dark:text-neutral-200">{String(t[r.label])}</span>
                      <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{tabLabel(r.tab)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </div>
  )
}
