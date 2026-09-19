// TALKING TO OTHER SERVERS: fetching the actor behind a signature, and handing over what is owed.
//
// ADR 0059. The only file here that touches the network. Everything it fetches goes through
// `safeFetch` — the same SSRF guard, manual redirect re-validation and 15-second budget the
// webmention verifier uses — because every URL it dials was chosen by a stranger.

import { safeFetch, readTextCapped } from '@/server/safe-fetch'
import { signAs } from '@/ap/keys'
import { delivered, due, failed, type Delivery } from '@/ap/store'

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

/** An actor document is a few kilobytes. A megabyte of it is somebody being interesting. */
const MAX_ACTOR_BYTES = 256_000

export type RemoteActor = {
  id: string
  inbox: string
  sharedInbox: string | null
  publicKeyPem: string
}

/**
 * Public keys already fetched, for a while.
 *
 * ⚠️ WITHOUT THIS, THE INBOX IS A LEVER. Verifying a signature means fetching the signer's
 * actor, and the signer names the URL — so an unauthenticated POST to this blog can make it
 * fetch any address a stranger likes, as often as they send. The cache turns a flood into one
 * request per key per hour; the rate limit on the route is the other half.
 *
 * In memory, per process, and deliberately not a table: a key that has to be re-fetched after a
 * restart costs one request, and a key cached in a database is a key that outlives its rotation.
 */
const keyCache = new Map<string, { actor: RemoteActor; at: number }>()
const KEY_TTL_MS = 60 * 60 * 1000

export const forgetRemoteActors = (): void => { keyCache.clear() }

/**
 * The network, replaceable.
 *
 * ⚠️ A TEST SEAM, and it exists because the alternative is worse. The inbox is a ROUTE: it is
 * handed a request by Hono and can be given nothing else, so a test of "a signed Follow is
 * recorded and answered" either reaches the internet or does not run. `resetLimits` and
 * `resetSecretCache` are the same shape for the same reason.
 *
 * Every function here still takes an explicit fetcher, and that is what the sweeps use; this is
 * only the default those arguments fall back to.
 */
let fetcher: Fetcher = safeFetch
export const setApFetcher = (f: Fetcher | null): void => { fetcher = f ?? safeFetch }

/** Read the fields this blog needs out of somebody else's actor document. */
export function readActor(json: unknown): RemoteActor | null {
  const o = json as Record<string, unknown> | null
  if (!o || typeof o.id !== 'string') return null
  const key = o.publicKey as { publicKeyPem?: unknown } | undefined
  const endpoints = o.endpoints as { sharedInbox?: unknown } | undefined
  const inbox = typeof o.inbox === 'string' ? o.inbox : ''
  if (!inbox || typeof key?.publicKeyPem !== 'string') return null
  return {
    id: o.id,
    inbox,
    sharedInbox: typeof endpoints?.sharedInbox === 'string' ? endpoints.sharedInbox : null,
    publicKeyPem: key.publicKeyPem,
  }
}

/**
 * Fetch the actor at a URL, cached.
 *
 * ⚠️ THE GET IS SIGNED. Most of the fediverse now runs "authorized fetch", where an unsigned
 * request for an actor is refused — so an unsigned fetch here means this blog can verify
 * nobody's signature and accept nobody's follow, on the servers that matter most.
 *
 * A `keyId` carries a `#main-key` fragment; the document lives at the URL without it.
 */
export async function fetchActor(
  url: string, keyId: string, using: Fetcher = fetcher,
): Promise<RemoteActor | null> {
  const clean = url.split('#')[0] ?? url
  const hit = keyCache.get(clean)
  if (hit && Date.now() - hit.at < KEY_TTL_MS) return hit.actor
  try {
    const signed = signAs({ method: 'GET', url: clean, keyId })
    const res = await using(clean, { headers: signed?.headers ?? { accept: 'application/activity+json' } })
    if (!res.ok) return null
    const actor = readActor(JSON.parse(await readTextCapped(res, MAX_ACTOR_BYTES)) as unknown)
    if (actor) keyCache.set(clean, { actor, at: Date.now() })
    return actor
  } catch {
    return null
  }
}

/**
 * How many deliveries one tick makes.
 *
 * The same reasoning as the link-card sweep's five, one step up because these are this blog's
 * own words going where they were asked for: a post to four hundred followers should be in
 * everybody's timeline within a few minutes, not an hour. Twenty a minute reaches four hundred
 * inboxes in twenty minutes, and reaches no single server faster than it would read as polite.
 */
export const PER_TICK = 20

/** Hand over one activity. Returns null on success, or the reason to retry. */
async function handOver(d: Delivery, keyId: string, using: Fetcher): Promise<string | null> {
  const signed = signAs({ method: 'POST', url: d.inbox, body: d.body, keyId })
  if (!signed) return 'no key'
  try {
    const res = await using(d.inbox, { method: 'POST', headers: signed.headers, body: d.body })
    // ⚠️ ANY 2xx IS A YES. Implementations answer 200, 201, 202 and 204 for the same outcome,
    // and a client that insisted on one of them would retry deliveries that had already landed.
    if (res.status >= 200 && res.status < 300) return null
    // ...and a 4xx is a NO that retrying cannot fix. Only a 5xx or a broken connection is worth
    // another attempt; re-sending a refused activity six times is six refusals.
    if (res.status >= 400 && res.status < 500) return `refused ${res.status}`
    return `status ${res.status}`
  } catch (error) {
    return (error as Error).message
  }
}

/**
 * Send what is due, a few at a time.
 *
 * ⚠️ A 4xx GIVES UP AT ONCE rather than after six tries. The far end has said this activity is
 * wrong — unsigned, unparseable, addressed to a user who is gone — and none of those become
 * right by waiting a minute longer.
 */
export async function deliverDue(
  keyId: string, limit = PER_TICK, using: Fetcher = fetcher,
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let bad = 0
  for (const d of due(limit)) {
    const why = await handOver(d, keyId, using)
    if (why === null) {
      delivered(d.id)
      sent += 1
      continue
    }
    bad += 1
    if (why.startsWith('refused ') || why === 'no key') {
      delivered(d.id)
      console.error(`[ERROR] ap.deliver ${d.inbox}: ${why}, dropped`)
      continue
    }
    failed(d.id, d.attempts, why)
  }
  return { sent, failed: bad }
}
