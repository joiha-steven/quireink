// The second question the trash asks, when what is about to go is still in use: the words have
// to fit the thing. A picture leaves a broken picture where it was shown; a file leaves a broken
// link wherever it was linked, and the dialog said "a broken picture" for a PDF too.
import { afterAll, beforeAll, expect, it } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

const realFetch = globalThis.fetch
beforeAll(() => GlobalRegistrator.register())
afterAll(() => {
  globalThis.fetch = realFetch
  GlobalRegistrator.unregister()
})

it('asks about a broken link for a file and a broken picture for an image', async () => {
  const words = { purgeTitle: 'Delete {name}?', noUndo: 'No undo', inUseTitle: '{n} in use: {names}',
    inUseBody: 'PICTURE', inUseFileBody: 'LINK', yes: 'Delete', no: 'Cancel' }
  document.body.innerHTML = `<div data-screen="trash" data-trash-tab="media" data-trash-ask='${JSON.stringify(words)}'>
    <button data-trash-purge data-kind="media" data-id="/uploads/media/a.webp" data-name="a.webp"></button>
    <button data-trash-purge data-kind="files" data-id="/uploads/files/menu.pdf" data-name="menu.pdf"></button>
  </div>`
  // The first question is "delete for ever?", answered yes; the second is the one under test.
  const asked: string[] = []
  window.addEventListener('quire:confirm', (e) => {
    const { request, respond } = (e as CustomEvent<{ request: { body: string }; respond: (a: string) => void }>).detail
    e.preventDefault()
    asked.push(request.body)
    respond(request.body === 'No undo' ? 'confirm' : 'cancel')
  })
  globalThis.fetch = (async () => new Response(JSON.stringify({ success: false, error: 'in_use:1', inUse: ['x'], total: 1 }),
    { status: 409 })) as unknown as typeof fetch
  await import('./trash')

  const press = async (kind: string): Promise<string | undefined> => {
    asked.length = 0
    document.querySelector<HTMLElement>(`[data-kind="${kind}"]`)!.click()
    for (let i = 0; i < 20 && asked.length < 2; i++) await new Promise((r) => setTimeout(r, 5))
    return asked[1]
  }
  expect(await press('media')).toBe('PICTURE')
  expect(await press('files')).toBe('LINK')
})
