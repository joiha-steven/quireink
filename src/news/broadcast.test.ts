// A broadcast outlives the request that started it.
//
// The send loop used to run inside the POST. `Bun.serve` closes a response that has sent no
// bytes after two minutes, and a long list took longer, so the admin was told the broadcast
// had failed while the mail was still going out — and the only thing on offer next was a
// button that sent the whole list again.
//
// Nothing here reaches a mail server: SMTP points at a closed port on the loopback, so every
// delivery is refused at once. What is under test is the bookkeeping around the loop.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { addSubscriber, confirmSubscriber } from '@/news/subscribers'
import { BroadcastError, broadcastPosts, broadcastRun, resetBroadcastRun } from '@/news/broadcast'

const DIR = './.tmp/test-broadcast'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PAST = new Date(Date.now() - 86_400_000).toISOString()

// Port 1 on the loopback has nothing listening, so a connection is refused rather than
// hanging: a test that waits on a real network timeout is a test nobody runs twice.
process.env.SMTP_HOST = '127.0.0.1'
process.env.SMTP_PORT = '1'
process.env.SMTP_FROM = 'blog@example.com'

beforeEach(() => {
  db().run(`delete from subscribers`)
  db().run(`delete from newsletter_sends`)
  db().run(`delete from posts`)
  resetBroadcastRun()
})

async function aSubscriber(email: string): Promise<void> {
  const { token } = await addSubscriber(email)
  await confirmSubscriber(token)
}

/** Wait for the detached run to finish, with a ceiling so a hang fails rather than hangs. */
async function settled(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (broadcastRun()?.done) return
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error('the run never finished')
}

describe('broadcastPosts', () => {
  it('answers before the sending is done, and counts up as it goes', async () => {
    const post = await savePost({ title: 'A letter', content: 'x '.repeat(200), status: 'published', date: PAST })
    await aSubscriber('one@example.com')
    await aSubscriber('two@example.com')

    const started = await broadcastPosts([post.slug])
    expect(started.recipients).toBe(2)
    expect(started.done).toBe(false)

    await settled()
    const run = broadcastRun()
    expect(run?.sent).toBe(0) // nothing is listening on port 1
    expect(run?.failed).toBe(2)
    expect(run?.slugs).toEqual([post.slug])
  })

  it('refuses a second run while one is going', async () => {
    const post = await savePost({ title: 'A letter', content: 'x '.repeat(200), status: 'published', date: PAST })
    await aSubscriber('one@example.com')

    await broadcastPosts([post.slug])
    await expect(broadcastPosts([post.slug], { force: true })).rejects.toThrow(BroadcastError)
    await settled()
  })

  it('refuses a repeat of a post already sent, unless told to send it again', async () => {
    const post = await savePost({ title: 'A letter', content: 'x '.repeat(200), status: 'published', date: PAST })
    await aSubscriber('one@example.com')
    db().run(
      `insert into newsletter_sends (email, kind, ok, post_slug, sent_at) values (?, 'broadcast', 1, ?, ?)`,
      ['one@example.com', post.slug, Date.now()],
    )

    await expect(broadcastPosts([post.slug])).rejects.toThrow(BroadcastError)
    expect(broadcastRun()).toBeNull() // refused before anything started
    await broadcastPosts([post.slug], { force: true })
    await settled()
  })

  it('stamps the post even when nobody was reachable', async () => {
    const post = await savePost({ title: 'A letter', content: 'x '.repeat(200), status: 'published', date: PAST })
    await aSubscriber('one@example.com')
    await broadcastPosts([post.slug])
    await settled()
    const row = db().query(`select broadcast_at from posts where slug = ?`).get(post.slug) as { broadcast_at: number | null }
    expect(row.broadcast_at).toBeGreaterThan(0)
  })
})
