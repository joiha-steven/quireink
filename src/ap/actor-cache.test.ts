// The remote-actor cache has a ceiling (2026-09-30).
//
// It kept every actor any unsigned inbox POST named, for good: the TTL was read on a hit and
// nothing evicted. 400 fake actors held about 128 MB.
import { describe, it, expect, afterAll, beforeEach } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { fetchActor, forgetRemoteActors, rememberedActors } from '@/ap/deliver'

const DIR = './.tmp/test-actor-cache'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
beforeEach(() => forgetRemoteActors())

const actorAt = (pem: string) => async (url: string): Promise<Response> =>
  new Response(JSON.stringify({ id: url, inbox: `${url}/inbox`, publicKey: { publicKeyPem: pem } }), {
    headers: { 'content-type': 'application/activity+json' },
  })

describe('the remote-actor cache', () => {
  it('holds at most five hundred, whatever a stranger names', async () => {
    const fetch = actorAt('-----BEGIN PUBLIC KEY-----short-----END PUBLIC KEY-----')
    for (let i = 0; i < 620; i++) await fetchActor(`https://x.test/actor/${i}`, `https://x.test/actor/${i}#main-key`, fetch)
    expect(rememberedActors()).toBe(500)
  })

  it('does not keep a key larger than any real one', async () => {
    let asked = 0
    const huge = actorAt('x'.repeat(200_000))
    const counting = async (url: string) => { asked++; return huge(url) }
    await fetchActor('https://x.test/big', 'https://x.test/big#k', counting)
    await fetchActor('https://x.test/big', 'https://x.test/big#k', counting)
    expect(asked).toBe(2)
    expect(rememberedActors()).toBe(0)
  })
})
