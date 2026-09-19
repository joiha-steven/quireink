// THE FOUR DOORS, ASKED THE WAY THE FEDIVERSE ASKS THEM.
//
// ⚠️ THE INBOX IS THE MOST SENSITIVE ROUTE IN THIS PRODUCT: a public POST that records who may
// hear from this blog, written to by servers nobody here has ever heard of. Its whole defence is
// a signature checked against a key fetched from the actor an activity claims to be — so the
// cases below are not about shapes, they are about who gets to change this blog's state.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { generateKeyPairSync } from 'node:crypto'
import { dropDatabase, freshDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { saveSettings } from '@/content/settings'
import { savePost } from '@/content/posts'
import { resetLimits } from '@/server/rate-limit'
import { clearCache } from '@/server/cache'
import { run } from '@/store/query'
import { ensureKeys } from '@/ap/keys'
import { signRequest } from '@/ap/signature'
import { setApFetcher, forgetRemoteActors } from '@/ap/deliver'
import { followers } from '@/ap/store'

const DIR = './.tmp/test-ap-routes'
freshDatabase(DIR)
const app = createApp()
const SITE = 'https://blog.example'

// The stranger: their own keypair, their own actor document, served by the fake network.
const them = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
const THEIR_ID = 'https://elsewhere.test/users/someone'
const THEIR_ACTOR = {
  id: THEIR_ID,
  type: 'Person',
  inbox: `${THEIR_ID}/inbox`,
  endpoints: { sharedInbox: 'https://elsewhere.test/inbox' },
  publicKey: { id: `${THEIR_ID}#main-key`, owner: THEIR_ID, publicKeyPem: them.publicKey },
}

/**
 * ⚠️ A THIRD PARTY WHOSE ACTOR RESOLVES PERFECTLY WELL, and the fake network serves it.
 *
 * The first version of this file did not, and the impersonation case below passed for the wrong
 * reason: with the signer check REMOVED it stayed green, because the fetch for the victim's
 * actor 404'd and the handler gave up there. A test whose subject is "a valid key may not act
 * for somebody else" has to give the somebody else a working actor, or it is testing the mock.
 */
const VICTIM_ID = 'https://victim.test/users/other'
const VICTIM_ACTOR = {
  id: VICTIM_ID,
  type: 'Person',
  inbox: `${VICTIM_ID}/inbox`,
  publicKey: { id: `${VICTIM_ID}#main-key`, owner: VICTIM_ID, publicKeyPem: them.publicKey },
}

beforeAll(async () => {
  const world: Record<string, unknown> = { [THEIR_ID]: THEIR_ACTOR, [VICTIM_ID]: VICTIM_ACTOR }
  setApFetcher(async (url) => {
    const doc = world[url.split('#')[0] ?? '']
    return doc
      ? new Response(JSON.stringify(doc), { headers: { 'content-type': 'application/activity+json' } })
      : new Response('no', { status: 404 })
  })
})
afterAll(() => { setApFetcher(null); dropDatabase(DIR) })

beforeEach(async () => {
  resetLimits()
  clearCache()
  forgetRemoteActors()
  run(`delete from posts`)
  run(`delete from ap_sent`)
  run(`delete from ap_followers`)
  run(`delete from ap_queue`)
  await saveSettings({ siteUrl: SITE, title: 'A Blog' })
})

const on = async (): Promise<void> => {
  await saveSettings({ activitypub: { enabled: true, handle: 'quire' } })
  ensureKeys()
}
const off = async (): Promise<void> => {
  await saveSettings({ activitypub: { enabled: false, handle: 'quire' } })
}

const get = async (path: string, headers: Record<string, string> = {}): Promise<Response> =>
  await app.request(path, { headers })

/** A Follow, signed the way a real server signs one. */
const signedFollow = (over: { actor?: string; type?: string; object?: unknown } = {}) => {
  const body = JSON.stringify({
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: 'https://elsewhere.test/follows/1',
    type: over.type ?? 'Follow',
    actor: over.actor ?? THEIR_ID,
    object: over.object ?? `${SITE}/ap/actor`,
  })
  const signed = signRequest({
    method: 'POST', url: `${SITE}/ap/inbox`, body,
    keyId: `${THEIR_ID}#main-key`, privateKeyPem: them.privateKey,
  })
  return { body, headers: signed.headers }
}

const PATHS = ['/ap/actor', '/ap/outbox', '/ap/followers', '/.well-known/webfinger?resource=acct:quire@blog.example']

describe('the switch', () => {
  it('answers 404 on every door while it is off', async () => {
    await off()
    for (const path of PATHS) expect((await get(path)).status).toBe(404)
    const follow = signedFollow()
    expect((await app.request('/ap/inbox', { method: 'POST', ...follow })).status).toBe(404)
  })

  it('opens all of them once it is on', async () => {
    // The counter-test: 404 everywhere proves nothing if the routes were never registered.
    await on()
    for (const path of PATHS) expect((await get(path)).status).toBe(200)
  })

  it('stays shut with no site address, because the actor would name localhost', async () => {
    // ⚠️ AN ACTOR WHOSE ID SAYS `localhost` IS AN IDENTITY POINTING AT WHOEVER ASKED. Every
    // delivery it signed would be verified against a key fetched from the follower's own
    // machine. Refusing to run is the only honest answer.
    await saveSettings({ siteUrl: '', activitypub: { enabled: true, handle: 'quire' } })
    for (const path of PATHS) expect((await get(path)).status).toBe(404)
    await saveSettings({ siteUrl: SITE })
  })

  it('mints the key on the first request, not only when the clock ticks', async () => {
    // ⚠️ FOUND BY THE TOUR. The key was minted by the minute tick alone, and the clock is
    // suppressed in development and in tests — so on any machine where it does not run, the
    // actor answered 200 with an EMPTY `publicKeyPem`. That is worse than a 404 in both
    // directions: a server that fetched the actor in that window caches an identity it can
    // never verify anything against, and nothing on either side reports an error.
    run(`delete from ap_keys`)
    await saveSettings({ activitypub: { enabled: true, handle: 'quire' } })
    const doc = await (await get('/ap/actor')).json() as { publicKey: { publicKeyPem: string } }
    expect(doc.publicKey.publicKeyPem).toContain('BEGIN PUBLIC KEY')
    // ...and asking again does not mint a second one: the identity is made once and kept.
    const again = await (await get('/ap/actor')).json() as { publicKey: { publicKeyPem: string } }
    expect(again.publicKey.publicKeyPem).toBe(doc.publicKey.publicKeyPem)
  })

  it('stays shut with no handle', async () => {
    await saveSettings({ activitypub: { enabled: true, handle: '' } })
    expect((await get('/ap/actor')).status).toBe(404)
  })
})

describe('who this blog says it is', () => {
  beforeEach(on)

  it('publishes the PUBLIC key and nothing that looks like the other half', async () => {
    // ⚠️ THE ONE LEAK THAT WOULD MATTER. Whoever holds the private key can post as this blog to
    // every follower it has, forever, and there is no revoking it short of a new identity.
    const body = await (await get('/ap/actor')).text()
    expect(body).toContain('BEGIN PUBLIC KEY')
    expect(body).not.toContain('PRIVATE KEY')
    const doc = JSON.parse(body) as { publicKey: { id: string }; type: string; endpoints: { sharedInbox: string } }
    expect(doc.type).toBe('Person')
    expect(doc.publicKey.id).toBe(`${SITE}/ap/actor#main-key`)
    expect(doc.endpoints.sharedInbox).toBe(`${SITE}/ap/inbox`)
  })

  it('answers WebFinger for its own name and for no other', async () => {
    const hit = await get('/.well-known/webfinger?resource=acct:quire@blog.example')
    expect(hit.status).toBe(200)
    expect(hit.headers.get('content-type')).toContain('application/jrd+json')
    const doc = await hit.json() as { links: { rel: string; href: string }[] }
    expect(doc.links.find((l) => l.rel === 'self')?.href).toBe(`${SITE}/ap/actor`)
    for (const wrong of ['acct:someone@blog.example', 'acct:quire@elsewhere.test', '', 'quire']) {
      expect((await get(`/.well-known/webfinger?resource=${encodeURIComponent(wrong)}`)).status).toBe(404)
    }
  })

  it('counts its followers without naming them', async () => {
    // The people who follow a blog did not agree to appear in a list on it.
    const doc = await (await get('/ap/followers')).json() as Record<string, unknown>
    expect(doc.totalItems).toBe(0)
    expect('orderedItems' in doc).toBe(false)
    expect('items' in doc).toBe(false)
  })
})

describe('one post, two representations at one address', () => {
  beforeEach(async () => {
    await on()
    await savePost({
      title: 'On setting type', slug: 'on-setting-type', content: 'A body.', status: 'published',
      date: new Date(Date.now() - 3600_000).toISOString(), categories: [], tags: [],
    } as Parameters<typeof savePost>[0])
  })

  it('answers the object to a server and the page to a reader', async () => {
    const machine = await get('/on-setting-type', { accept: 'application/activity+json' })
    expect(machine.headers.get('content-type')).toContain('application/activity+json')
    const note = await machine.json() as { type: string; id: string }
    expect(note.type).toBe('Note')
    expect(note.id).toBe(`${SITE}/on-setting-type`)

    const reader = await get('/on-setting-type', { accept: 'text/html' })
    expect(reader.headers.get('content-type')).toContain('text/html')
    expect(await reader.text()).toContain('<article')
  })

  it('says it varies by Accept, and refuses to be held', async () => {
    // ⚠️ THE PAGE CACHE IS KEYED BY PATH ALONE. Without `Vary`, a shared cache in front of this
    // blog may hand the JSON to a reader or the HTML to a server — and the second of those
    // looks, from the far end, like a blog that simply stopped federating.
    const machine = await get('/on-setting-type', { accept: 'application/activity+json' })
    expect(machine.headers.get('vary')).toContain('Accept')
    expect(machine.headers.get('cache-control')).toContain('no-store')
    // And the reader's copy is still cacheable, which is the whole point of the page cache.
    const reader = await get('/on-setting-type', { accept: 'text/html' })
    expect(reader.headers.get('cache-control')).toContain('s-maxage')
  })

  it('does not hand out a draft to a server either', async () => {
    await savePost({
      title: 'Not yet', slug: 'not-yet', content: 'x', status: 'draft',
      date: new Date().toISOString(), categories: [], tags: [],
    } as Parameters<typeof savePost>[0])
    const res = await get('/not-yet', { accept: 'application/activity+json' })
    // It falls through to the page, which is a 404 for a draft — never to the object.
    expect(res.status).toBe(404)
  })
})

describe('the inbox', () => {
  beforeEach(on)
  const post = async (init: { body: string; headers: Record<string, string> }): Promise<Response> =>
    await app.request('/ap/inbox', { method: 'POST', body: init.body, headers: init.headers })

  it('records a signed Follow and queues an Accept to the personal inbox', async () => {
    const res = await post(signedFollow())
    expect(res.status).toBe(202)
    expect(followers().map((f) => f.actor)).toEqual([THEIR_ID])
    // The shared inbox is remembered for deliveries; the Accept goes to the personal one.
    expect(followers()[0]!.sharedInbox).toBe('https://elsewhere.test/inbox')
    const queued = await import('@/ap/store')
    expect(queued.due(10).map((d) => d.inbox)).toEqual([`${THEIR_ID}/inbox`])
    expect(JSON.parse(queued.due(10)[0]!.body) as { type: string }).toMatchObject({ type: 'Accept' })
  })

  it('refuses an unsigned request', async () => {
    const res = await post({
      body: JSON.stringify({ type: 'Follow', actor: THEIR_ID }),
      headers: { 'content-type': 'application/activity+json' },
    })
    expect(res.status).toBe(401)
    expect(followers()).toEqual([])
  })

  it('refuses a body that is not the one signed for', async () => {
    const follow = signedFollow()
    const res = await post({ ...follow, body: follow.body.replace('Follow', 'Undo') })
    expect(res.status).toBe(401)
    expect(followers()).toEqual([])
  })

  it('ignores a Follow that names somebody else as the follower', async () => {
    // ⚠️ THE CHECK THAT MAKES A SIGNATURE MEAN ANYTHING HERE. It proves who SENT the activity;
    // without comparing it to the `actor`, anybody with a valid key of their own could add — or
    // remove — any follower they liked.
    const res = await post(signedFollow({ actor: VICTIM_ID }))
    expect(res.status).toBe(202)
    expect(followers()).toEqual([])
  })

  it('takes a follow back on an Undo, and only from the same party', async () => {
    await post(signedFollow())
    expect(followers()).toHaveLength(1)
    await post(signedFollow({ actor: VICTIM_ID, type: 'Undo', object: { type: 'Follow' } }))
    expect(followers()).toHaveLength(1)
    await post(signedFollow({ type: 'Undo', object: { type: 'Follow' } }))
    expect(followers()).toEqual([])
  })

  it('accepts and drops a verb it does not implement', async () => {
    // Refusing an unimplemented verb with a 400 teaches the far end that this blog is broken,
    // and on some implementations gets it marked unreachable.
    const res = await post(signedFollow({ type: 'Like', object: `${SITE}/on-setting-type` }))
    expect(res.status).toBe(202)
    expect(followers()).toEqual([])
  })
})
