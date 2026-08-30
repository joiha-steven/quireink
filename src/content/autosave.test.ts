// The editor's server autosave, and the ONE promise that makes it safe to have at all.
//
// A server-side autosave on a published post is a loaded gun: the difference between "the
// reader sees what you published" and "the reader sees the half sentence you were typing" is
// which column the snapshot lands in. That is not a thing to leave to a code review, so the
// promise is asserted here from both ends — the snapshot goes somewhere, and the body a reader
// is served does not move.
import { describe, expect, it, beforeEach } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabases } from '@/store/db'
import { clearAutosave, getAutosave, putAutosave } from '@/content/autosave'
import { getPost, savePost } from '@/content/posts'
import { getPage, savePage } from '@/content/pages'

beforeEach(() => {
  openDatabases(mkdtempSync(join(tmpdir(), 'quire-autosave-')))
})

const PUBLISHED = {
  slug: 'a-published-piece',
  title: 'A published piece',
  date: '2026-08-01T00:00:00.000Z',
  status: 'published' as const,
  categories: [],
  tags: [],
  excerpt: '',
  content: 'The sentence a reader is entitled to see.',
}

describe('the autosave column', () => {
  it('holds a snapshot against a saved post and gives it back', async () => {
    await savePost(PUBLISHED)
    expect(putAutosave('post', PUBLISHED.slug, '{"content":"half a sen"}')).toBe(true)
    const found = getAutosave('post', PUBLISHED.slug)
    expect(found?.json).toBe('{"content":"half a sen"}')
    expect(found?.at).toBeGreaterThan(0)
  })

  it('refuses a slug with no row, so the editor can say localStorage is the only copy', () => {
    expect(putAutosave('post', 'never-saved', '{}')).toBe(false)
    expect(getAutosave('post', 'never-saved')).toBeNull()
  })

  it('does the same for pages', async () => {
    await savePage({ slug: 'about', title: 'About', status: 'published', content: 'Live text.' })
    expect(putAutosave('page', 'about', '{"content":"draft"}')).toBe(true)
    expect(getAutosave('page', 'about')?.json).toBe('{"content":"draft"}')
  })

  it('is cleared explicitly', async () => {
    await savePost(PUBLISHED)
    putAutosave('post', PUBLISHED.slug, '{}')
    clearAutosave('post', PUBLISHED.slug)
    expect(getAutosave('post', PUBLISHED.slug)).toBeNull()
  })
})

describe('THE PROMISE: an autosave never reaches a reader', () => {
  it('leaves the published body exactly where it was', async () => {
    await savePost(PUBLISHED)
    putAutosave('post', PUBLISHED.slug, JSON.stringify({ content: 'half a sen' }))

    const post = await getPost(PUBLISHED.slug)
    expect(post?.content).toBe(PUBLISHED.content)
    // Not merely "not equal to the snapshot" — the snapshot's text must not appear at all.
    expect(post?.content).not.toContain('half a sen')
  })

  it('leaves a published PAGE alone the same way', async () => {
    await savePage({ slug: 'about', title: 'About', status: 'published', content: 'Live text.' })
    putAutosave('page', 'about', JSON.stringify({ content: 'scratch' }))
    const page = await getPage('about')
    expect(page?.content).toBe('Live text.')
    expect(page?.content).not.toContain('scratch')
  })

  it('does not move updatedAt, which is when the piece was SAVED', async () => {
    await savePost(PUBLISHED)
    const before = (await getPost(PUBLISHED.slug))?.updatedAt
    putAutosave('post', PUBLISHED.slug, '{"content":"typing"}')
    expect((await getPost(PUBLISHED.slug))?.updatedAt).toBe(before)
  })

  it('does not resurrect a piece that is in the Trash', async () => {
    await savePost(PUBLISHED)
    const { deletePost } = await import('@/content/posts')
    await deletePost(PUBLISHED.slug)
    expect(putAutosave('post', PUBLISHED.slug, '{}')).toBe(false)
  })
})

describe('a real save retires the snapshot', () => {
  it('clears it, so nobody is offered the older text back', async () => {
    await savePost(PUBLISHED)
    putAutosave('post', PUBLISHED.slug, '{"content":"an older thought"}')
    await savePost({ ...PUBLISHED, content: 'The finished sentence.' }, PUBLISHED.slug)
    expect(getAutosave('post', PUBLISHED.slug)).toBeNull()
  })

  it('clears a page snapshot too', async () => {
    await savePage({ slug: 'about', title: 'About', status: 'published', content: 'One.' })
    putAutosave('page', 'about', '{"content":"two"}')
    await savePage({ slug: 'about', title: 'About', status: 'published', content: 'Two.' }, 'about')
    expect(getAutosave('page', 'about')).toBeNull()
  })

  it('clears it even when the save came from somewhere that is not the editor', async () => {
    // The MCP server and the WordPress importer both write through `savePost`. This is why
    // the clear lives in there rather than in the HTTP route.
    await savePost(PUBLISHED)
    putAutosave('post', PUBLISHED.slug, '{"content":"stale"}')
    await savePost({ ...PUBLISHED, title: 'Renamed by a connector' }, PUBLISHED.slug)
    expect(getAutosave('post', PUBLISHED.slug)).toBeNull()
  })
})
