// The first setup screen's backup form, for a file too large for one request (G4).
//
// A CONVENIENCE over a real form, like everything on these pages: at or under the size the server
// names (`data-chunk-above`) the form posts itself, exactly as it does with this file blocked. Past
// it — where Cloudflare would refuse the request at 100 MB before the blog saw a byte — the file
// goes up in parts through `/setup/restore/parts` and is loaded with one last call. The protocol is
// `docs/backups.md`; a program uses the same routes through `server/restore-push.ts`.
//
// RESUMABLE: the upload's id is kept in this tab's session storage under the file's name, size and
// date, so choosing the same file again after a dropped connection or a reload sends only the parts
// the blog does not have yet.

type Answer<T> = { success: true; data: T } | { success: false; error?: string; code?: string }

/** Wire the form, when this page has one. `setup-restore.ts` is the bundle that calls it. */
export function setupRestore(go: (url: string) => void = (url) => location.assign(url)): void {
  const form = document.querySelector<HTMLFormElement>('form[data-setup-restore]')
  if (form) wire(form, go)
}

function wire(form: HTMLFormElement, go: (url: string) => void): void {
  const d = form.dataset
  const above = Number(d.chunkAbove ?? Infinity)
  const field = (name: string): string => (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? ''
  const status = form.querySelector<HTMLElement>('[data-restore-status]')
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  const say = (text: string): void => {
    if (!status) return
    status.textContent = text
    status.hidden = false
  }
  const fail = (text: string): void => {
    let box = form.parentElement?.querySelector<HTMLElement>('.login-error') ?? null
    if (!box) {
      box = document.createElement('p')
      box.className = 'login-error'
      box.setAttribute('role', 'alert')
      form.before(box)
    }
    box.textContent = text
    if (status) status.hidden = true
    if (button) button.disabled = false
  }

  form.addEventListener('submit', (event) => {
    const file = (form.elements.namedItem('archive') as HTMLInputElement | null)?.files?.[0]
    if (!file || file.size <= above) return
    event.preventDefault()
    if (button) button.disabled = true
    send(file).catch(() => fail(d.stopped ?? ''))
  })

  async function call<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: Answer<T> }> {
    const res = await fetch(`/setup/restore/parts${path}`, {
      ...init, headers: { authorization: `Bearer ${field('token')}`, ...(init.headers as Record<string, string> | undefined) },
    })
    return { status: res.status, body: (await res.json().catch(() => ({ success: false }))) as Answer<T> }
  }

  async function send(file: File): Promise<void> {
    const memo = `quire-restore:${file.name}:${file.size}:${file.lastModified}`
    let id = ''
    try { id = sessionStorage.getItem(memo) ?? '' } catch { /* storage off: no resume, nothing else lost */ }
    let partBytes = Number(d.partBytes)
    const held = new Map<number, number>()
    if (id) {
      const known = await call<{ size: number; parts: { part: number; size: number }[] }>(`/${id}`)
      if (known.body.success && known.body.data.size === file.size) {
        for (const p of known.body.data.parts) held.set(p.part, p.size)
        partBytes = known.body.data.parts[0]?.size ?? partBytes
      } else id = ''
    }
    if (!id) {
      const begun = await call<{ id: string; partBytes: number }>('', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ size: file.size }),
      })
      if (!begun.body.success) return fail(begun.body.error ?? '')
      id = begun.body.data.id
      partBytes = begun.body.data.partBytes
      try { sessionStorage.setItem(memo, id) } catch { /* as above */ }
    }

    const count = Math.ceil(file.size / partBytes)
    for (let part = 1; part <= count; part++) {
      const slice = file.slice((part - 1) * partBytes, Math.min(part * partBytes, file.size))
      say((d.sending ?? '').replace('{percent}', String(Math.floor(((part - 1) * partBytes * 100) / file.size))))
      if (held.get(part) === slice.size) continue
      for (let attempt = 1; ; attempt++) {
        const put = await call(`/${id}/${part}`, { method: 'PUT', body: slice }).catch(() => null)
        if (put?.body.success) break
        // A refusal is final (a wrong code, a blog that filled up meanwhile); a dropped connection
        // or a server error is worth four more tries, each waiting longer.
        if (put && put.status < 500) return fail(put.body.success ? '' : put.body.error ?? '')
        if (attempt >= 5) return fail(d.stopped ?? '')
        say(d.retrying ?? '')
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      }
    }

    say(d.loading ?? '')
    const loaded = await call<{ location: string }>(`/${id}/load`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: field('identity'), passphrase: field('passphrase') }),
    })
    if (!loaded.body.success) {
      // Kept for another try with the right key; forgotten when the upload itself is the problem.
      if (loaded.body.code === 'incomplete' || loaded.body.code === 'unknown') {
        try { sessionStorage.removeItem(memo) } catch { /* as above */ }
      }
      return fail(loaded.body.error ?? '')
    }
    try { sessionStorage.removeItem(memo) } catch { /* as above */ }
    go(loaded.body.data.location)
  }
}
