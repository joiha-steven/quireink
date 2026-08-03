// Double opt-in. The rules that matter are: nobody is confirmed without clicking, a
// re-subscribe after unsubscribing walks the opt-in again, and deleting a subscriber
// really removes the address, log included.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one, all } from '@/store/query'
import {
  addSubscriber, confirmSubscriber, unsubscribeByToken, getConfirmedSubscribers,
  listSubscribers, subscriberCounts, deleteSubscriber, SubscribeError,
} from '@/news/subscribers'
import { logSend } from '@/news/newsletter-log'

const DIR = './.tmp/test-subscribers'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  db().run(`delete from subscribers`)
  db().run(`delete from newsletter_sends`)
})

describe('addSubscriber', () => {
  it('starts pending, never confirmed', async () => {
    const { token, alreadyConfirmed } = await addSubscriber('reader@example.com')
    expect(alreadyConfirmed).toBe(false)
    expect(token).toBeTruthy()
    expect((await listSubscribers())[0]).toMatchObject({ email: 'reader@example.com', status: 'pending' })
    expect(await getConfirmedSubscribers()).toEqual([])
  })

  it('lowercases and trims the address', async () => {
    await addSubscriber('  READER@Example.COM ')
    expect((await listSubscribers())[0]!.email).toBe('reader@example.com')
  })

  it('rejects a malformed or oversized address', async () => {
    for (const bad of ['nope', 'a@b', 'a b@c.co', '', `${'x'.repeat(250)}@example.com`]) {
      await expect(addSubscriber(bad)).rejects.toBeInstanceOf(SubscribeError)
    }
    expect(await listSubscribers()).toHaveLength(0)
  })

  it('is idempotent by email, keeping the same token while pending', async () => {
    const first = await addSubscriber('reader@example.com')
    const second = await addSubscriber('reader@example.com')
    expect(second.token).toBe(first.token)
    expect(await listSubscribers()).toHaveLength(1)
  })

  it('short-circuits an already-confirmed address so no second opt-in email goes out', async () => {
    const { token } = await addSubscriber('reader@example.com')
    await confirmSubscriber(token)
    const again = await addSubscriber('reader@example.com')
    expect(again).toEqual({ token, alreadyConfirmed: true })
    expect((await listSubscribers())[0]!.status).toBe('confirmed')
  })

  it('re-subscribing after unsubscribing goes back to PENDING, not straight to confirmed', async () => {
    const { token } = await addSubscriber('reader@example.com')
    await confirmSubscriber(token)
    await unsubscribeByToken(token)
    await addSubscriber('reader@example.com')
    const row = (await listSubscribers())[0]!
    expect(row.status).toBe('pending')
    expect(row.confirmedAt).toBeUndefined()
    expect(await getConfirmedSubscribers()).toEqual([])
  })
})

describe('confirm and unsubscribe', () => {
  it('confirms a pending row exactly once, and stamps the time', async () => {
    const { token } = await addSubscriber('reader@example.com')
    expect(await confirmSubscriber(token)).toBe(true)
    expect(await confirmSubscriber(token)).toBe(false) // no longer pending
    expect((await listSubscribers())[0]!.confirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('ignores a blank or unknown token', async () => {
    expect(await confirmSubscriber('')).toBe(false)
    expect(await confirmSubscriber('not-a-token')).toBe(false)
    expect(await unsubscribeByToken('')).toBe(false)
  })

  it('unsubscribes from pending or confirmed, but not twice', async () => {
    const a = await addSubscriber('a@example.com')
    const b = await addSubscriber('b@example.com')
    await confirmSubscriber(b.token)
    expect(await unsubscribeByToken(a.token)).toBe(true) // straight from pending
    expect(await unsubscribeByToken(b.token)).toBe(true)
    expect(await unsubscribeByToken(b.token)).toBe(false)
  })

  it('a confirmed address is a recipient; unsubscribing removes it', async () => {
    const { token } = await addSubscriber('reader@example.com')
    await confirmSubscriber(token)
    expect(await getConfirmedSubscribers()).toEqual([{ email: 'reader@example.com', token }])
    await unsubscribeByToken(token)
    expect(await getConfirmedSubscribers()).toEqual([])
  })
})

describe('admin views', () => {
  it('lists newest first and counts by status', async () => {
    const a = await addSubscriber('a@example.com')
    db().run(`update subscribers set created_at = created_at - 1000 where email = 'a@example.com'`)
    const b = await addSubscriber('b@example.com')
    await confirmSubscriber(b.token)
    const c = await addSubscriber('c@example.com')
    await unsubscribeByToken(c.token)
    void a
    expect((await listSubscribers()).map((s) => s.email)).toEqual([
      'c@example.com', 'b@example.com', 'a@example.com',
    ])
    expect(await subscriberCounts()).toEqual({ confirmed: 1, pending: 1, unsubscribed: 1 })
  })

  it('deleting a subscriber takes their send history with them', async () => {
    await addSubscriber('reader@example.com')
    await logSend({ email: 'reader@example.com', kind: 'confirm', ok: true })
    await logSend({ email: 'other@example.com', kind: 'confirm', ok: true })
    const id = one<{ id: number }>(`select id from subscribers where email = 'reader@example.com'`)!.id
    await deleteSubscriber(id)
    expect(await listSubscribers()).toHaveLength(0)
    expect(all<{ email: string }>(`select email from newsletter_sends`).map((r) => r.email))
      .toEqual(['other@example.com'])
  })
})
