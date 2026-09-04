// The switch that quiets the settings screen, and the row it sits on.
//
// Settings prints an explanation under nearly every label — 115 of them, and by the time the
// screen had thirty-seven groups that copy was 16-30% of the height of the cards (30% on
// Reading, measured 2026-09-04). Worse than the bulk is the ORDER: the kit's rule is label,
// note, control, so an owner who already knows what a switch does still reads past a paragraph
// to reach it. The owner's word for the result was "rối" — tangled.
//
// The answer is NOT shorter copy. Cutting the 47 longest sentences would have meant rewriting
// them in ELEVEN dictionaries, more than five hundred translations of which the owner can
// check two; a screen made tidier in Vietnamese and quietly made worse in Korean is a bad
// trade. Nothing is deleted here. The sentences stay written, the settings search still
// matches on them (`SETTINGS_INDEX` indexes a note as well as a label, because people
// describe rather than name), and the switch brings them all back in one click.
//
// A DEVICE preference, in localStorage, for the same reason the rail's icons and its collapsed
// state are: nothing about the blog changes. This is how one person reads one screen on one
// machine, and putting it in site settings would sync one owner's reading habit to a
// co-author's browser — and add a thirty-eighth thing to the screen it is trying to quiet.
//
// ⚠️ OFF by default, which is the owner's call (2026-09-04) and worth writing down because it
// costs something real: a person opening Settings for the first time meets bare controls with
// no guidance, and the guidance is good. The default is the `=== '1'` below and nothing else.
import { useEffect, useState, type ReactNode } from 'react'
import { SHEET_TOOL } from './sheet'
import { NOTE_TEXT } from './scale'
import { useAdminT } from './I18nProvider'

const KEY = 'quireink-admin-settings-notes'

/**
 * Whether explanations are drawn, and the way to flip it.
 *
 * Read in an effect rather than in `useState`'s initialiser, and deferred a microtask, so the
 * first render is the same on the server and in the browser — the pattern `AdminSidebar` uses
 * for the same three preferences. The cost is a frame at the default for an owner who turned
 * them on; the alternative is a hydration mismatch on every admin load.
 */
export function useSettingsNotes(): [boolean, () => void] {
  const [on, setOn] = useState(false)
  useEffect(() => {
    Promise.resolve().then(() => setOn(localStorage.getItem(KEY) === '1'))
  }, [])
  return [on, () => setOn((v) => {
    const next = !v
    localStorage.setItem(KEY, next ? '1' : '0')
    return next
  })]
}

/**
 * The line under the tabs: what this tab is for, and the switch, at opposite ends of it.
 *
 * The hint keeps `tab-hint`, which is what exempts it from the rule in `admin.css` — a tab
 * with no line under it is an unlabelled box, and quieting the screen must not do that.
 *
 * `items-baseline`, so the switch sits on the hint's own line rather than centred against a
 * hint that has wrapped to two — which it does on a phone in every language. And `flex-wrap`
 * with `basis-64` on the hint, for the same reason `Setting`'s row has it: at 375px the
 * switch was taking 130px off a 278px card and folding the sentence into three lines. Below
 * 16rem of room the switch drops to its own line instead of squeezing the words.
 */
export function SettingsNotesRow({ hint, on, onToggle }: {
  hint: ReactNode
  on: boolean
  onToggle: () => void
}) {
  const t = useAdminT()
  return (
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className={`${NOTE_TEXT} tab-hint min-w-0 flex-1 basis-64 max-w-2xl`}>{hint}</p>
      <button type="button" onClick={onToggle} className={`${SHEET_TOOL} shrink-0`}>
        {on ? t.settingsNotesHide : t.settingsNotesShow}
      </button>
    </div>
  )
}
