// OPENING THE SHORTCUT SHEET, and nothing else.
//
// The sheet itself is markup (`web/admin/overlays.ts`): every chord, in both spellings, drawn
// with the page. What could not be drawn is the gesture that raises it.
//
// ⚠️ `?` AND NOT A CHORD, which is the convention every application with one of these follows,
// and it is why the guard below matters more than usual: `?` is Shift+/ on a US keyboard and an
// unmodified key on several others, so a bare listener that does not check what has focus eats
// a question mark out of the middle of a sentence.
export function wireShortcutSheet(): () => void {
  const scrim = document.querySelector<HTMLElement>('[data-keys-scrim]')
  const sheet = document.querySelector<HTMLElement>('[data-shortcut-sheet]')
  if (!scrim || !sheet) return () => {}

  let opener: HTMLElement | null = null
  const show = (on: boolean): void => {
    if (on) opener = document.activeElement as HTMLElement | null
    scrim.hidden = !on
    if (on) sheet.focus()
    else opener?.focus()
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { if (!scrim.hidden) show(false); return }
    if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return
    // Never over a field, and never inside the editor — both are places a question mark is a
    // character somebody is typing rather than a request for help.
    const on = document.activeElement
    if (on instanceof HTMLElement
      && (on.tagName === 'INPUT' || on.tagName === 'TEXTAREA' || on.isContentEditable)) return
    e.preventDefault()
    show(scrim.hidden)
  }
  document.addEventListener('keydown', onKey)
  // `mousedown` on the scrim only: a press that started INSIDE the sheet and ended outside it
  // is a selection being dragged, not a dismissal.
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) show(false) })

  return () => document.removeEventListener('keydown', onKey)
}
