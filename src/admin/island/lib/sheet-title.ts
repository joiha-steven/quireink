// The title is one line.
//
// It is a textarea so a long title wraps as the published heading does, and a textarea takes
// Enter as a new line: `Title line\nbody after enter` reached <title>, og:title, the <h1>, the
// contents rail and the feeds (2026-09-30). Enter now moves to the writing, as it does in every
// editor with a title above the body, and a line break pasted in becomes a space.
import { composing, onTyped } from '@/admin/components/composing'

export function wireTitle(box: HTMLTextAreaElement, onTitle: (title: string) => void, toBody: () => void): void {
  box.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || composing(e)) return
    e.preventDefault()
    toBody()
  })
  // The title is reported when a word is SETTLED, not at each step of an input method building it:
  // the slug follows the title, and a slug rebuilt from every half-composed step is a field that
  // rewrites itself under the writer's eyes (`onTyped`).
  onTyped(box, () => {
    const one = box.value.replace(/[\r\n]+/g, ' ')
    if (one !== box.value) {
      const at = box.selectionStart
      box.value = one
      box.setSelectionRange(at, at)
    }
    onTitle(box.value)
  })
}
