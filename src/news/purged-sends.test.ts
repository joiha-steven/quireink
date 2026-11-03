// A newsletter's send log is keyed by the post's slug, and the send tab and the broadcast both read
// it as "this post has gone out". Purging a post left its rows under the slug, so a new post given
// the same address was refused as already sent, and the tab said it had been (2026-11-03).
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { savePost } from '@/content/posts'
import { deletePost, purgePost } from '@/content/posts-trash'
import { logSend, statsByEmail, statsByPost } from '@/news/newsletter-log'

const DIR = './.tmp/test-purged-sends'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
beforeEach(() => { for (const t of ['posts', 'post_terms', 'newsletter_sends']) db().run(`delete from ${t}`) })

describe('a purged post', () => {
  it('takes its sends off the slug, so a new post at that address has none', async () => {
    const post = { slug: 'ink', title: 'Ink', content: 'x', status: 'published' as const, date: '2020-01-01T00:00:00.000Z' }
    await savePost(post)
    await logSend({ email: 'a@example.com', kind: 'broadcast', ok: true, postSlugs: ['ink', 'paper'] })
    await deletePost('ink')
    await purgePost('ink')
    await savePost(post)
    const stats = await statsByPost()
    expect(stats.get('ink')).toBeUndefined()
    expect(stats.get('paper')?.sent).toBe(1)
    // The reader's own history still counts the email they were sent.
    expect((await statsByEmail()).get('a@example.com')?.sent).toBe(1)
  })
})
