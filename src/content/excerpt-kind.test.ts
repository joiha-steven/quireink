// A written excerpt and a derived one are different things (migration 020).
//
// They shared one column. The editor loaded the derived one into the Excerpt field and the next
// save stored it as written, so it froze on whatever the opening was the day the post was first
// reopened; and the deck printed it above the body, so the opening appeared twice.

import { describe, it, expect, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { getPost, savePost } from '@/content/posts'
import { settleExcerptKinds } from '@/content/settle'
import { createApp } from '@/web/app'
import { legacyExcerpt } from '@/utils'

const DIR = './.tmp/test-excerpt-kind'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const DATE = '2024-01-01T00:00:00.000Z'

describe('a derived excerpt', () => {
  it('follows the body on every save from the editor, which sends the field empty', async () => {
    await savePost({ title: 'Follows', content: 'Alpha words first.', status: 'published', date: DATE })
    expect((await getPost('follows'))?.excerptAuto).toBe(true)
    await savePost({ title: 'Follows', slug: 'follows', content: 'Beta replaced words.', excerpt: '', status: 'published', date: DATE }, 'follows')
    const after = await getPost('follows')
    expect(after?.excerpt).toBe('Beta replaced words.')
    expect(after?.excerptAuto).toBe(true)
  })

  it('stays derived when a post is read and saved back with the same words', async () => {
    // A bulk status change and the image rescue both do this; the derived excerpt came back
    // as if typed, and froze.
    await savePost({ title: 'Bulk', content: 'Gamma words.', status: 'draft', date: DATE })
    const read = await getPost('bulk')
    await savePost({ ...read!, status: 'published' }, 'bulk')
    expect((await getPost('bulk'))?.excerptAuto).toBe(true)
  })

  it('becomes written the moment somebody changes it', async () => {
    await savePost({ title: 'Raced', content: 'Body.', status: 'published', date: DATE })
    const read = await getPost('raced')
    await savePost({ ...read!, excerpt: 'Typed meanwhile.' }, 'raced')
    const after = await getPost('raced')
    expect(after?.excerpt).toBe('Typed meanwhile.')
    expect(after?.excerptAuto).toBeUndefined()
  })

  it('is not printed above the body it was taken from', async () => {
    await savePost({ title: 'No deck', content: 'The opening sentence.', status: 'published', date: DATE })
    const html = await (await app.request('/no-deck')).text()
    expect(html).not.toContain('class="deck"')
  })

  it('leaves the headings out', async () => {
    await savePost({ title: 'Heads', content: '## Code\n\nThe first real sentence.', status: 'published', date: DATE })
    expect((await getPost('heads'))?.excerpt).toBe('The first real sentence.')
  })
})

describe('a written excerpt', () => {
  it('stays as written, and the deck shows it', async () => {
    await savePost({ title: 'Written', content: 'Body words.', excerpt: 'What the author said.', status: 'published', date: DATE })
    const post = await getPost('written')
    expect(post?.excerpt).toBe('What the author said.')
    expect(post?.excerptAuto).toBeUndefined()
    const html = await (await app.request('/written')).text()
    expect(html).toContain('<p class="deck">What the author said.</p>')
  })
})

describe('posts from before the column', () => {
  it('are sorted once: a stored excerpt the body derives is derived, anything else was typed', async () => {
    const body = '# A heading\n\nOld opening words.'
    await savePost({ title: 'Old auto', content: body, status: 'published', date: DATE })
    await savePost({ title: 'Old typed', content: body, excerpt: 'Typed by hand.', status: 'published', date: DATE })
    // As an upgraded database has them: the old rule's excerpt, and no verdict yet.
    db().run(`update posts set excerpt = ?, excerpt_auto = -1 where slug = 'old-auto'`, [legacyExcerpt(body)])
    db().run(`update posts set excerpt_auto = -1 where slug = 'old-typed'`)
    expect(settleExcerptKinds(50)).toBe(2)
    expect((await getPost('old-auto'))?.excerptAuto).toBe(true)
    expect((await getPost('old-typed'))?.excerptAuto).toBeUndefined()
    // And a second boot has nothing to do.
    expect(settleExcerptKinds(50)).toBe(0)
  })
})
