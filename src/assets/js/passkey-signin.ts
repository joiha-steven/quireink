// Signing in with a passkey, from the sign-in page (ADR 0071).
//
// A CONVENIENCE, like everything else in `login.ts`, and more so: the door it opens is a second
// one. The password form beside it is a real form that works with this file blocked, and a
// browser with no WebAuthn never sees the button at all (the server ships it `hidden`).
//
// TWO WAYS IN, ONE CEREMONY:
//   - conditional UI. Where the browser can offer a passkey in the username box's own autofill,
//     a request is started on load and waits there; picking the passkey from the list finishes it.
//     No button needed, which is the fast path at its fastest.
//   - the button. For a browser without conditional UI, and for a security key, which no
//     autofill lists. Pressing it ends the waiting request first: a page may hold only one.
//
// What goes to the server is base64url of the four byte strings the authenticator returned. The
// server checks everything; this file only carries.

const b64 = (buf: ArrayBuffer | null): string | null => {
  if (buf === null) return null
  let s = ''
  for (const byte of new Uint8Array(buf)) s += String.fromCharCode(byte)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const bytes = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

const post = (path: string, body: unknown): Promise<Response> =>
  fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export function passkeySignIn(): void {
  const door = document.querySelector<HTMLElement>('[data-passkey]')
  const button = door?.querySelector<HTMLButtonElement>('[data-passkey-go]')
  const error = door?.querySelector<HTMLElement>('[data-passkey-error]')
  if (!door || !button || !error || typeof PublicKeyCredential === 'undefined' || !navigator.credentials) return
  door.hidden = false

  let waiting: AbortController | null = null

  const say = (text: string): void => {
    error.textContent = text
    error.hidden = text === ''
  }

  /**
   * One ceremony. `conditional` decides only HOW the browser asks: in the autofill, or in its own
   * sheet. A cancelled sheet says nothing (the person chose not to); a failure the server refused
   * says the one sentence the server's answer allows.
   */
  async function run(conditional: boolean): Promise<void> {
    waiting?.abort()
    const ctl = new AbortController()
    waiting = ctl
    const res = await post('/api/auth/passkey/options', {}).catch(() => null)
    const opts = res?.ok ? (await res.json()).data as { challenge: string; rpId: string; timeout: number } : null
    if (!opts) { if (!conditional) say(door!.dataset.failed ?? ''); return }
    let cred: PublicKeyCredential | null = null
    try {
      cred = await navigator.credentials.get({
        mediation: conditional ? 'conditional' : 'optional',
        signal: ctl.signal,
        publicKey: { challenge: bytes(opts.challenge), rpId: opts.rpId, timeout: opts.timeout, userVerification: 'required', allowCredentials: [] },
      }) as PublicKeyCredential | null
    } catch {
      // Aborted by the button, dismissed by the person, or no passkey here: none is a failure of
      // the blog's, so none is reported as one.
      return
    }
    if (!cred) return
    const r = cred.response as AuthenticatorAssertionResponse
    button!.disabled = true
    const done = await post('/api/auth/passkey', {
      id: cred.id,
      clientDataJSON: b64(r.clientDataJSON),
      authenticatorData: b64(r.authenticatorData),
      signature: b64(r.signature),
      userHandle: b64(r.userHandle),
      next: door!.dataset.next,
    }).catch(() => null)
    const body = await done?.json().catch(() => null) as { status?: string; location?: string; error?: string } | null
    if (done?.ok && body?.status === 'ok') { location.assign(body.location || '/admin'); return }
    button!.disabled = false
    say(body?.error || door!.dataset.failed || '')
  }

  button.addEventListener('click', () => { say(''); void run(false) })

  // Conditional UI where the browser has it. Asked, never assumed: a browser that cannot do it
  // rejects `mediation: 'conditional'` with an error, which would read as a failed sign-in.
  void PublicKeyCredential.isConditionalMediationAvailable?.().then((yes) => { if (yes) void run(true) }).catch(() => undefined)
}
