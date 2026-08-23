// The excerpt job's one promise: it fills what the AUTHOR left blank, and loses every
// race to a human on purpose.

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one } from '@/store/query'
import { saveIntegrationKeys } from '@/store/integration-keys'
import { savePost, getPost } from '@/content/posts'
import { writeExcerpt } from './ai-excerpt'

const DIR = './.tmp/test-ai-excerpt'
freshDatabase(DIR)
const realFetch = globalThis.fetch

beforeEach(() => {
  for (const t of ['posts', 'integration_keys', 'settings', 'post_revisions']) {
    try { db().run(`delete from ${t}`) } catch { /* table may not exist */ }
  }
})
afterEach(() => { globalThis.fetch = realFetch })
afterAll(() => dropDatabase(DIR))

const answer = (text: string) =>
  (async () => new Response(JSON.stringify({ content: [{ type: 'text', text }] }))) as unknown as typeof fetch

const excerptOf = (slug: string) => one<{ excerpt: string }>(`select excerpt from posts where slug = ?`, slug)?.excerpt

describe('writeExcerpt', () => {
  it('replaces the mechanical fallback on a published post, via the savePost hook', async () => {
    await saveIntegrationKeys({ aiProvider: 'anthropic', aiApiKey: 'sk-test' })
    globalThis.fetch = answer('A written excerpt, not a truncation.')
    await savePost({ title: 'Quiet post', slug: 'quiet-post', status: 'published', content: 'Body words '.repeat(30) })
    // the hook is fire-and-forget; give the microtask queue one beat
    await new Promise((r) => setTimeout(r, 50))
    expect(excerptOf('quiet-post')).toBe('A written excerpt, not a truncation.')
  })

  it('never touches an excerpt the author wrote', async () => {
    await saveIntegrationKeys({ aiProvider: 'anthropic', aiApiKey: 'sk-test' })
    globalThis.fetch = answer('Should not appear.')
    await savePost({ title: 'Authored', slug: 'authored', status: 'published', content: 'Body.', excerpt: 'My own words.' })
    await new Promise((r) => setTimeout(r, 50))
    expect(excerptOf('authored')).toBe('My own words.')
  })

  it('loses the race when the author edits between publish and answer', async () => {
    const post = await savePost({ title: 'Raced', slug: 'raced', status: 'published', content: 'Body.' })
    // The author types an excerpt while the model is still thinking:
    const current = await getPost('raced')
    await savePost({ ...current!, excerpt: 'Typed meanwhile.' }, 'raced')
    await writeExcerpt('raced', post.excerpt ?? '', 'Body.')
    expect(excerptOf('raced')).toBe('Typed meanwhile.')
  })

  it('does nothing for a draft, and nothing without a key', async () => {
    globalThis.fetch = answer('Never.')
    await savePost({ title: 'Draft', slug: 'draft-post', status: 'draft', content: 'Body words here.' })
    await new Promise((r) => setTimeout(r, 50))
    expect(excerptOf('draft-post')).not.toBe('Never.')
  })
})
