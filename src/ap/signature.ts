// HTTP SIGNATURES, both directions. The fediverse's front door lock.
//
// ADR 0059. Every server out there refuses an unsigned POST to its inbox, and most now refuse
// an unsigned GET of an actor too ("authorized fetch"), so this is not an optional hardening
// step — it is the protocol. It is also the part that fails SILENTLY: a signature built over
// the wrong header list is not an error anywhere, it is a delivery that is accepted with a 202
// and dropped, or an actor that simply never appears in anybody's search.
//
// So this file is written against the draft-cavage specification rather than against one
// implementation's habits, and its test signs with one key and verifies with the other half —
// the only honest check available without another server to talk to.
//
// ⚠️ THE PRIVATE KEY ARRIVES AS AN ARGUMENT AND IS NEVER READ FROM ANYWHERE HERE. Nothing in
// this module touches the database or the settings: it is given a PEM, or it is given a public
// one to check against. That is what keeps the one secret in this feature out of every code
// path that does not need it.

import { createHash, createSign, createVerify } from 'node:crypto'

/** The header list every implementation in the wild agrees on for a POST. */
const POST_HEADERS = ['(request-target)', 'host', 'date', 'digest'] as const
/** ...and for a GET, which has no body and therefore no digest. */
const GET_HEADERS = ['(request-target)', 'host', 'date'] as const

/**
 * How far out of step two independent servers' clocks may be.
 *
 * ⚠️ AN HOUR, WHICH IS WIDER THAN IT LOOKS AND IS THE RIGHT TRADE. The alternative failure is
 * the one that cannot be diagnosed from either end: a server whose clock drifts by two minutes
 * has every delivery refused, and what its operator sees is "the blog stopped federating".
 *
 * A replay inside the window buys an attacker nothing here, and that is a property of the
 * INBOX rather than of this file: `Follow` recorded twice is one follower, `Undo` twice is none,
 * and neither is destructive. A verb whose repetition mattered would need a nonce store, and
 * v1 has no such verb.
 */
const SKEW_MS = 60 * 60 * 1000

/** `SHA-256=<base64>` over the exact bytes sent, which is what binds a signature to a body. */
export const digestOf = (body: string): string =>
  `SHA-256=${createHash('sha256').update(body, 'utf8').digest('base64')}`

/**
 * The string both ends sign: one line per named header, lower-cased, in the order named.
 *
 * `(request-target)` is the method and the PATH — not the whole URL, and not the host again.
 * Getting that one line wrong is the single most common reason a delivery is dropped in
 * silence, which is why it is built here and read back by the verifier from the same function.
 */
export function signingString(
  names: readonly string[],
  method: string,
  path: string,
  headers: Record<string, string>,
): string {
  return names
    .map((name) => (name === '(request-target)'
      ? `(request-target): ${method.toLowerCase()} ${path}`
      : `${name}: ${headers[name] ?? ''}`))
    .join('\n')
}

export type SignedRequest = {
  headers: Record<string, string>
  body?: string
}

/**
 * The headers for an outgoing request, signed.
 *
 * `keyId` is the actor's key URL (`https://blog/ap/actor#main-key`), which is how the far end
 * knows whose public key to fetch. `date` is in the IMF-fixdate form HTTP wants — `toUTCString`
 * produces exactly that, and a locale-formatted date here is a refusal everywhere.
 */
export function signRequest(args: {
  method: 'GET' | 'POST'
  url: string
  body?: string
  keyId: string
  privateKeyPem: string
  now?: Date
}): SignedRequest {
  const target = new URL(args.url)
  const path = target.pathname + target.search
  const date = (args.now ?? new Date()).toUTCString()
  const headers: Record<string, string> = { host: target.host, date }
  const names = args.method === 'POST' ? [...POST_HEADERS] : [...GET_HEADERS]
  if (args.method === 'POST') headers.digest = digestOf(args.body ?? '')

  const signature = createSign('sha256')
    .update(signingString(names, args.method, path, headers))
    .sign(args.privateKeyPem, 'base64')

  return {
    headers: {
      ...headers,
      signature: `keyId="${args.keyId}",algorithm="rsa-sha256",`
        + `headers="${names.join(' ')}",signature="${signature}"`,
      // Both, because the fediverse is split on which one it looks at, and a document served or
      // sent under the wrong media type is a document the far end declines to parse.
      accept: 'application/activity+json, application/ld+json',
      ...(args.method === 'POST' ? { 'content-type': 'application/activity+json' } : {}),
    },
    body: args.body,
  }
}

/** The pieces of a `Signature:` header, or null when it is not one. */
export type ParsedSignature = {
  keyId: string
  algorithm: string
  headers: string[]
  signature: string
}

/**
 * Read a `Signature:` header.
 *
 * ⚠️ IT DOES NOT SPLIT ON COMMAS. The base64 signature can contain anything but `"`, and a
 * naive `split(',')` cuts a valid signature in half often enough that it works in testing and
 * fails against a quarter of the fediverse. Each `key="value"` pair is matched whole instead.
 */
export function parseSignature(header: string | undefined): ParsedSignature | null {
  if (!header) return null
  const parts: Record<string, string> = {}
  for (const m of header.matchAll(/([A-Za-z]+)\s*=\s*"([^"]*)"/g)) {
    const key = m[1]!.toLowerCase()
    if (!(key in parts)) parts[key] = m[2]!
  }
  const { keyid, algorithm, headers, signature } = parts
  if (!keyid || !signature) return null
  return {
    keyId: keyid,
    // Absent means rsa-sha256 by the draft's own default, and several implementations omit it.
    algorithm: (algorithm ?? 'rsa-sha256').toLowerCase(),
    headers: (headers ?? 'date').split(/\s+/).filter(Boolean),
    signature,
  }
}

/** Why a request was refused. The inbox logs it; nothing is told to the sender but the status. */
export type Refusal =
  | 'no-signature' | 'bad-algorithm' | 'missing-header' | 'stale-date' | 'bad-digest' | 'bad-signature'

/**
 * Check an incoming request against a public key the caller has already fetched.
 *
 * ⚠️ THE FETCH IS THE CALLER'S, and that separation is the point: verifying is pure arithmetic
 * over strings and can be tested exhaustively, where fetching the sender's actor is a network
 * call with its own guard, its own cache and its own failure modes. A verifier that fetched
 * could not be tested without either a network or a mock of one.
 */
export function verifySignature(args: {
  method: string
  path: string
  headers: Record<string, string>
  body: string
  publicKeyPem: string
  now?: Date
}): Refusal | null {
  const parsed = parseSignature(args.headers.signature ?? args.headers.authorization)
  if (!parsed) return 'no-signature'
  // rsa-sha256, or the `hs2019` spelling that means the same thing in practice for an RSA key.
  if (!['rsa-sha256', 'hs2019'].includes(parsed.algorithm)) return 'bad-algorithm'

  // ⚠️ THE DATE AND THE TARGET MUST BE IN THE LIST, or the signature covers nothing that ties
  // it to this moment or this URL — a valid signature over `host` alone can be lifted from one
  // request and replayed against every other route on this server, forever.
  if (!parsed.headers.includes('date')) return 'missing-header'
  if (!parsed.headers.includes('(request-target)')) return 'missing-header'
  for (const name of parsed.headers) {
    if (name !== '(request-target)' && args.headers[name] === undefined) return 'missing-header'
  }

  const sent = Date.parse(args.headers.date ?? '')
  if (!Number.isFinite(sent)) return 'stale-date'
  if (Math.abs((args.now ?? new Date()).getTime() - sent) > SKEW_MS) return 'stale-date'

  // ...and when the body is covered, it has to BE the body. A digest that is signed but never
  // compared is a signature over a value the sender chose and nobody checked.
  if (parsed.headers.includes('digest')) {
    if ((args.headers.digest ?? '') !== digestOf(args.body)) return 'bad-digest'
  }

  const ok = createVerify('sha256')
    .update(signingString(parsed.headers, args.method, args.path, args.headers))
    .verify(args.publicKeyPem, parsed.signature, 'base64')
  return ok ? null : 'bad-signature'
}
