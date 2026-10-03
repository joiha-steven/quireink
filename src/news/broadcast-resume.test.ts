// A newsletter cut off half-way carries on after a restart, and nobody gets it twice.
//
// The send used to keep its place in memory. A Durable Object restarts after every deploy and can
// be evicted at any time, and a Bun process restarts on every upgrade; the list stopped where it
// stood, and the only way on was the resend box, which mails the first half again. These cases
// cut a send off at the worst moment — a message with the relay, its answer not yet back — and
// count, at the relay, how many messages each address was sent.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { startRelay, type Relay } from '@/test/relay'
import { savePost } from '@/content/posts'
import { getSettings } from '@/content/settings'
import { addSubscriber, confirmSubscriber } from '@/news/subscribers'
import { emailBrand } from '@/news/email-brand'
import { broadcastRun, resetBroadcastRun, resumeBroadcast } from '@/news/broadcast'
import { INTERRUPTED, openRun } from '@/news/outbox'

const DIR = './.tmp/test-broadcast-resume'
freshDatabase(DIR)
const PAST = new Date(Date.now() - 86_400_000).toISOString()
const ADDRESSES = ['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com', 'e@example.com']

let relay: Relay
beforeAll(async () => {
  relay = await startRelay()
  process.env.SMTP_HOST = '127.0.0.1'
  process.env.SMTP_PORT = String(relay.port)
  process.env.SMTP_FROM = 'blog@example.com'
})
afterAll(() => {
  relay.close()
  dropDatabase(DIR)
})

beforeEach(() => {
  for (const t of ['subscribers', 'newsletter_sends', 'posts', 'broadcast_runs', 'broadcast_outbox']) db().run(`delete from ${t}`)
  relay.reset()
  resetBroadcastRun()
})

async function everyone(): Promise<{ email: string; token: string }[]> {
  const out: { email: string; token: string }[] = []
  for (const email of ADDRESSES) {
    const { token } = await addSubscriber(email)
    await confirmSubscriber(token)
    out.push({ email, token })
  }
  return out
}

const sends = (email: string) =>
  db().query(`select ok, error from newsletter_sends where email = ? and kind = 'broadcast' order by id`).all(email) as { ok: number; error: string | null }[]

const perAddress = () => Object.fromEntries(ADDRESSES.map((a) => [a, relay.rcpt.filter((r) => r === a).length]))

describe('resuming a send', () => {
  it('settles a dead runner\'s last messages from the send log and mails only who is still owed', async () => {
    const post = await savePost({ title: 'A letter', content: 'x '.repeat(200), status: 'published', date: PAST })
    const subs = await everyone()
    const letter = JSON.stringify({ posts: [{ slug: post.slug, title: post.title }], brand: emailBrand(await getSettings()), lang: 'en' })
    openRun({ slugs: [post.slug], letter, subs, now: Date.now() })
    // What a runner leaves when it dies: a delivered and recorded, b delivered (the log has its
    // token) but not yet recorded, c with the relay and no answer, d and e owed. Its lease ran out.
    const at = Date.now() - 5_000
    db().run(`update broadcast_outbox set state = 'sent' where email = 'a@example.com'`)
    db().run(`update broadcast_outbox set state = 'sending', open_token = 'tok-b', claimed_at = ? where email = 'b@example.com'`, [at])
    db().run(`update broadcast_outbox set state = 'sending', open_token = 'tok-c', claimed_at = ? where email = 'c@example.com'`, [at])
    db().run(`update broadcast_runs set sent = 1, lease_owner = 'dead', lease_until = ?`, [Date.now() - 1])
    db().run(`insert into newsletter_sends (email, kind, post_slug, sent_at, ok, open_token) values ('b@example.com', 'broadcast', ?, ?, 1, 'tok-b')`, [post.slug, at])

    await resumeBroadcast()

    expect(perAddress()).toEqual({ 'a@example.com': 0, 'b@example.com': 0, 'c@example.com': 0, 'd@example.com': 1, 'e@example.com': 1 })
    expect(sends('c@example.com')).toEqual([{ ok: 0, error: INTERRUPTED }])
    expect(broadcastRun()).toMatchObject({ recipients: 5, sent: 4, failed: 1, done: true })
    const stamped = db().query(`select broadcast_at from posts where slug = ?`).get(post.slug) as { broadcast_at: number | null }
    expect(stamped.broadcast_at).toBeGreaterThan(0)
  })

  it('waits for a runner still holding its lease, and takes over once the lease lapses', async () => {
    const post = await savePost({ title: 'A letter', content: 'x '.repeat(200), status: 'published', date: PAST })
    const subs = await everyone()
    const letter = JSON.stringify({ posts: [{ slug: post.slug, title: post.title }], brand: emailBrand(await getSettings()), lang: 'en' })
    openRun({ slugs: [post.slug], letter, subs, now: Date.now() })
    db().run(`update broadcast_runs set lease_owner = 'alive', lease_until = ?`, [Date.now() + 60_000])

    await resumeBroadcast()
    expect(relay.rcpt).toEqual([])
    expect(broadcastRun()?.done).toBe(false)

    db().run(`update broadcast_runs set lease_until = ?`, [Date.now() - 1])
    resetBroadcastRun()
    await resumeBroadcast()
    expect(relay.rcpt).toEqual(ADDRESSES)
    expect(broadcastRun()).toMatchObject({ sent: 5, failed: 0, done: true })
  })

  it('carries on after the process sending it is killed mid-message, and nobody gets two', async () => {
    const post = await savePost({ title: 'A letter', content: 'x '.repeat(200), status: 'published', date: PAST })
    await everyone()
    // Another process presses send, against the same database files, and is killed by SIGKILL while
    // the third message is with the relay: nothing in it gets to run on the way out.
    const work = resolve(DIR, 'child')
    mkdirSync(work, { recursive: true })
    const script = join(work, 'press.ts')
    writeFileSync(script, [
      `import { openDatabases } from '@/store/db'`,
      `import { broadcastPosts } from '@/news/broadcast'`,
      `openDatabases(${JSON.stringify(resolve(DIR))})`,
      `await broadcastPosts([${JSON.stringify(post.slug)}])`,
      `setInterval(() => {}, 1000)`,
    ].join('\n'))
    relay.stallAt(3)
    const child = Bun.spawn([process.execPath, script], {
      cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'test' }, stdout: 'ignore', stderr: 'ignore',
    })
    await relay.received(3)
    child.kill('SIGKILL')
    await child.exited
    relay.stallAt(0)

    const left = db().query(`select email, state from broadcast_outbox order by id`).all() as { email: string; state: string }[]
    expect(left.map((r) => r.state)).toEqual(['sent', 'sent', 'sending', 'owed', 'owed'])

    // The killed process's lease would lapse by itself within `LEASE_MS`; the test does not wait.
    db().run(`update broadcast_runs set lease_until = 0`)
    await resumeBroadcast()

    expect(perAddress()).toEqual(Object.fromEntries(ADDRESSES.map((a) => [a, 1])))
    expect(sends('c@example.com')).toEqual([{ ok: 0, error: INTERRUPTED }])
    expect(broadcastRun()).toMatchObject({ recipients: 5, sent: 4, failed: 1, done: true })
  }, 30_000)
})
