// Full-size image viewer for post bodies. Every `.prose figure img` becomes clickable,
// with prev/next and keyboard navigation.
//
// Built on `<dialog>`, which supplies the parts that are easy to get wrong by hand: Escape
// closes it, the rest of the page goes inert, focus is trapped, and the backdrop is a
// pseudo-element rather than a div pretending to be one. What is left to write is the
// picture and the arrows.
//
// The viewer is deliberately NOT themed: a light backdrop behind a photograph is a worse
// reading of the photograph, and a dark one is what readers expect.
//
// Clicks are DELEGATED from `.prose`, so an image that loads late is still covered.
//
// ⚠️ AND THE KEYBOARD OPENS IT TOO, since 2026-09-23. Until then the only way in was a pointer:
// the pictures were not focusable, so the viewer — its arrows, its caption — did not exist for
// anyone on Tab. Each picture is now a stop that says it opens a dialog, Enter or Space opens
// it, and closing hands focus back to the picture, which `<dialog>` does by itself.

import { el, label } from './dom'

export function lightbox(): void {
  const root = document.querySelector<HTMLElement>('.prose')
  if (!root) return
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('figure img'))
  if (imgs.length === 0) return
  for (const img of imgs) {
    img.style.cursor = 'zoom-in'
    // No role change: the picture stays a picture with its own alt text, which is what a screen
    // reader should announce, and `aria-haspopup` says what pressing it will do.
    img.tabIndex = 0
    img.setAttribute('aria-haspopup', 'dialog')
  }

  let dialog: HTMLDialogElement | null = null
  let index = 0

  const show = (next: number) => {
    if (!dialog) return
    // Wrap at both ends: from the last image, "next" is the first.
    index = ((next % imgs.length) + imgs.length) % imgs.length
    const img = imgs[index]!
    const view = dialog.querySelector<HTMLImageElement>('.lightbox-img')!
    view.src = img.currentSrc || img.src
    view.alt = img.alt
    dialog.querySelector('.lightbox-caption')!.textContent = img.alt
    const count = dialog.querySelector('.lightbox-count')
    if (count) count.textContent = `${index + 1} / ${imgs.length}`
  }

  const onKey = (e: KeyboardEvent) => {
    // Escape is the dialog's own job. These are not.
    if (e.key === 'ArrowRight') show(index + 1)
    else if (e.key === 'ArrowLeft') show(index - 1)
  }

  function open(at: number): void {
    const view = el('img', { class: 'lightbox-img', alt: '' })
    const caption = el('p', { class: 'lightbox-caption' })
    const closeBtn = el('button', { type: 'button', class: 'lightbox-close', 'aria-label': label('lightboxClose') }, '✕')
    const parts: Node[] = [view, caption, closeBtn]

    if (imgs.length > 1) {
      const arrow = (cls: string, name: string, glyph: string, delta: number) => {
        const b = el('button', { type: 'button', class: cls, 'aria-label': label(name) }, glyph)
        b.addEventListener('click', () => show(index + delta))
        return b
      }
      parts.push(
        arrow('lightbox-prev', 'lightboxPrev', '‹', -1),
        arrow('lightbox-next', 'lightboxNext', '›', 1),
        el('div', { class: 'lightbox-count' }),
      )
    }

    const next = document.createElement('dialog')
    next.className = 'lightbox'
    next.append(...parts)
    // A click that lands on the dialog itself is a click on the backdrop or the padding
    // around the picture, which everyone expects to dismiss. A click on the picture is not.
    next.addEventListener('click', (e) => { if (e.target === next) next.close() })
    closeBtn.addEventListener('click', () => next.close())
    // `close` fires for Escape and for the buttons alike, so teardown is written once.
    next.addEventListener('close', () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      next.remove()
      dialog = null
    })

    document.body.appendChild(next)
    dialog = next
    show(at)
    next.showModal()
    // `showModal` makes the page inert but does not reliably stop it scrolling behind.
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
  }

  // ONE handler for the pointer and the keyboard: the same picture, the same viewer. Space is
  // prevented along with Enter, or it would scroll the page underneath the dialog as it opens.
  const act = (e: Event) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return
    const target = e.target as HTMLElement
    const i = imgs.indexOf(target as HTMLImageElement)
    if (i < 0 || !target.closest('figure')) return
    e.preventDefault()
    open(i)
  }
  root.addEventListener('click', act)
  root.addEventListener('keydown', act)
}
