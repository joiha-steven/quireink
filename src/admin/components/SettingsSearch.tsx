// The way past the seven tabs.
//
// Split out of `SettingsView` when that file passed the 400-line ceiling — the same seam the
// tour was split on: this file knows about matching and results and nothing about which tab
// is open, and `SettingsView` knows about tabs and nothing about matching. `onPick` is the
// whole contract between them.
//
// Why a search rather than a third rearrangement of the tabs: `settings-index.ts`.

import { useState } from 'react'
import { CONTROL, PANEL_LIST } from './kit'
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
    <>
      {/* NO BOTTOM MARGIN. This sits in the sheet's header row beside the tabs, and that row
          is `items-center` — which centres a flex item's MARGIN box, not its border box. A
          `mb-4` here therefore pushed the field up by half of it: measured 2026-08-28, the
          field's centre sat 8px above the tab strip's, which is exactly what the owner saw
          as "lệch so với mấy cái tab". `CLUSTER_GAP` is a token for STACKING clusters
          vertically; in a horizontal row it separates the field from nothing and moves it. */}
      <div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.settingsSearch}
          aria-label={t.settingsSearch}
          className={`${CONTROL} w-full max-w-80`}
        />
      </div>

      {showing && (
        <div className="mb-6">
          {results.length === 0
            ? <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.settingsSearchEmpty}</p>
            : (
              <ul className={PANEL_LIST}>
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
    </>
  )
}
