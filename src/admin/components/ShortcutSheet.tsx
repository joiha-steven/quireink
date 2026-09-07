// Every chord this admin answers, on one sheet, opened by `?`.
//
// The table already existed — `editorKeys.ts` is the single list the handlers and the Help
// screen both read — and there was no way to SEE it without leaving what you were doing and
// going to Help. A shortcut sheet that costs a navigation is a sheet nobody opens, which is
// the same as not having the shortcuts: a chord cannot be discovered, only told.
//
// ⚠️ `?` AND NOT A CHORD, which is the convention every application with one of these
// follows, and it is why the guard below matters more than usual: `?` is Shift+/ on a US
// keyboard and an unmodified key on several others, so a bare listener that does not check
// what has focus eats a question mark out of the middle of a sentence.
//
// The DESCRIPTIONS stay English, like the Help screen's reference material and for the same
// reason (`docs/admin-*`): the chords themselves are symbols, the sheet's own furniture is
// translated, and what is left is a line of reference prose that is canonical in one language
// rather than approximate in eleven.
import { useEffect, useState } from 'react'
import { BUILTIN, SHORTCUTS, printChord } from './editorKeys'
import { OVERLAY } from './sheet'
import { SECTION, UTIL } from './scale'
import { useAdminT } from './I18nProvider'

export function ShortcutSheet() {
  const t = useAdminT()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return
      // Never over a field, and never inside the editor — both are places a question mark is
      // a character somebody is typing rather than a request for help.
      const el = document.activeElement
      if (el instanceof HTMLElement
        && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      setOpen((was) => !was)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null

  // Two groups, and the split is honest: the first are chords this product invented, the
  // second are the ones the editor arrives with. A reader who wants to know "what did they
  // add" can see it, and neither list has to pretend the other does not exist.
  const groups = [
    { label: t.navWrite, rows: SHORTCUTS },
    { label: t.tbBlock, rows: BUILTIN },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-950/30 p-4 pt-[10vh] backdrop-blur-[2px]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.shortcutsTitle}
        data-shortcut-sheet
        onMouseDown={(e) => e.stopPropagation()}
        className={`max-h-[76vh] w-full max-w-2xl overflow-y-auto p-5 ${OVERLAY}`}
      >
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className={SECTION}>{t.shortcutsTitle}</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.shortcutsHint}</p>
        </div>
        {groups.map((g) => (
          <section key={g.label} className="mt-5 first:mt-0">
            <h3 className={`${UTIL} mb-1.5`}>{g.label}</h3>
            <ul>
              {g.rows.map((row) => (
                <li key={row.id} className="flex items-baseline gap-4 border-b border-neutral-100 py-2 last:border-0 dark:border-neutral-800">
                  {/* The CHORD leads, in a fixed column: a sheet is read by running a finger
                      down the keys, not by reading the sentences. */}
                  <kbd className="w-24 shrink-0 whitespace-nowrap font-sans text-sm font-semibold tabular-nums text-neutral-900 dark:text-white">
                    {printChord(row.chord)}
                  </kbd>
                  <span className="min-w-0 text-sm leading-[1.5] text-neutral-600 dark:text-neutral-400">{row.does}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
