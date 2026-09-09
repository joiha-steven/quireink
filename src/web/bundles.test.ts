// Which JavaScript a page names, and the switch behind two of the bundles.
//
// Split out of app.test.ts at the 400-line cap. The seam is real: this is the one property
// of the article page that depends on the owner's SWITCHES rather than on the post, and it
// needs the page cache emptied by hand between two settings states.

import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-bundles'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string): Promise<Response> => app.request(path)
const PAST = '2020-01-01T00:00:00.000Z'

beforeEach(() => {
  clearCache()
  for (const t of ['posts', 'pages', 'post_terms', 'post_revisions', 'settings']) db().run(`delete from ${t}`)
})

describe('the bundles an article names', () => {
  it('ships deferred scripts only, and a switch-gated bundle only when its switch is on', async () => {
    await savePost({ title: 'Quiet', content: 'body', status: 'published', date: PAST })
    const { features, comments } = await getSettings()
    await saveSettings({ features: { ...features, bookMode: true, readerPen: true }, comments: { ...comments, enabled: true } })
    let html = await get('/quiet').then((r) => r.text())
    // The budget is a number, not a vibe: the moment a sixth bundle or an inline block
    // appears on an article page, this fails. `core` is the analytics beacon, which every
    // public page carries; `post` is the islands every article has; the other three ride
    // ONLY behind their switches — two measured 2026-09-06 at three quarters of the old
    // post.js, and the reader's pen since 2026-09-09 (ADR 0043).
    //
    // EXECUTABLE scripts, which is the property the recommended CSP depends on. A
    // `type="application/ld+json"` block is a DATA block: the browser never executes it and
    // `script-src 'self'` does not touch it. Measured 2026-08-25 in a real browser against a
    // page carrying `script-src 'self'` with no `'unsafe-inline'` — the block parsed and the
    // console stayed empty. Counting every `<script` instead made this test fail the day
    // structured data arrived, which is a test failing for being imprecise, not for a bug.
    const executable = (h: string) => h.match(/<script(?![^>]*\btype="application\/ld\+json")/g) ?? []
    expect(executable(html).length).toBe(5)
    expect(html).toMatch(/<script src="\/assets\/core\.[a-z0-9]+\.js" defer><\/script>/)
    expect(html).toMatch(/<script src="\/assets\/post\.[a-z0-9]+\.js" defer><\/script>/)
    expect(html).toMatch(/<script src="\/assets\/book-mode\.[a-z0-9]+\.js" defer><\/script>/)
    expect(html).toMatch(/<script src="\/assets\/comment-thread\.[a-z0-9]+\.js" defer><\/script>/)
    expect(html).toMatch(/<script src="\/assets\/reader-pen\.[a-z0-9]+\.js" defer><\/script>/)
    // No inline block that a browser would RUN.
    expect(html).not.toMatch(/<script(?![^>]*\b(?:src=|type="application\/ld\+json"))/)
    expect(html).not.toContain('onload=')
    expect(html).not.toContain('onclick=')

    // All three switches off: no gated bundle is named, so none is ever fetched. The page
    // cache is emptied by hand because this write does not pass through the owner gate,
    // which is what empties it in production (Invariant 1).
    await saveSettings({ features: { ...features, bookMode: false, readerPen: false }, comments: { ...comments, enabled: false } })
    clearCache()
    html = await get('/quiet').then((r) => r.text())
    expect(executable(html).length).toBe(2)
    expect(html).not.toContain('/assets/book-mode.')
    expect(html).not.toContain('/assets/comment-thread.')
    await saveSettings({ features, comments })
  })

})
