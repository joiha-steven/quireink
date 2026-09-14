// THE TYPE SCALE: nine roles, a slider and three numbers each, and a live specimen beside them.
//
// ⚠️ THE BOX SAVES, THE SLIDER ECHOES. Both control one setting, and only the number carries
// `data-k` — two controls over one key would count one drag as two unsaved changes and send the
// key twice. The colour cells settled the same question the same way.
//
// ⚠️ THE SPECIMEN IS THE PREVIEW THAT MUST NOT LIE. It shows the READER's face at the size the
// reader will get, so every keystroke repaints its inline `font-size`, `line-height` and
// `letter-spacing` rather than waiting for a save.
import { getFontPreset } from '@/content/themes'

type Dim = 'size' | 'line' | 'spacing'

const box = (screen: HTMLElement, role: string, dim: Dim): HTMLInputElement | null =>
  screen.querySelector<HTMLInputElement>(`input[data-k="typography.roles.${role}.${dim}"]`)

/** Tell the form something moved, in the language every other control speaks. */
const moved = (el: HTMLElement): void => { el.dispatchEvent(new Event('input', { bubbles: true })) }

function repaint(screen: HTMLElement, role: string): void {
  const sample = screen.querySelector<HTMLElement>(`[data-type-specimen="${role}"]`)
  if (!sample) return
  const size = box(screen, role, 'size')?.value
  const line = box(screen, role, 'line')?.value
  const spacing = box(screen, role, 'spacing')?.value
  if (size) sample.style.fontSize = `${size}rem`
  if (line) sample.style.lineHeight = line
  if (spacing) sample.style.letterSpacing = `${spacing}em`
}

export function wireType(screen: HTMLElement): void {
  screen.addEventListener('input', (e) => {
    const el = e.target
    if (!(el instanceof HTMLInputElement)) return

    // The slider moved: write its value into the box that saves, and let that box tell the form.
    const dragged = el.dataset.typeSlider
    if (dragged) {
      const field = box(screen, dragged, 'size')
      if (field && field.value !== el.value) { field.value = el.value; moved(field) }
      repaint(screen, dragged)
      return
    }

    // A number was typed into: put the slider where it now is, and repaint the sample.
    const k = el.dataset.k ?? ''
    const named = /^typography\.roles\.([a-z0-9]+)\.(size|line|spacing)$/.exec(k)
    if (!named) return
    const role = named[1]!
    if (named[2] === 'size') {
      const fader = screen.querySelector<HTMLInputElement>(`[data-type-slider="${role}"]`)
      if (fader && fader.value !== el.value) fader.value = el.value
    }
    repaint(screen, role)
  })

  /**
   * Reset to the CHOSEN FONT's tuning, not to one font's numbers for all of them.
   *
   * Every preset carries a reading setup tuned for its own face: a serif runs small and wants a
   * tighter leading than a sans, and the two book serifs zero out the sans's negative heading
   * tracking. The React reset used the neutral default unconditionally, so an owner reading in
   * Literata who pressed Reset silently got the sans's numbers.
   *
   * It reads the PRESSED tile rather than the stored preset: the two differ the moment somebody
   * picks a face and has not saved, and the numbers that belong with it are the ones on screen.
   */
  screen.querySelector('[data-reset-type]')?.addEventListener('click', () => {
    const track = screen.querySelector<HTMLElement>('[data-choice-track][data-k="fontPreset"]')
    const chosen = track?.querySelector<HTMLElement>('[aria-pressed="true"]')?.dataset.choice
    const roles = getFontPreset(chosen ?? '').typography.roles as Record<string, Record<Dim, number>>
    for (const [role, style] of Object.entries(roles)) {
      for (const dim of ['size', 'line', 'spacing'] as Dim[]) {
        const field = box(screen, role, dim)
        if (!field) continue
        field.value = String(style[dim])
        moved(field)
      }
      const fader = screen.querySelector<HTMLInputElement>(`[data-type-slider="${role}"]`)
      if (fader) fader.value = String(style.size)
      repaint(screen, role)
    }
  })

  /**
   * PICKING A FACE BRINGS ITS NUMBERS WITH IT, which is what the React picker did in one call.
   *
   * A face and a scale that were tuned together are one answer; choosing the face and keeping
   * the previous face's numbers is the mismatch the reset above exists to undo.
   */
  screen.addEventListener('click', (e) => {
    const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-choice]')
    const track = tile?.closest<HTMLElement>('[data-choice-track][data-k="fontPreset"]')
    if (!tile || !track) return
    // After `pickChoice` has moved `aria-pressed`, which runs on the same click.
    queueMicrotask(() => screen.querySelector<HTMLElement>('[data-reset-type]')?.click())
  })
}
