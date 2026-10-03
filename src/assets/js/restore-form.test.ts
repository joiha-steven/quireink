// The setup page's backup form against a real DOM (G4): under the threshold it is the plain form,
// over it the file goes up in parts and is loaded with one last call, and a dropped part is sent
// again. The server half is `web/setup-restore-parts.test.ts`; the bundle is `setup-restore.ts`.
import { beforeEach, describe, expect, it } from 'bun:test'
import { page, stubFetch, useDom } from './test-dom'

useDom()

const FORM = `<form method="post" action="/setup/restore" data-setup-restore data-chunk-above="10" data-part-bytes="4"
 data-sending="Sending {percent}%" data-loading="Loading" data-retrying="Again" data-stopped="Stopped">
<input type="hidden" name="token" value="the-code"><input name="identity"><input name="passphrase" value="pass words">
<input id="archive" name="archive" type="file"><button type="submit">Go</button>
<p data-restore-status hidden></p></form>`

/** The form, a file of `size` bytes in its input, and the island wired to it. */
async function ready(size: number): Promise<{ form: HTMLFormElement; went: string[] }> {
  page(FORM)
  const input = document.querySelector<HTMLInputElement>('#archive')!
  Object.defineProperty(input, 'files', { value: [new File([new Uint8Array(size).fill(7)], 'quire-x.tar.gz')] })
  const went: string[] = []
  const { setupRestore } = await import('./restore-form')
  setupRestore((url) => went.push(url))
  return { form: document.querySelector('form')!, went }
}

const submit = (form: HTMLFormElement): boolean => form.dispatchEvent(new Event('submit', { cancelable: true }))
const settle = () => new Promise((r) => setTimeout(r, 20))

beforeEach(() => { try { sessionStorage.clear() } catch { /* none */ } })

describe('the backup form', () => {
  it('posts itself, untouched, at or under the threshold', async () => {
    const calls = stubFetch(() => ({ success: true, data: {} }))
    const { form } = await ready(10)
    expect(submit(form)).toBe(true)
    expect(calls).toEqual([])
  })

  it('past it, sends the file in parts with the code as a bearer token, then loads them and moves on', async () => {
    const seen: { url: string; method: string; auth: string; size: number }[] = []
    stubFetch(async (url, init) => {
      const size = init?.body instanceof Blob ? init.body.size : 0
      seen.push({ url, method: init?.method ?? 'GET', auth: new Headers(init?.headers).get('authorization') ?? '', size })
      if (init?.method === 'POST' && url.endsWith('/parts')) return { success: true, data: { id: 'up1', partBytes: 4 } }
      if (url.endsWith('/load')) return { success: true, data: { location: '/login' } }
      return { success: true, data: {} }
    })
    const { form, went } = await ready(11)
    expect(submit(form)).toBe(false)
    await settle()
    expect(seen.map((c) => `${c.method} ${c.url} ${c.size}`)).toEqual([
      'POST /setup/restore/parts 0',
      'PUT /setup/restore/parts/up1/1 4', 'PUT /setup/restore/parts/up1/2 4', 'PUT /setup/restore/parts/up1/3 3',
      'POST /setup/restore/parts/up1/load 0',
    ])
    expect(seen.every((c) => c.auth === 'Bearer the-code')).toBe(true)
    expect(went).toEqual(['/login'])
  })

  it('sends a part again when the connection drops under it, and says so meanwhile', async () => {
    const puts: string[] = []
    let dropped = false
    stubFetch((url, init) => {
      if (init?.method === 'POST' && url.endsWith('/parts')) return { success: true, data: { id: 'up2', partBytes: 8 } }
      if (init?.method === 'PUT') {
        puts.push(url)
        if (url.endsWith('/2') && !dropped) { dropped = true; return Promise.reject(new TypeError('network')) }
      }
      if (url.endsWith('/load')) return { success: true, data: { location: '/login' } }
      return { success: true, data: {} }
    })
    const { form, went } = await ready(11)
    submit(form)
    await settle()
    expect(document.querySelector('[data-restore-status]')?.textContent).toBe('Again')
    // The island waits 2 s before the second try.
    await new Promise((r) => setTimeout(r, 2200))
    expect(puts).toEqual(['/setup/restore/parts/up2/1', '/setup/restore/parts/up2/2', '/setup/restore/parts/up2/2'])
    expect(went).toEqual(['/login'])
  }, 10_000)

  it('shows the blog\'s refusal and gives the button back', async () => {
    stubFetch((url, init) => (init?.method === 'POST' && url.endsWith('/parts')
      ? new Response(JSON.stringify({ success: false, code: 'not-empty', error: 'This blog is not empty.' }), { status: 409 })
      : { success: true, data: {} }))
    const { form, went } = await ready(11)
    submit(form)
    await settle()
    expect(document.querySelector('.login-error')?.textContent).toBe('This blog is not empty.')
    expect(document.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false)
    expect(went).toEqual([])
  })
})
