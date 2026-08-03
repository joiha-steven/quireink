// The send log and its two rollups. The digest rule is the one worth pinning: one email
// carrying three posts is ONE row and ONE pixel, but must credit all three posts.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one, all } from '@/store/query'
import {
  logSend, statsByEmail, statsByPost, recordOpen, deleteSendsFor, newOpenToken,
} from '@/news/newsletter-log'

const DIR = './.tmp/test-newsletter-log'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => db().run(`delete from newsletter_sends`))

describe('logSend', () => {
  it('normalizes the address and records success', async () => {
    await logSend({ email: '  Reader@Example.COM ', kind: 'confirm', ok: true })
    const stats = await statsByEmail()
    expect(stats.get('reader@example.com')).toMatchObject({ sent: 1, failed: 0 })
  })

  it('records a failure with its reason, and keeps the LAST error', async () => {
    await logSend({ email: 'a@b.co', kind: 'broadcast', ok: false, error: 'first' })
    await logSend({ email: 'a@b.co', kind: 'broadcast', ok: false, error: 'second' })
    expect(await statsByEmail().then((s) => s.get('a@b.co'))).toMatchObject({
      failed: 2, sent: 0, lastError: 'second',
    })
  })

  it('does not burn an open token on a failed send, or on a non-broadcast', async () => {
    await logSend({ email: 'a@b.co', kind: 'broadcast', ok: false, openToken: 'burned' })
    await logSend({ email: 'a@b.co', kind: 'confirm', ok: true, openToken: 'wrong-kind' })
    expect(all<{ open_token: string | null }>(`select open_token from newsletter_sends`))
      .toEqual([{ open_token: null }, { open_token: null }])
  })

  it('never throws, so a logging failure cannot fail the mail that already went out', async () => {
    // A duplicate open_token violates the unique index; the insert must be swallowed.
    await logSend({ email: 'a@b.co', kind: 'broadcast', ok: true, openToken: 'dup' })
    await logSend({ email: 'c@d.co', kind: 'broadcast', ok: true, openToken: 'dup' })
    expect(one<{ n: number }>(`select count(*) n from newsletter_sends`)!.n).toBe(1)
  })
})

describe('statsByPost', () => {
  it('credits EVERY post in a digest, and counts the single open for all of them', async () => {
    const token = newOpenToken()
    await logSend({ email: 'a@b.co', kind: 'broadcast', ok: true, postSlugs: ['one', 'two', 'three'], openToken: token })
    await recordOpen(token)
    const stats = await statsByPost()
    for (const slug of ['one', 'two', 'three']) {
      expect(stats.get(slug)).toMatchObject({ sent: 1, broadcasts: 1, opened: 1 })
    }
  })

  it('counts one email as one send per address however many posts it carried', async () => {
    await logSend({ email: 'a@b.co', kind: 'broadcast', ok: true, postSlugs: ['one', 'two'] })
    expect((await statsByEmail()).get('a@b.co')).toMatchObject({ sent: 1, broadcasts: 1 })
  })

  it('ignores non-broadcast kinds and rows with no post', async () => {
    await logSend({ email: 'a@b.co', kind: 'reply', ok: true, postSlugs: ['one'] })
    await logSend({ email: 'a@b.co', kind: 'broadcast', ok: true })
    expect((await statsByPost()).size).toBe(0)
  })
})

describe('recordOpen', () => {
  it('stamps the first hit and ignores every refetch after it', async () => {
    const token = newOpenToken()
    await logSend({ email: 'a@b.co', kind: 'broadcast', ok: true, postSlugs: ['p'], openToken: token })
    await recordOpen(token)
    const first = one<{ opened_at: number }>(`select opened_at from newsletter_sends`)!.opened_at
    await recordOpen(token)
    expect(one<{ opened_at: number }>(`select opened_at from newsletter_sends`)!.opened_at).toBe(first)
    expect((await statsByPost()).get('p')!.opened).toBe(1)
  })

  it('is a silent no-op on a blank or unknown token', async () => {
    await logSend({ email: 'a@b.co', kind: 'broadcast', ok: true, postSlugs: ['p'], openToken: 'real' })
    await recordOpen('')
    await recordOpen('unknown')
    expect((await statsByPost()).get('p')!.opened).toBe(0)
  })
})

describe('deleteSendsFor', () => {
  it('removes one address and leaves the rest', async () => {
    await logSend({ email: 'gone@example.com', kind: 'confirm', ok: true })
    await logSend({ email: 'stay@example.com', kind: 'confirm', ok: true })
    await deleteSendsFor(' GONE@example.com ')
    expect([...(await statsByEmail()).keys()]).toEqual(['stay@example.com'])
  })
})
