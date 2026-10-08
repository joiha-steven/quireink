// THE PASSKEYS ROW of the security card (ADR 0071): add one, list them, remove one.
//
// Wired from `settings-security.ts`, which owns the card, the password box and the one `post` that
// turns a refusal into the card's own sentence. This file owns only what is new: the WebAuthn
// ceremony in the browser, and the list.
//
// ⚠️ THE PASSWORD IS ASKED FOR BOTH WAYS, adding and removing, like every change on this card. A
// stolen session that could add a passkey would keep a way in after the owner changed the password
// and signed every device out; that is the case the rule exists for.
//
// ⚠️ A PASSKEY IS NEVER THE ONLY DOOR, and nothing here pretends otherwise: removing the last one
// changes nothing about the password, the code or the recovery codes.
import type { PasskeyWire } from '@/admin-shared/wire'
import { pageStamp } from '@/admin/island/lib/page-lang'
import { ask, say } from './media-bridge'

type Words = Partial<Record<string, string>>
type Post = (path: string, body: Record<string, unknown>) => Promise<Record<string, unknown> | null>

const show = (el: Element | null, on: boolean): void => {
  if (el instanceof HTMLElement) el.hidden = !on
}

const b64 = (buf: ArrayBuffer): string => {
  let s = ''
  for (const byte of new Uint8Array(buf)) s += String.fromCharCode(byte)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const bytes = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

/** The same test the server makes (`web/passkey-routes.ts`): no browser takes an IP as an RP ID. */
const isIp = (host: string): boolean => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')

type Options = {
  challenge: string
  rp: { id: string; name: string }
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: { type: 'public-key'; alg: number }[]
  timeout: number
  attestation: AttestationConveyancePreference
  authenticatorSelection: AuthenticatorSelectionCriteria
  excludeCredentials: { type: 'public-key'; id: string; transports: AuthenticatorTransport[] }[]
}

export function wirePasskeys(o: {
  box: HTMLElement
  w: Words
  post: Post
  current: () => string
  refresh: () => void
}): { render: (list: PasskeyWire[], rpId: string) => void; arm: () => void } {
  const { box, w, post } = o
  const add = box.querySelector<HTMLButtonElement>('[data-sec-passkey-add]')
  const nameBox = box.querySelector<HTMLInputElement>('[data-sec-passkey-name-box]')
  const supported = typeof PublicKeyCredential !== 'undefined' && typeof navigator.credentials?.create === 'function'
  let host = ''

  /** The add key needs the password, a browser that can, and a name to bind to. Remove needs the password. */
  function arm(): void {
    const ready = o.current().length > 0
    if (add) add.disabled = !ready || !supported || host === '' || isIp(host)
    for (const key of box.querySelectorAll<HTMLButtonElement>('[data-sec-passkey-remove]')) key.disabled = !ready
  }

  show(box.querySelector('[data-sec-passkey-unsupported]'), !supported)

  add?.addEventListener('click', async () => {
    const out = await post('/passkeys/start', { current: o.current() }) as Options | null
    if (!out) return
    let cred: PublicKeyCredential | null = null
    try {
      cred = await navigator.credentials.create({
        publicKey: {
          challenge: bytes(out.challenge),
          rp: out.rp,
          user: { ...out.user, id: bytes(out.user.id) },
          pubKeyCredParams: out.pubKeyCredParams,
          timeout: out.timeout,
          attestation: out.attestation,
          authenticatorSelection: out.authenticatorSelection,
          excludeCredentials: out.excludeCredentials.map((c) => ({ ...c, id: bytes(c.id) })),
        },
      }) as PublicKeyCredential | null
    } catch (error) {
      // `InvalidStateError` is `excludeCredentials` doing its job: this device holds one already.
      // Anything else is the person closing the sheet, which deserves a word and not an alarm.
      const exists = error instanceof DOMException && error.name === 'InvalidStateError'
      say(exists ? (w.passkeyExists ?? '') : (w.passkeyCancelled ?? ''), exists ? 'error' : undefined)
      return
    }
    if (!cred) return
    const r = cred.response as AuthenticatorAttestationResponse
    const done = await post('/passkeys/finish', {
      current: o.current(),
      name: nameBox?.value ?? '',
      clientDataJSON: b64(r.clientDataJSON),
      attestationObject: b64(r.attestationObject),
      transports: typeof r.getTransports === 'function' ? r.getTransports() : [],
    })
    if (!done) return
    if (nameBox) nameBox.value = ''
    say(w.passkeyDone ?? '')
    o.refresh()
  })

  // Delegated, because the rows are cloned after every refresh. ASKED FIRST: the passkey stops
  // working the moment the row goes, on every device it was synced to.
  box.addEventListener('click', async (e) => {
    const key = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-sec-passkey-remove]')
    const id = key?.closest<HTMLElement>('[data-security-passkey]')?.dataset.securityPasskey
    if (!id) return
    const sure = await ask({ yes: w.askPasskeyYes, no: w.no }, w.askPasskeyTitle ?? '', w.askPasskeyBody ?? '')
    if (!sure) return
    if (!(await post('/passkeys/remove', { current: o.current(), id }))) return
    say(w.passkeyGone ?? '')
    o.refresh()
  })

  /** The list, the sentence about the address, and the one about an IP. */
  function render(list: PasskeyWire[], rpId: string): void {
    host = rpId
    const bound = box.querySelector<HTMLElement>('[data-sec-passkeys-bound]')
    if (bound) {
      bound.textContent = (bound.dataset.tpl ?? '').replace('{host}', rpId)
      bound.hidden = isIp(rpId)
    }
    show(box.querySelector('[data-sec-passkey-needs-name]'), supported && isIp(rpId))
    show(box.querySelector('[data-sec-passkeys-none]'), list.length === 0)
    const ul = box.querySelector<HTMLElement>('[data-sec-passkeys]')
    const tpl = box.querySelector<HTMLTemplateElement>('template[data-sec-passkey-row]')
    if (ul && tpl) {
      ul.replaceChildren(...list.map((p) => {
        const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement
        row.dataset.securityPasskey = p.id
        const name = row.querySelector('[data-sec-passkey-name]')
        if (name) name.textContent = p.name
        const created = row.querySelector('[data-sec-passkey-created]')
        if (created) created.textContent = pageStamp(p.createdAt)
        const when = row.querySelector('[data-sec-passkey-when]')
        if (when && p.lastUsedAt !== null) when.textContent = pageStamp(p.lastUsedAt)
        show(row.querySelector('[data-sec-passkey-used]'), p.lastUsedAt !== null)
        show(row.querySelector('[data-sec-passkey-never]'), p.lastUsedAt === null)
        return row
      }))
    }
    arm()
  }

  return { render, arm }
}
