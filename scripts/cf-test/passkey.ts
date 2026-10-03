// Passkeys inside workerd (ADR 0071), for `bun run test:cf`.
//
// The verifier is Web Crypto and nothing else, and the claim that both runtimes have it is only
// worth what a run on the second one says. So this asks workerd what Bun's tests cannot: whether
// the FROZEN vectors (one per algorithm, made on Bun, and one Chrome made) verify here byte for
// byte, whether Ed25519 imports under whichever name this workerd answers to, and whether a passkey
// stored in the Durable Object's SQLite comes back as bytes the verifier still accepts.
import { openDatabases } from '@/store/db'
import { verifyAssertion, verifyRegistration } from '@/auth/webauthn'
import { addPasskey, passkeyById } from '@/auth/passkeys'
import { CHROME, REGISTER_CHALLENGE, RP_ID, SIGN_IN_CHALLENGE, VECTORS } from '@/test/passkey-vectors'
import { assert, attest, fromB64url, softKey } from '@/test/webauthn'
import { createUser } from '@/auth/users'

export async function passkeysVerifyHere(): Promise<void> {
  for (const [name, v] of Object.entries(VECTORS)) {
    const reg = await verifyRegistration({
      clientDataJSON: fromB64url(v.attClientData), attestationObject: fromB64url(v.attestationObject),
      challenge: REGISTER_CHALLENGE, rpId: RP_ID,
    })
    if (!reg.ok) throw new Error(`${name}: the frozen registration was refused (${reg.reason})`)
    if (reg.credential.id !== v.credentialId) throw new Error(`${name}: the credential id came out different`)
    const use = await verifyAssertion({
      clientDataJSON: fromB64url(v.getClientData), authenticatorData: fromB64url(v.authenticatorData),
      signature: fromB64url(v.signature), challenge: SIGN_IN_CHALLENGE, rpId: RP_ID,
      publicKey: reg.credential.publicKey, storedCount: 0,
    })
    if (!use.ok || use.signCount !== v.signCount) throw new Error(`${name}: the frozen assertion did not verify (${use.ok ? use.signCount : use.reason})`)
    const tampered = fromB64url(v.signature)
    tampered[tampered.length - 1]! ^= 1
    const bad = await verifyAssertion({
      clientDataJSON: fromB64url(v.getClientData), authenticatorData: fromB64url(v.authenticatorData),
      signature: tampered, challenge: SIGN_IN_CHALLENGE, rpId: RP_ID, publicKey: reg.credential.publicKey, storedCount: 0,
    })
    if (bad.ok) throw new Error(`${name}: a flipped bit of signature verified`)
  }

  // And the one Chrome made, which no code of ours encoded.
  const chrome = await verifyRegistration({
    clientDataJSON: fromB64url(CHROME.attClientData), attestationObject: fromB64url(CHROME.attestationObject),
    challenge: CHROME.registerChallenge, rpId: CHROME.rpId,
  })
  if (!chrome.ok) throw new Error(`Chrome's registration was refused (${chrome.reason})`)
  const chromeUse = await verifyAssertion({
    clientDataJSON: fromB64url(CHROME.getClientData), authenticatorData: fromB64url(CHROME.authenticatorData),
    signature: fromB64url(CHROME.signature), challenge: CHROME.signInChallenge, rpId: CHROME.rpId,
    publicKey: chrome.credential.publicKey, storedCount: 0,
  })
  if (!chromeUse.ok) throw new Error(`Chrome's assertion did not verify (${chromeUse.reason})`)

  // A key made HERE, stored in the object's SQLite, read back, and used: the blob must survive the
  // ArrayBuffer round trip `cf/db.ts` performs, and the counter must be judged on what came back.
  openDatabases('./data')
  const user = await createUser({ username: 'owner', email: 'o@blog.test', password: 'a long enough passphrase' })
  const key = await softKey(-7)
  const ceremony = { rpId: 'blog.test', origin: 'https://blog.test', challenge: 'cf-register' }
  const reg = await verifyRegistration({ ...(await attest(key, ceremony)), challenge: 'cf-register', rpId: 'blog.test' })
  if (!reg.ok) throw new Error(`a key made in workerd was refused (${reg.reason})`)
  addPasskey({ userId: user.id, id: reg.credential.id, publicKey: reg.credential.publicKey, signCount: 0, transports: ['internal'], name: 'Worker' })
  const stored = passkeyById(reg.credential.id)
  if (!stored || !(stored.publicKey instanceof Uint8Array)) throw new Error('the stored key did not come back as bytes')
  const a = await assert(key, { ...ceremony, challenge: 'cf-sign-in', signCount: 2 })
  const ok = await verifyAssertion({ ...a, challenge: 'cf-sign-in', rpId: 'blog.test', publicKey: stored.publicKey, storedCount: stored.signCount })
  if (!ok.ok) throw new Error(`the stored key did not verify its own signature (${ok.reason})`)
  const clone = await verifyAssertion({ ...a, challenge: 'cf-sign-in', rpId: 'blog.test', publicKey: stored.publicKey, storedCount: 2 })
  if (clone.ok || clone.reason !== 'counter') throw new Error('a counter that did not go up was accepted')
}
