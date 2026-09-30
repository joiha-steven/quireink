// The description box in the library's full-size view (2026-09-30).
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { altEditor } from './lib/media-alt'

beforeAll(() => GlobalRegistrator.register())
afterAll(() => GlobalRegistrator.unregister())

const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await Promise.resolve() }

describe('the description box', () => {
  it('opens on the stored description, saves the typed one, and hands it to the tile', async () => {
    const tile = document.createElement('figure')
    tile.dataset.alt = 'old words'
    let sent: unknown = null
    globalThis.fetch = ((_: unknown, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body))
      return Promise.resolve(new Response('{"success":true,"data":{"ok":true}}'))
    }) as typeof fetch
    const said: string[] = []
    window.addEventListener('quire:toast', (e: Event) => { said.push((e as CustomEvent<{ message: string }>).detail.message) })
    const box = altEditor(tile, '/media/a.png', { altLabel: 'Description', save: 'Save', altSaved: 'Saved' })
    const input = box.querySelector('input')!
    expect(input.value).toBe('old words')
    expect(box.querySelector('label')?.textContent).toContain('Description')
    input.value = '  new   words '
    box.querySelector('button')!.click()
    await settle()
    expect(sent).toEqual({ url: '/media/a.png', alt: '  new   words ' })
    expect(tile.dataset.alt).toBe('new words')
    expect(said.at(-1)).toBe('Saved')
  })

  it('keeps the tile as it was when the save failed', async () => {
    const tile = document.createElement('figure')
    tile.dataset.alt = 'kept'
    globalThis.fetch = (() => Promise.resolve(new Response('{}', { status: 500 }))) as unknown as typeof fetch
    const box = altEditor(tile, '/media/a.png', { save: 'Save', saveFailed: 'Failed' })
    box.querySelector('input')!.value = 'lost'
    box.querySelector('button')!.click()
    await settle()
    expect(tile.dataset.alt).toBe('kept')
  })
})
