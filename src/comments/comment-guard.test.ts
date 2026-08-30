// The gate's contract: spam goes to the Trash (held, recoverable), a reader's real voice
// is never touched, and doubt sides with the reader.

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { saveIntegrationKeys } from '@/store/integration-keys'
import { savePost } from '@/content/posts'
import { addComment, getCommentTree, getTrashedComments } from '@/comments/comments'
import { guardComment } from './comment-guard'
import { withoutProviderEnv } from '@/test/env'

// This file asserts what happens with NO provider configured; the machine may disagree.
withoutProviderEnv()

const DIR = './.tmp/test-comment-guard'
freshDatabase(DIR)
const realFetch = globalThis.fetch

beforeEach(async () => {
  for (const t of ['posts', 'comments', 'integration_keys', 'settings']) db().run(`delete from ${t}`)
  await savePost({ title: 'Open thread', slug: 'open-thread', status: 'published', content: 'Body.', date: '2020-01-01T00:00:00.000Z' })
  await saveIntegrationKeys({ aiProvider: 'anthropic', aiApiKey: 'sk-test' })
})
afterEach(() => { globalThis.fetch = realFetch })
afterAll(() => dropDatabase(DIR))

const verdict = (text: string) =>
  (async () => new Response(JSON.stringify({ content: [{ type: 'text', text }] }))) as unknown as typeof fetch

const plant = (content: string) =>
  addComment({ postSlug: 'open-thread', parentId: null, provider: 'manual', name: 'Visitor', email: '', content })

describe('guardComment', () => {
  it('holds a SPAM verdict in the Trash, where the owner can restore it', async () => {
    globalThis.fetch = verdict('SPAM')
    const c = await plant('Cheap watches, click here!!!')
    await guardComment(c.id, 'Visitor', 'Cheap watches, click here!!!')
    expect(await getCommentTree('open-thread')).toHaveLength(0)
    expect((await getTrashedComments()).some((t) => t.id === c.id)).toBe(true)
  })

  it('leaves an OK verdict exactly where it was', async () => {
    globalThis.fetch = verdict('OK')
    const c = await plant('Lovely piece, thank you.')
    await guardComment(c.id, 'Visitor', 'Lovely piece, thank you.')
    expect((await getCommentTree('open-thread')).some((n) => n.id === c.id)).toBe(true)
  })

  it('a mumbled or failed answer sides with the reader', async () => {
    globalThis.fetch = verdict('Well, it could perhaps be promotional…')
    const c = await plant('Genuine question about part two?')
    await guardComment(c.id, 'Visitor', 'Genuine question about part two?')
    expect((await getCommentTree('open-thread')).some((n) => n.id === c.id)).toBe(true)
  })

  /**
   * HALF-CONFIGURED IS OFF, and both halves count.
   *
   * The two-sided check had no test: loosening it on 2026-08-30 left all 2377 green. A
   * provider chosen but no key pasted is what the Integrations screen looks like partway
   * through being filled in, and reaching `ask()` from there sends a real reader's comment
   * to a vendor with no credential — a request that cannot succeed and should never have
   * left the machine.
   */
  for (const [what, keys] of [
    ['a provider chosen but no key', { aiProvider: 'anthropic', aiApiKey: '' }],
    ['a key pasted but no provider', { aiProvider: '', aiApiKey: 'sk-test' }],
    ['neither', { aiProvider: '', aiApiKey: '' }],
  ] as const) {
    it(`asks nothing when the integration has ${what}`, async () => {
      await saveIntegrationKeys(keys)
      let called = 0
      globalThis.fetch = (async () => { called++; return new Response('{}') }) as unknown as typeof fetch
      const c = await plant('A perfectly ordinary comment.')
      await guardComment(c.id, 'Visitor', 'A perfectly ordinary comment.')
      expect(called).toBe(0)
      expect((await getCommentTree('open-thread')).some((n) => n.id === c.id)).toBe(true)
    })
  }

  it('the owner can switch the gate off and nothing is even asked', async () => {
    const { saveSettings } = await import('@/content/settings')
    await saveSettings({ ai: { altText: true, excerpt: true, commentGuard: false } })
    let called = 0
    globalThis.fetch = (async () => { called++; return new Response('{}') }) as unknown as typeof fetch
    const c = await plant('Anything at all.')
    await guardComment(c.id, 'Visitor', 'Anything at all.')
    expect(called).toBe(0)
  })
})
