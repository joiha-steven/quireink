// THE CUSTOM TYPEFACE: four weights, one file input, one hidden field that holds the answer.
//
// ⚠️ DRAWN AND WIRED TO NOTHING UNTIL 2026-09-15. ADR 0054 rendered all four slots — each with
// its Upload key, its Remove key and its two state words already in the markup — and the island
// was never written. `docs/spec/07-parity-admin.md` §12 lists "custom font upload" as a shipped
// setting; what an owner had was four keys that opened no file chooser.
//
// ⚠️ IT UPLOADS, IT DOES NOT SAVE. `POST /api/files/font` stores the file and answers with a url
// and a derived family; it never touches the settings record. The face only becomes the site's
// typeface when the screen's one Save key goes, which is why everything here ends by writing the
// whole `customFont` value into the hidden `data-k-json` field and firing `input` at it: that
// event is what the Save key counts. An upload that is never saved leaves a file in the store
// and nothing else, which is the same thing the React card did.
//
// ⚠️ A FAMILY WITH NO FACES IS NO FONT AT ALL (`content/settings-type.ts`), so removing the last
// weight clears the family too. Anything else stores a name the browser can never resolve.
import { say } from './media-bridge'
import { show, type ListWords } from './list-dom'

type Face = { weight: number; url: string }
type Font = { family: string; faces: Face[] }

/** The weights, in the order the server sorts them into. Any other weight is refused server-side. */
const WEIGHTS = [400, 500, 600, 700]

/**
 * ⚠️ KEY ORDER IS PART OF THE VALUE. The Save key's diff compares the field's STRING against the
 * `data-was` the server wrote, and the server built its string from the `FontSettings` type —
 * family first, then faces, each face weight before url. Writing the same data in another order
 * makes an upload-then-undo read as a change forever.
 */
function asStored(font: Font): string {
  return JSON.stringify({
    family: font.family,
    faces: WEIGHTS.filter((w) => font.faces.some((f) => f.weight === w))
      .map((w) => {
        const face = font.faces.find((f) => f.weight === w)!
        return { weight: w, url: face.url }
      }),
  })
}

function readFont(field: HTMLInputElement): Font {
  try {
    const value = JSON.parse(field.value) as Partial<Font>
    return { family: value.family ?? '', faces: Array.isArray(value.faces) ? value.faces : [] }
  } catch {
    return { family: '', faces: [] }
  }
}

/** Write the value back, repaint the four slots, and let the Save key see it. */
function settle(box: HTMLElement, field: HTMLInputElement, font: Font, fallbackName: string): void {
  field.value = asStored(font)
  const name = box.querySelector<HTMLElement>('[data-font-family]')
  if (name) name.textContent = font.family || fallbackName
  for (const slot of box.querySelectorAll<HTMLElement>('[data-font-slot]')) {
    const weight = Number(slot.dataset.fontSlot)
    const has = font.faces.some((f) => f.weight === weight)
    show(slot.querySelector('[data-font-state="on"]'), has)
    show(slot.querySelector('[data-font-state="off"]'), !has)
    show(slot.querySelector(`[data-font-remove="${weight}"]`), has)
    const pick = slot.querySelector<HTMLButtonElement>(`[data-font-pick="${weight}"]`)
    if (pick) pick.textContent = (has ? pick.dataset.on : pick.dataset.off) ?? pick.textContent
  }
  // The recount the Save key listens for. It bubbles to `[data-settings-panels]`.
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

async function upload(file: File, weight: number, w: ListWords): Promise<Face & { family: string } | null> {
  const body = new FormData()
  body.append('file', file)
  body.append('weight', String(weight))
  const res = await fetch('/api/files/font', { method: 'POST', body }).catch(() => null)
  if (res?.status === 401) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
    return null
  }
  const json = await res?.json().catch(() => null) as
    { success?: boolean; data?: Face & { family: string } } | null
  // ⚠️ ONE SENTENCE FOR THREE REFUSALS — an unsupported extension, a file over the limit and a
  // full store all read "Upload failed". That is what the React card said too. Telling them apart
  // needs three sentences in eleven languages, which is the owner's call and not this file's.
  if (!json?.success || !json.data) { say(w.uploadFailed ?? '', 'error'); return null }
  return json.data
}

export function wireFont(screen: HTMLElement, w: ListWords): void {
  const box = screen.querySelector<HTMLElement>('[data-font-upload]')
  const field = screen.querySelector<HTMLInputElement>('[data-k="customFont"]')
  const input = box?.querySelector<HTMLInputElement>('[data-font-file]')
  if (!box || !field || !input) return

  const fallbackName = box.querySelector<HTMLElement>('[data-font-family]')?.textContent ?? ''
  let waiting = 0

  input.addEventListener('change', () => {
    const file = input.files?.[0]
    const weight = waiting
    // ⚠️ CLEARED BEFORE THE AWAIT, not after. A file input fires no `change` when the same file
    // is chosen twice, so a failed upload of `Souvenir-400.woff2` could never be retried with
    // the same file until the value was reset.
    input.value = ''
    if (!file || weight === 0) return
    void (async () => {
      const keys = [...box.querySelectorAll<HTMLButtonElement>('[data-font-pick]')]
      const faces = [...box.querySelectorAll<HTMLElement>('[data-font-remove]')]
      // Every key, not just this one: four uploads at once would each read the field and write
      // back a value missing the other three.
      for (const key of keys) key.disabled = true
      const busy = box.querySelector<HTMLButtonElement>(`[data-font-pick="${weight}"]`)
      const was = busy?.textContent ?? ''
      if (busy) busy.textContent = busy.dataset.busy ?? was
      for (const key of faces) key.hidden = true
      try {
        const made = await upload(file, weight, w)
        if (!made) return
        const font = readFont(field)
        settle(box, field, {
          // The stored family wins: all four weights share one name, and the server derives its
          // guess from a filename. Adopting it on the second upload would rename the typeface.
          family: font.family || made.family,
          faces: [...font.faces.filter((f) => f.weight !== weight), { weight, url: made.url }],
        }, fallbackName)
        say(w.uploaded ?? '')
      } finally {
        for (const key of keys) key.disabled = false
        if (busy) busy.textContent = was
        settle(box, field, readFont(field), fallbackName)
      }
    })()
  })

  box.addEventListener('click', (e) => {
    const target = e.target as HTMLElement

    const pick = target.closest<HTMLElement>('[data-font-pick]')
    if (pick) {
      waiting = Number(pick.dataset.fontPick)
      input.click()
      return
    }

    // ⚠️ NO QUESTION HERE, and that is the React card's shape kept rather than an oversight: the
    // face is not deleted until Save, the file stays in the store, and re-uploading it is one
    // click. A question before a change that has not been written yet teaches people to dismiss
    // questions.
    const drop = target.closest<HTMLElement>('[data-font-remove]')
    if (!drop) return
    const weight = Number(drop.dataset.fontRemove)
    const font = readFont(field)
    const faces = font.faces.filter((f) => f.weight !== weight)
    settle(box, field, faces.length ? { family: font.family, faces } : { family: '', faces: [] }, fallbackName)
  })
}
