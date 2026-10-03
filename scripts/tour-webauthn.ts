// A passkey for the tour: Chrome's virtual authenticator, over the DevTools protocol (ADR 0071).
//
// The tour serves the blog at `http://127.0.0.1:<port>`, and no browser makes a passkey on an IP
// address: an RP ID must be a name. So the passkey flows open the SAME server as
// `http://localhost:<port>` — `localhost` is a secure context and a valid RP ID, and the server
// falls back to the request's host when the blog's address is an IP (`rpIdFor`). The session
// cookie is set for that origin too, or removed from it when a flow needs to arrive signed out.
//
// The authenticator is CTAP 2.1, internal (a platform passkey), with a resident key and user
// verification that always succeeds and presence simulated, so a ceremony completes with no person
// at a fingerprint reader. Added once per tour; the passkeys it holds last as long as the browser.

type Send = (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>

const COOKIE = '__Host-quire_session'

/**
 * `signedIn` sets the owner's cookie on the localhost origin, `false` clears it, left out keeps it.
 * Answers the origin, or why not.
 *
 * `noAutofill` makes the NEXT pages report no conditional UI, so the sign-in page falls back to
 * its button. Without it the virtual authenticator answers the autofill's request by itself the
 * moment `/login` loads (it simulates the person picking the passkey), which is the conditional
 * path proven, and leaves nothing for the button to do.
 */
export function passkeyHost(send: Send, base: string): (signedIn?: boolean, opts?: { noAutofill?: boolean }) => Promise<{ host: string } | { skip: string }> {
  let ready: { host: string } | { skip: string } | null = null
  let script = ''
  return async (signedIn, opts = {}) => {
    if (script) {
      await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script })
      script = ''
    }
    if (opts.noAutofill) {
      const added = await send('Page.addScriptToEvaluateOnNewDocument', {
        source: 'if (window.PublicKeyCredential) PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(false)',
      })
      script = typeof added.identifier === 'string' ? added.identifier : ''
    }
    if (ready === null) {
      const url = new URL(base)
      if (url.hostname === '127.0.0.1') url.hostname = 'localhost'
      await send('WebAuthn.enable', { enableUI: false })
      const made = await send('WebAuthn.addVirtualAuthenticator', {
        options: {
          protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal',
          hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true,
        },
      })
      ready = typeof made.authenticatorId === 'string'
        ? { host: url.origin }
        : { skip: 'this browser has no virtual authenticator over CDP (WebAuthn.addVirtualAuthenticator answered nothing)' }
    }
    if ('skip' in ready || signedIn === undefined) return ready
    if (signedIn && process.env.QUIRE_SESSION) {
      await send('Network.setCookie', {
        name: COOKIE, value: process.env.QUIRE_SESSION, url: ready.host, path: '/', httpOnly: true, secure: true, sameSite: 'Lax',
      })
    } else {
      // By domain and path, not `url`: Chrome matched nothing by an http URL for a Secure cookie.
      await send('Network.deleteCookies', { name: COOKIE, domain: new URL(ready.host).hostname, path: '/' })
    }
    return ready
  }
}
