// Typewriter feedback for the editor: a positioned overlay caret, compositor-only block
// pulses, and a locally generated key click. Split from Editor.tsx when it passed the
// 400-line cap; the seam is clean because everything here stays OUTSIDE ProseMirror's
// document — no character wrappers, document mutations, or selection changes.
import { type Editor as TiptapEditor } from '@tiptap/react'

const typingAnimations = new WeakMap<HTMLElement, Animation>()
const TYPEWRITER_VOLUME = 0.45
let typewriterAudio: AudioContext | null = null

export function placeTypewriterCaret(view: TiptapEditor['view'], caret: HTMLElement | null): void {
  if (!caret) return
  requestAnimationFrame(() => {
    const stage = caret.parentElement
    const visible = view.hasFocus() && view.state.selection.empty
    if (!stage || !visible) {
      stage?.classList.remove('has-typewriter-caret')
      return
    }
    const cursor = view.coordsAtPos(view.state.selection.head)
    const stageRect = stage.getBoundingClientRect()
    caret.style.left = `${cursor.left - stageRect.left}px`
    caret.style.top = `${cursor.top - stageRect.top}px`
    caret.style.height = `${Math.max(16, cursor.bottom - cursor.top)}px`
    stage.classList.add('has-typewriter-caret')
  })
}

function playTypewriterSound(deleting: boolean): void {
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return
  typewriterAudio ??= new AudioContextClass()
  const context = typewriterAudio
  if (context.state === 'suspended') void context.resume()

  // A very short filtered-noise transient reads as a mechanical click instead
  // of a musical beep. 0.11 × 45% gives a restrained peak gain of 0.0495.
  const duration = deleting ? 0.032 : 0.024
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (samples.length * 0.18))
  }
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  source.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.value = deleting ? 620 : 1450
  filter.Q.value = deleting ? 0.7 : 1.1
  gain.gain.value = 0.11 * TYPEWRITER_VOLUME
  source.connect(filter).connect(gain).connect(context.destination)
  source.start()
}

export function pulseTypewriterInput(view: TiptapEditor['view'], event: InputEvent, caret: HTMLElement | null): void {
  const inputType = event.inputType
  const deleting = inputType.startsWith('delete')
  if (!deleting && !inputType.startsWith('insert')) return
  if (!event.isComposing) playTypewriterSound(deleting)
  placeTypewriterCaret(view, caret)
  if (
    document.documentElement.dataset.motion === 'off' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) return

  requestAnimationFrame(() => {
    const anchor = view.dom.ownerDocument.getSelection()?.anchorNode
    const origin = anchor?.nodeType === 1 ? (anchor as Element) : anchor?.parentElement
    const block = origin?.closest<HTMLElement>('p, h1, h2, h3, h4, h5, li, blockquote, pre')
    if (!block || !view.dom.contains(block)) return

    if (caret) {
      caret.animate(
        deleting
          ? [
              { opacity: 0.35, transform: 'translateX(-3px) scaleX(0.65)' },
              { opacity: 1, transform: 'translateX(0) scaleX(1)' },
            ]
          : [
              { opacity: 1, transform: 'translateY(1px) scaleX(1.5)' },
              { opacity: 1, transform: 'translateY(0) scaleX(1)' },
            ],
        { duration: 140, easing: 'cubic-bezier(.2,.8,.2,1)' },
      )
    }
    typingAnimations.get(block)?.cancel()
    const animation = block.animate(
      deleting
        ? [
            { opacity: 0.86, transform: 'translateX(-0.7px)' },
            { opacity: 1, transform: 'translateX(0)' },
          ]
        : [
            { opacity: 0.9, transform: 'translateY(0.6px)', textShadow: '0 0 0.3px currentColor' },
            { opacity: 1, transform: 'translateY(0)', textShadow: '0 0 0 transparent' },
          ],
      { duration: 140, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
    typingAnimations.set(block, animation)
    animation.onfinish = () => {
      if (typingAnimations.get(block) === animation) typingAnimations.delete(block)
    }
  })
}
