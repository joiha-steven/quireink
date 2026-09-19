// A POST DATED IN THE FUTURE, ASKED FOR ON EVERY PUBLIC SURFACE AT ONCE.
//
// There is no `scheduled` status here: a post is `published` with a date, and the read layer
// hides it until that date (`isPublicallyVisible`). That is one rule, and it has to be obeyed
// by every list, feed, index and page separately — which is exactly the shape of a rule that
// gets obeyed in nine places and forgotten in the tenth. The sitemap forgot series entirely
// until 2026-09-19, and nothing said so.
//
// So this asks all of them at once and looks for the words. A surface added later is a surface
// this file does not know about, which is the honest limit of it; what it does catch is a
// surface that stops honouring the rule, and the list below is cheap to extend.
//
// ⚠️ THE THIRD TEST IS LOAD-BEARING. Every assertion here is "the words are absent", and words
// are absent from a page that failed to render too. The live post proves the surfaces work.

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { savePost } from '@/content/posts'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { clearCache } from '@/server/cache'

const DIR = './.tmp/test-scheduled-hidden'
freshDatabase(DIR)
const app = createApp()

/** Distinctive and unaccented, so a match is a match and not a normalisation artefact. */
const HIDDEN_TITLE = 'Bimat Chuaphathanh'
const HIDDEN_SLUG = 'bimat-chuaphathanh'
const HIDDEN_BODY = 'Noidung hengio khongduoclo.'
const LIVE_SLUG = 'bai-da-len'

const SURFACES = [
  '/', '/archive', '/feed.xml', '/sitemap.xml', '/notes',
  '/category/ghi-chep', '/tag/the', '/category/ghi-chep/feed.xml', '/tag/the/feed.xml',
  '/search?q=bimat', '/search?q=Chuaphathanh', '/api/search?q=bimat', '/api/search/index',
  '/page/2', '/robots.txt',
]

beforeAll(async () => {
  resetSecretCache()
  resetLimits()
  // ⚠️ THE PAGE CACHE IS PER PROCESS AND THE TEST FILES SHARE ONE. Without this, `/` and
  // `/archive` are served from whatever the file that ran before this one rendered, against
  // ITS database — which passes alone and fails in the suite, the worst way for a test to be
  // wrong. Measured 2026-09-19: these two files, in this order.
  clearCache()
  const hour = 3_600_000
  await savePost({
    title: 'Bai da len', slug: LIVE_SLUG, content: 'Than bai.', status: 'published',
    date: new Date(Date.now() - hour).toISOString(), categories: ['Ghi chep'], tags: ['the'],
  } as Parameters<typeof savePost>[0])
  await savePost({
    title: HIDDEN_TITLE, slug: HIDDEN_SLUG, content: HIDDEN_BODY, excerpt: HIDDEN_BODY,
    status: 'published', date: new Date(Date.now() + hour).toISOString(),
    categories: ['Ghi chep'], tags: ['the'],
  } as Parameters<typeof savePost>[0])
})
afterAll(() => dropDatabase(DIR))

describe('a post an hour from now', () => {
  it('is on none of the public surfaces', async () => {
    const leaks: string[] = []
    for (const url of SURFACES) {
      const res = await app.request(url)
      if (res.status >= 400) continue
      const body = await res.text()
      const found = [HIDDEN_TITLE, HIDDEN_SLUG, HIDDEN_BODY, 'Bimat', 'hengio'].find((w) => body.includes(w))
      if (found) leaks.push(`${url} (${res.status}) shows ${JSON.stringify(found)}`)
    }
    expect(leaks).toEqual([])
  })

  it('has no page of its own yet', async () => {
    expect((await app.request(`/${HIDDEN_SLUG}`)).status).toBeGreaterThanOrEqual(400)
  })

  it('while the post that IS live appears on the surfaces that list posts', async () => {
    const seen: string[] = []
    for (const url of ['/', '/archive', '/feed.xml', '/sitemap.xml', '/category/ghi-chep']) {
      const res = await app.request(url)
      if (res.status < 400 && (await res.text()).includes(LIVE_SLUG)) seen.push(url)
    }
    expect(seen).toEqual(['/', '/archive', '/feed.xml', '/sitemap.xml', '/category/ghi-chep'])
  })
})
