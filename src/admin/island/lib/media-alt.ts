// A picture's description, written by hand in the library's full-size view (2026-09-30).
//
// The library could not show or change a description: the AI button was the only way one got
// written, and a wrong one stayed wrong. The box sits under the picture in the zoom dialog,
// because that is where somebody is looking at what the words have to describe.
//
// The tile keeps the answer in `data-alt`, the attribute the picker hands the editor as a
// chosen picture's default alt, so a description saved here is the one the next insert uses.
import { CONTROL, buttonClass } from '@/admin-shared/kit'
import { say, type Words } from './media-bridge'

export function altEditor(tile: HTMLElement | null, url: string, w: Words): HTMLElement {
  const box = document.createElement('div')
  box.className = 'flex w-full max-w-xl flex-col gap-1.5'
  box.dataset.mediaAlt = ''
  // Typing and clicking in here must not reach the dialog, whose own click closes it.
  box.addEventListener('click', (e) => e.stopPropagation())

  // The input inside its label names it with no id to keep unique.
  const label = document.createElement('label')
  label.className = 'flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium text-white'
  label.textContent = w.altLabel ?? ''
  const row = document.createElement('div')
  row.className = 'flex items-end gap-2'
  const input = document.createElement('input')
  input.className = `${CONTROL} min-w-0 flex-1`
  input.value = tile?.dataset.alt ?? ''
  input.maxLength = 500
  label.append(input)
  const save = document.createElement('button')
  save.type = 'button'
  save.className = buttonClass('primary', 'md')
  save.textContent = w.save ?? ''

  const send = async (): Promise<void> => {
    save.disabled = true
    const res = await fetch('/api/media/alt', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, alt: input.value }),
    }).catch(() => null)
    save.disabled = false
    if (!res?.ok) { say(w.saveFailed ?? '', 'error'); return }
    const alt = input.value.replace(/\s+/g, ' ').trim()
    if (tile) { if (alt) tile.dataset.alt = alt; else delete tile.dataset.alt }
    say(w.altSaved ?? '')
  }
  save.addEventListener('click', () => void send())
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void send() } })

  row.append(label, save)
  box.append(row)
  return box
}
