// SEVERAL PIECES, ONE REQUEST — and the three things that are the whole reason it exists.
//
// The endpoint's behaviour (pieces move, missing ones are named) is the easy half and would be
// satisfied by the fifty-parallel-DELETEs it replaces. What would NOT be are the counts: one
// cache flush, one activity row, and no revision burned on a status flip. Each of those is
// asserted here against a number, because each of them is invisible from the outside and each
// of them was the actual cost.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { onFlush } from '@/server/cache'
import { getActivity } from '@/server/activity'
import { getIndex, getPost, savePost } from '@/content/posts'
import { getPageIndex, savePage } from '@/content/pages'
import { getNoteIndex, saveNote } from '@/content/notes'
import { getRevisions } from '@/content/revisions'
import { saveSettings } from '@/content/settings'
import { payload } from '@/test/api'
import { BULK_MAX, type BulkPiece } from '@/web/admin/content-bulk'

const DIR = './.tmp/test-admin-bulk'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
let cookie = ''
const PAST = '2020-01-01T00:00:00.000Z'

// Counting flushes rather than trusting a comment. The hook list is module-level and shared
// with whatever else runs in this process, so the counter is read only across a single call.
let flushes = 0
onFlush(() => { flushes += 1 })

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'posts', 'pages', 'notes', 'post_terms', 'post_revisions', 'activity_log', 'settings', 'server_secrets']) {
    db().run(`delete from ${t}`)
  }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await saveSettings({ title: 'My Blog' })
})

const bulk = (body: unknown) =>
  app.request('/api/content/bulk', {
    method: 'POST',
    headers: { cookie, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

type Answer = { done: BulkPiece[]; failed: (BulkPiece & { reason: string })[] }

describe('several pieces, one request', () => {
  it('bins posts, pages and notes together, and they leave the live lists', async () => {
    await savePost({ title: 'Mot', content: 'x', status: 'published', date: PAST })
    await savePost({ title: 'Hai', content: 'x', status: 'published', date: PAST })
    await savePage({ title: 'Ba', content: 'x', status: 'published' })
    await saveNote({ title: 'Bon', content: 'x', status: 'published', date: PAST })

    const res = await bulk({ action: 'trash', pieces: [
      { kind: 'post', slug: 'mot' }, { kind: 'page', slug: 'ba' }, { kind: 'note', slug: 'bon' },
    ] })
    expect(res.status).toBe(200)
    const answer = await payload<Answer>(res)
    expect(answer.done).toHaveLength(3)
    expect(answer.failed).toEqual([])

    // The counter-test for the three lines above: the post NOT named is still there. Without
    // it, a route that emptied every table would pass.
    expect((await getIndex()).map((p) => p.slug)).toEqual(['hai'])
    expect(await getPageIndex()).toHaveLength(0)
    expect(await getNoteIndex()).toHaveLength(0)
  })

  it('publishes and unpublishes, and says nothing changed when nothing had to', async () => {
    await savePost({ title: 'Nhap', content: 'x', status: 'draft', date: PAST })
    await savePost({ title: 'Da dang', content: 'x', status: 'published', date: PAST })

    const up = await payload<Answer>(await bulk({ action: 'publish', pieces: [
      { kind: 'post', slug: 'nhap' }, { kind: 'post', slug: 'da-dang' },
    ] }))
    expect(up.done).toHaveLength(2)
    expect((await getPost('nhap'))!.status).toBe('published')
    expect((await getPost('da-dang'))!.status).toBe('published')

    const down = await payload<Answer>(await bulk({ action: 'draft', pieces: [
      { kind: 'post', slug: 'nhap' },
    ] }))
    expect(down.done).toHaveLength(1)
    expect((await getPost('nhap'))!.status).toBe('draft')
    expect((await getPost('da-dang'))!.status).toBe('published')
  })

  it('changes a page and a note too, and leaves everything else on them alone', async () => {
    // ⚠️ THREE KINDS, THREE BRANCHES in `setStatus`, and only the post one was exercised. A
    // save here passes the WHOLE piece back in, because every `save*` normalises a partial
    // input into a complete one — so a branch that named two fields would blank the title and
    // the body of everything it touched, and a test that only checked `status` would say it
    // worked.
    await savePage({ title: 'Gioi thieu', content: 'Ve toi.', status: 'draft',
      featuredImage: '/uploads/media/about.webp' })
    await saveNote({ title: 'Cay but', content: 'Ghi lai.', status: 'draft', date: PAST,
      sourceUrl: 'https://example.com/reed', quote: 'every stroke starts wet' })

    const answer = await payload<Answer>(await bulk({ action: 'publish', pieces: [
      { kind: 'page', slug: 'gioi-thieu' }, { kind: 'note', slug: 'cay-but' },
    ] }))
    expect(answer.done).toHaveLength(2)

    const { getPage } = await import('@/content/pages')
    const { getNote } = await import('@/content/notes')
    const page = (await getPage('gioi-thieu'))!
    expect(page.status).toBe('published')
    expect(page.title).toBe('Gioi thieu')
    expect(page.content).toBe('Ve toi.')
    expect(page.featuredImage).toBe('/uploads/media/about.webp')

    const note = (await getNote('cay-but'))!
    expect(note.status).toBe('published')
    expect(note.title).toBe('Cay but')
    expect(note.content).toBe('Ghi lai.')
    expect(note.quote).toBe('every stroke starts wet')
    expect(note.sourceUrl).toBe('https://example.com/reed')
    expect(note.date).toBe(PAST)
  })

  it('names the piece it could not find, and moves the rest anyway', async () => {
    await savePost({ title: 'That', content: 'x', status: 'draft', date: PAST })
    const answer = await payload<Answer>(await bulk({ action: 'publish', pieces: [
      { kind: 'post', slug: 'that' }, { kind: 'post', slug: 'khong-co' },
    ] }))
    expect(answer.done).toEqual([{ kind: 'post', slug: 'that' }])
    expect(answer.failed).toEqual([{ kind: 'post', slug: 'khong-co', reason: 'not_found' }])
    // Nineteen of twenty moved is nineteen the owner does not have to do again.
    expect((await getPost('that'))!.status).toBe('published')
  })
})

describe('the three costs this route exists to remove', () => {
  it('empties the page cache ONCE for a whole selection', async () => {
    for (const n of ['a', 'b', 'c', 'd', 'e']) {
      await savePost({ title: n, content: 'x', status: 'published', date: PAST })
    }
    flushes = 0
    await bulk({ action: 'trash', pieces: ['a', 'b', 'c', 'd', 'e'].map((slug) => ({ kind: 'post', slug })) })
    // Five pieces, ONE flush — and it is the owner gate's, not this route's: `web/guard.ts`
    // flushes on the way out of every 2xx write (Invariant 1). Five DELETEs were five of
    // them, and on an install with a CDN configured each is also a purge.
    expect(flushes).toBe(1)

    // The counter-test, and the measurement this route was built on: the same five pieces the
    // old way. Five requests, five flushes. Without this the line above is satisfied by a
    // suite in which nothing flushes at all.
    for (const n of ['f', 'g', 'h', 'i', 'j']) {
      await savePost({ title: n, content: 'x', status: 'published', date: PAST })
    }
    flushes = 0
    await Promise.all(['f', 'g', 'h', 'i', 'j'].map((slug) => app.request(`/api/posts/${slug}`, {
      method: 'DELETE',
      headers: { cookie, 'sec-fetch-site': 'same-origin' },
    })))
    expect(flushes).toBeGreaterThan(1)
  })

  it('writes no activity row when it found nothing to move', async () => {
    db().run(`delete from activity_log`)
    const answer = await payload<Answer>(await bulk({ action: 'publish', pieces: [
      { kind: 'post', slug: 'khong-ton-tai' },
    ] }))
    expect(answer.done).toEqual([])
    // A press that found nothing is not an event in the blog's history. (The gate still
    // flushes, because the request succeeded — that is its rule and it is deliberately blunt.)
    expect(await getActivity(50)).toHaveLength(0)
  })

  it('writes ONE activity row, naming the verb in the heading and the pieces under it', async () => {
    for (const n of ['a', 'b', 'c'] as const) {
      await savePost({ title: n, content: 'x', status: 'draft', date: PAST })
    }
    db().run(`delete from activity_log`)
    await bulk({ action: 'publish', pieces: ['a', 'b', 'c'].map((slug) => ({ kind: 'post', slug })) })
    const rows = await getActivity(50)
    expect(rows).toHaveLength(1)
    // The HEADING carries the verb. `web/admin/ops.ts` records what it cost to have one kind
    // stand for four importers: nobody reads a detail line to check a heading.
    expect(rows[0]!.action).toBe('content.publish')
    // The detail is the sentence's OBJECT, through `{t}` in the dictionary — the pieces, not a
    // record of its own. It carried `publish: 3 — …` for an afternoon and the log dropped the
    // whole thing, because `logSentence` removes the placeholder's slot when the pattern has
    // none and that pattern had none.
    expect(rows[0]!.detail).toBe('post:a, post:b, post:c')

    // Past eight named pieces it stops naming and counts the rest. NO COUNT IN THE SENTENCE:
    // half these languages need a plural form for one, which is the argument `selectPieces`
    // already lost; `+N` carries the same fact and needs no grammar.
    for (const n of ['d', 'e', 'f', 'g', 'h', 'i', 'j'] as const) {
      await savePost({ title: n, content: 'x', status: 'draft', date: PAST })
    }
    db().run(`delete from activity_log`)
    await bulk({ action: 'draft', pieces: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((slug) => ({ kind: 'post', slug })) })
    const long = (await getActivity(50))[0]!.detail
    expect(long.split(', ')).toHaveLength(8)
    expect(long).toContain('+2')

    // And the other two verbs get their own heading rather than sharing one.
    db().run(`delete from activity_log`)
    await bulk({ action: 'trash', pieces: [{ kind: 'post', slug: 'a' }] })
    expect((await getActivity(50))[0]!.action).toBe('content.trash')
  })

  it('burns no revision on a status flip', async () => {
    await savePost({ title: 'Bai', content: 'ban dau', status: 'draft', date: PAST })
    await savePost({ title: 'Bai', slug: 'bai', content: 'sua lan mot', status: 'draft', date: PAST }, 'bai')
    const before = (await getRevisions('bai')).length
    expect(before).toBeGreaterThan(0)

    await bulk({ action: 'publish', pieces: [{ kind: 'post', slug: 'bai' }] })
    // ⚠️ Only three revisions are kept per post. A bulk publish that snapshots every piece
    // would push the owner's real earlier drafts out with copies of the current body that
    // differ by one word — and `projection` counts status as a change, so this is what
    // `savePost` does unless it is told otherwise.
    expect((await getRevisions('bai')).length).toBe(before)
    expect((await getPost('bai'))!.status).toBe('published')
    // The counter-test: an ordinary save still pushes one, so the line above is about this
    // route rather than about a revision system that stopped working.
    await savePost({ title: 'Bai', slug: 'bai', content: 'sua lan hai', status: 'published', date: PAST }, 'bai')
    expect((await getRevisions('bai')).length).toBe(before + 1)
  })
})

describe('what it refuses', () => {
  it('refuses more than it will do in one press, with the number in the answer', async () => {
    const pieces = Array.from({ length: BULK_MAX + 1 }, (_, i) => ({ kind: 'post', slug: `p${i}` }))
    const res = await bulk({ action: 'trash', pieces })
    expect(res.status).toBe(413)
    expect(await res.text()).toContain(String(BULK_MAX))
    // Exactly at the ceiling is allowed: a limit that refuses its own number is off by one.
    expect((await bulk({ action: 'trash', pieces: pieces.slice(0, BULK_MAX) })).status).toBe(200)
  })

  it('refuses a verb it does not know and a piece it cannot read', async () => {
    expect((await bulk({ action: 'burn', pieces: [{ kind: 'post', slug: 'a' }] })).status).toBe(400)
    expect((await bulk({ action: 'trash', pieces: [] })).status).toBe(400)
    expect((await bulk({ action: 'trash', pieces: [{ kind: 'widget', slug: 'a' }] })).status).toBe(400)
    expect((await bulk({ action: 'trash', pieces: [{ kind: 'post', slug: '' }] })).status).toBe(400)
    expect((await bulk({ action: 'trash' })).status).toBe(400)
  })

  it('is owner-gated', async () => {
    // 403, not 401: the gate checks the origin BEFORE the session, same as every write.
    expect((await app.request('/api/content/bulk', { method: 'POST' })).status).toBe(403)
  })
})
