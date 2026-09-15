// THE LINK BOX, asked for from an island.
//
// There are three doors to it — the toolbar button, the bubble bar over a selection, and
// `Mod-k` — and all three ran the same three lines around a `window.prompt` until 2026-09-07.
// Three copies of three lines is how one of them ends up not clearing a link on an empty
// answer, so the box is asked for in ONE place and the three share it.
//
// The dialog itself is not the editor's. It is drawn once into the shell by
// `web/admin/overlays.ts` and wired by the rail island, so the ask goes out as an event: the
// bridge ADR 0054 established. `quire:confirm` carries an optional field and answers with what
// was typed, which is what made `window.prompt` removable at all.
//
// ⚠️ IF NOTHING ANSWERS, NOTHING HAPPENS. A page whose dialog failed to mount must not leave a
// caller awaiting a promise that never settles, so an unheard ask resolves null — the same
// answer as backing out.
import type { SheetWords } from '@/admin-shared/sheet-wire'

export function askForLink(t: SheetWords): (previous: string) => Promise<string | null> {
  return (previous: string) => new Promise<string | null>((resolve) => {
    const heard = !window.dispatchEvent(new CustomEvent('quire:confirm', {
      cancelable: true,
      detail: {
        request: {
          title: t.tbLink,
          input: { label: t.promptLink, initial: previous, placeholder: 'https://' },
          confirmLabel: t.save,
          cancelLabel: t.askCancel,
        },
        // `''` is a real answer and not a refusal: it is the gesture that REMOVES a link, and
        // it is the only one with no button of its own.
        respond: (answer: string, value: string) =>
          resolve(answer === 'confirm' ? (value ?? '') : null),
      },
    }))
    if (!heard) resolve(null)
  })
}
