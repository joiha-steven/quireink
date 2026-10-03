// Issue #69, the client half: picking a favicon, app icon or author portrait in Settings sent
// nothing. The file input is drawn as `data-icon-file` with no value, the change handler asked
// `dataset.iconFile`, got '' and returned — from 2026-09-15 to the fix, with no toast and no
// request. Drawn here from the server's own markup (`iconUpload`), so the two halves are held
// to each other rather than to a copy of the attribute.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { iconUpload } from '@/web/admin/fields-pic'
import { wirePics } from './settings-pics'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

let calls: { url: string; kind: string }[]
let toasts: { message: string; kind?: string }[]
let answer: { status: number; body: unknown }

beforeEach(() => {
  calls = []
  toasts = []
  answer = { status: 201, body: { success: true, data: { url: '/uploads/files/favicon-1790310930396.png' } } }
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), kind: String((init?.body as FormData).get('kind')) })
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }) as typeof fetch
  window.addEventListener('quire:toast', (e) => toasts.push((e as CustomEvent).detail))
  document.body.innerHTML = `<div id="screen">${iconUpload({
    k: 'faviconUrl', kind: 'favicon', value: '', previewClass: '', chooseLabel: 'Choose', removeLabel: 'Remove', emptyLabel: 'None',
  })}</div>`
  wirePics(document.getElementById('screen')!, { uploaded: 'Uploaded', uploadFailed: 'Upload failed', badType: 'Not a picture type', tooLarge: 'Too large', noRoom: 'No room' })
})

/** What the browser does when the owner picks a file. */
async function pick(name: string, type: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>('[data-icon-file]')!
  Object.defineProperty(input, 'files', { value: [new File([new Uint8Array(8)], name, { type })], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0))
}

describe('picking a site icon in Settings', () => {
  it('uploads it under its kind and puts the url in the field Save sends', async () => {
    await pick('favicon.png', 'image/png')
    expect(calls).toEqual([{ url: '/api/files/upload', kind: 'favicon' }])
    expect(document.querySelector<HTMLInputElement>('input[data-k="faviconUrl"]')!.value).toBe('/uploads/files/favicon-1790310930396.png')
    expect(toasts.at(-1)?.message).toBe('Uploaded')
  })

  it('says why the server refused, not just "Upload failed"', async () => {
    answer = { status: 415, body: { success: false, error: 'unsupported_type' } }
    await pick('notes.txt', 'text/plain')
    expect(toasts.at(-1)?.message).toBe('Not a picture type')
    expect(toasts.at(-1)?.kind).toBe('error')
  })
})
