// THE FEDIVERSE'S FOUR DOORS, plus the one that tells it they are there.
//
// ADR 0059. In `src/web/` rather than beside the rest of `src/ap/` for a reason that is easy to
// miss: `scripts/checks/routes-guarded.ts` only reads `src/web/**`, so a POST route declared
// anywhere else is invisible to the check that makes every write route a decision. The inbox is
// a public POST — the most sensitive kind there is — and it belongs where the guard can see it.

import type { Context, Hono } from 'hono'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { getPublicPosts } from '@/content/posts'
import { langOf } from '@/content/translations'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { logActivity } from '@/server/activity'
import { actorDocument, actorOf, AP, AP_TYPE, apReady, keyIdOf, webfingerFor } from '@/ap/actor'
import { acceptOf, createOf, noteOf } from '@/ap/objects'
import { addFollower, enqueue, followerCount, removeFollower } from '@/ap/store'
import { fetchActor } from '@/ap/deliver'
import { ensureKeys } from '@/ap/keys'
import { verifySignature, parseSignature } from '@/ap/signature'

/** A JSON document in the media type the fediverse reads. Never cached by a shared cache. */
const ap = (c: Context, body: unknown, status = 200): Response =>
  c.body(JSON.stringify(body), status as 200, {
    'content-type': AP_TYPE,
    // ⚠️ `Vary: Accept` MATTERS MORE HERE THAN ANYWHERE ELSE ON THIS SITE. An article answers
    // HTML or an ActivityPub object at ONE address depending on this header, and a shared cache
    // that does not know that will hand a reader the JSON or a server the HTML — the second of
    // which looks, from the far end, like a blog that suddenly stopped federating.
    vary: 'Accept',
    'cache-control': 'no-store',
  })

/**
 * The settings, when this blog has an identity — and MAKING one if it does not yet.
 *
 * ⚠️ THE KEY IS MINTED HERE AS WELL AS BY THE TICK, and the tour found out why. The clock is
 * suppressed in development and in tests, so on any machine where it does not run the actor
 * answered 200 with an EMPTY `publicKeyPem`. That is worse than a 404 in both directions: a
 * server that fetched the actor in that window caches an identity it can never verify anything
 * against, and nothing on either side reports an error.
 *
 * `ensureKeys` is one indexed read after the first call, so paying it per request is paying
 * nothing; and the first call is what makes the cutoff in `ap/announce.ts` mean "when this
 * became ready" rather than "when the clock next happened to tick".
 */
async function ready(): Promise<Awaited<ReturnType<typeof getSettings>> | null> {
  const settings = await getSettings()
  if (!apReady(settings)) return null
  ensureKeys()
  return settings
}

/** True when a request is asking for the machine-readable half of a page. */
export const wantsActivity = (accept: string | undefined): boolean =>
  !!accept && /\bapplication\/(activity\+json|ld\+json)\b/.test(accept)

/** How many inbox posts one address may make a minute. See the key cache in `ap/deliver.ts`. */
const INBOX_PER_MINUTE = 30

/**
 * ONE POST, as the object a follower's server already holds the id of.
 *
 * ⚠️ IT IS THE SAME URL AS THE PAGE, chosen by `Accept`, which is what the specification asks
 * for and what makes the object findable by anyone holding the link. Two consequences follow,
 * and both are easy to miss:
 *
 *   The page cache is keyed by PATH ALONE, so this branch has to be taken BEFORE `cached(...)`
 *   in the router — exactly where the Markdown branch already sits. A cached HTML page served
 *   to a fediverse server, or a cached JSON object served to a reader, is the same bug twice.
 *
 *   And the answer carries `Vary: Accept`. Without it a shared cache in front of this blog is
 *   free to hand either representation to either caller.
 */
export async function handleActivityObject(c: Context, slug: string): Promise<Response | null> {
  const settings = await getSettings()
  if (!apReady(settings)) return null
  const site = resolveSiteUrl(settings)
  const post = (await getPublicPosts()).find((p) => p.slug === slug)
  if (!post) return null
  const actor = actorOf(site, settings.activitypub.handle)
  return ap(c, {
    '@context': 'https://www.w3.org/ns/activitystreams',
    ...noteOf({ post, site, actor, lang: langOf(post, settings.language) }),
  })
}

export function registerApRoutes(app: Hono): void {
  /**
   * WebFinger: the only way `@name@host` becomes a URL.
   *
   * ⚠️ IT LIVES UNDER `/.well-known/`, AND THAT IS A DEPLOYMENT HAZARD rather than a detail. A
   * common nginx recipe claims `location ~ /.well-known { ... }` for ACME with no `proxy_pass`,
   * which swallows this path and answers from disk — so the blog federates perfectly in testing
   * and is unfindable in production, with nothing in its own logs. `docs/agent-ready.md` carries
   * the narrowed form.
   */
  app.get('/.well-known/webfinger', async (c) => {
    const settings = await ready()
    if (!settings) return c.json({ error: 'Not found' }, 404)
    const doc = webfingerFor(c.req.query('resource') ?? '', settings, resolveSiteUrl(settings))
    if (!doc) return c.json({ error: 'Not found' }, 404)
    // The JRD media type, which is what the specification asks for and what several clients
    // check before parsing.
    return c.body(JSON.stringify(doc), 200, {
      'content-type': 'application/jrd+json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    })
  })

  app.get(AP.actor, async (c) => {
    const settings = await ready()
    if (!settings) return c.json({ error: 'Not found' }, 404)
    return ap(c, actorDocument(settings, resolveSiteUrl(settings)))
  })

  /**
   * The followers collection, as a COUNT and nothing else.
   *
   * ⚠️ NO LIST. The specification allows one and Mastodon publishes one; this does not. The
   * people who follow a blog did not agree to appear in a public list on it, the count is what
   * a client actually renders, and a blog with three followers has no reason to name them to
   * anybody who asks.
   */
  app.get(AP.followers, async (c) => {
    const settings = await ready()
    if (!settings) return c.json({ error: 'Not found' }, 404)
    const site = resolveSiteUrl(settings)
    return ap(c, {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${site}${AP.followers}`,
      type: 'OrderedCollection',
      totalItems: followerCount(),
    })
  })

  /**
   * The outbox: what this blog has said, newest first.
   *
   * ONE PAGE, and it is the collection itself rather than a pointer to one. Paging exists in the
   * specification for accounts with a hundred thousand posts; a blog's archive fits, and a
   * `first`/`next` chain is three more shapes to get subtly wrong for readers who mostly never
   * fetch this at all.
   */
  app.get(AP.outbox, async (c) => {
    const settings = await ready()
    if (!settings) return c.json({ error: 'Not found' }, 404)
    const site = resolveSiteUrl(settings)
    const actor = actorOf(site, settings.activitypub.handle)
    const posts = (await getPublicPosts()).slice(0, 40)
    const items = posts.map((post) =>
      createOf(noteOf({ post, site, actor, lang: langOf(post, settings.language) }), actor))
    return ap(c, {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${site}${AP.outbox}`,
      type: 'OrderedCollection',
      totalItems: items.length,
      orderedItems: items,
    })
  })

  app.post(AP.inbox, async (c) => handleInbox(c))
}

/**
 * The inbox.
 *
 * ⚠️ IT ANSWERS 202 TO ALMOST EVERYTHING, and that is the protocol rather than laziness. An
 * inbox is written to by servers this blog has never heard of, carrying verbs it does not
 * implement; refusing them with a 400 teaches the far end that this blog is broken and, on some
 * implementations, gets it marked unreachable. Accepted-and-ignored is what an unimplemented
 * verb deserves.
 *
 * What it does NOT do is accept an unsigned one. Every state change here is driven by an
 * activity whose signature checked out against a key fetched from the actor it claims to be.
 */
async function handleInbox(c: Context): Promise<Response> {
  const settings = await ready()
  if (!settings) return c.json({ error: 'Not found' }, 404)
  if (rateLimited(`apinbox:${clientIp(c)}`, INBOX_PER_MINUTE)) {
    return c.json({ error: 'Too many requests' }, 429)
  }

  // ⚠️ THE RAW TEXT, NOT `c.req.json()`. The digest is over the exact bytes that arrived, and a
  // body that has been parsed and re-serialised is a different string — one key ordering away
  // from a signature that never verifies.
  const body = await c.req.text()
  const parsed = parseSignature(c.req.header('signature'))
  if (!parsed) return c.json({ error: 'Signed requests only' }, 401)

  const site = resolveSiteUrl(settings)
  const remote = await fetchActor(parsed.keyId, keyIdOf(site))
  if (!remote) return c.json({ error: 'Could not read the signing actor' }, 401)

  const url = new URL(c.req.url)
  const refusal = verifySignature({
    method: 'POST',
    path: url.pathname + url.search,
    headers: headersOf(c),
    body,
    publicKeyPem: remote.publicKeyPem,
  })
  if (refusal) {
    console.error(`[ERROR] ap.inbox ${remote.id}: ${refusal}`)
    return c.json({ error: 'Signature refused' }, 401)
  }

  const activity = safeJson(body)
  if (!activity) return c.body(null, 202)
  return act(c, activity, remote.id, site, settings)
}

/** Hono lower-cases header names; the verifier reads them by the names a signature listed. */
function headersOf(c: Context): Record<string, string> {
  const out: Record<string, string> = {}
  c.req.raw.headers.forEach((value, name) => { out[name.toLowerCase()] = value })
  return out
}

const safeJson = (body: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(body)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

async function act(
  c: Context,
  activity: Record<string, unknown>,
  signer: string,
  site: string,
  settings: Awaited<ReturnType<typeof getSettings>>,
): Promise<Response> {
  const ok = (): Response => c.body(null, 202)
  const type = typeof activity.type === 'string' ? activity.type : ''
  const who = typeof activity.actor === 'string' ? activity.actor : ''

  // ⚠️ THE SIGNER AND THE ACTOR MUST BE THE SAME PERSON. Without this, anybody holding a valid
  // key of their own can send a `Follow` naming somebody else as the follower, or an `Undo`
  // removing them: a signature proves who SENT a thing, and this line is what makes it also
  // prove who the thing is ABOUT.
  if (who === '' || who !== signer) return ok()

  if (type === 'Follow') {
    const remote = await fetchActor(who, keyIdOf(site))
    if (!remote) return ok()
    addFollower({ actor: remote.id, inbox: remote.inbox, sharedInbox: remote.sharedInbox })
    // ⚠️ THE ACCEPT GOES TO THE PERSONAL INBOX, not the shared one. A shared inbox is for
    // activities addressed to a server's users in general; an Accept is addressed to one of
    // them, and several implementations drop one that arrives the other way — which leaves the
    // follow pending forever on their side while this blog counts them as a follower.
    const actor = actorOf(site, settings.activitypub.handle)
    enqueue(JSON.stringify(acceptOf(activity, actor)), [remote.inbox])
    void logActivity('ap.follow', remote.id)
    return ok()
  }

  if (type === 'Undo' && objectTypeOf(activity.object) === 'Follow') {
    removeFollower(who)
    void logActivity('ap.unfollow', who)
    return ok()
  }

  // Everything else — a Like, a Create carrying a reply, an Announce — is accepted and dropped.
  // v1 publishes; it does not read. ADR 0059 says what v2 would have to decide first, and why
  // a reply becoming a comment is a moderation question before it is a protocol one.
  return ok()
}

const objectTypeOf = (value: unknown): string => {
  const o = value as { type?: unknown } | null
  return typeof o?.type === 'string' ? o.type : ''
}
