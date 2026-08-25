// Prerendering is offered to browsers, so the shape has to be right or it is silently
// ignored — and a feature that fails silently is one nobody notices is gone. That is
// exactly what happened before it was shipped at all.
import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { savePost } from '@/content/posts'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-speculation'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()

describe('the rules document', () => {
  it('is served under the content type browsers require', async () => {
    const res = await app.request('/speculation-rules.json')
    expect(res.status).toBe(200)
    // Not application/json. A browser refuses the document under any other type, so this
    // assertion is the difference between the feature working and doing nothing at all.
    expect(res.headers.get('content-type')).toBe('application/speculationrules+json')
  })

  // The two eagerness values are the feature. `moderate` prefetch would reintroduce the
  // 200ms hover dwell this was changed to escape, and `eager` prerender would render every
  // card a reader scrolls past — so both are pinned, in both directions.
  it('prefetches every link eagerly, and prerenders only on hover', async () => {
    const rules = await rulesDocument()
    expect(rules.prefetch[0]!.eagerness).toBe('eager')
    expect(rules.prerender[0]!.eagerness).toBe('moderate')
  })

  it('never speculates on the paths where a GET is not free, under EITHER rule', async () => {
    const rules = await rulesDocument()
    // Both, not just prerender: a prefetch of /preview burns a token exactly as a prerender
    // does, and it is the cheap rule that now points at every link on the page.
    for (const rule of [...rules.prefetch, ...rules.prerender]) {
      const json = JSON.stringify(rule.where)
      for (const excluded of ['/admin/*', '/api/*', '/uploads/*', '/preview/*', '/og*']) {
        expect(json).toContain(excluded)
      }
      // The author's own markup, honoured: a nofollow or a download link is not a page.
      expect(json).toContain('[rel~=nofollow]')
      expect(json).toContain('[download]')
    }
  })
})

type Rule = { eagerness: string; where: { and: unknown[] } }

async function rulesDocument(): Promise<{ prefetch: Rule[]; prerender: Rule[] }> {
  return await (await app.request('/speculation-rules.json')).json() as
    { prefetch: Rule[]; prerender: Rule[] }
}

describe('the header', () => {
  it('is on a public page, and points at the document', async () => {
    await savePost({ title: 'A Post', slug: 'a-post', status: 'published',
      date: '2020-01-01T00:00:00.000Z' })
    const res = await app.request('/a-post')
    expect(res.headers.get('speculation-rules')).toBe('"/speculation-rules.json"')
  })

  // Prerendering the admin would run owner-only JavaScript, and against a shell that
  // fetches on mount, for a page the owner merely hovered a link to.
  it('is NOT on the owner\'s surfaces', async () => {
    for (const path of ['/admin', '/login', '/api/comments?post=a-post']) {
      expect((await app.request(path)).headers.get('speculation-rules')).toBeNull()
    }
  })

  it('is NOT on a 404, which is not a page worth rendering ahead', async () => {
    const res = await app.request('/nothing-is-here')
    expect(res.status).toBe(404)
    expect(res.headers.get('speculation-rules')).toBeNull()
  })

  // The whole point of the header form: the public site still ships no inline script a
  // browser would RUN, so the recommended CSP can keep refusing `unsafe-inline`. The
  // structured-data block is not one — `script-src` governs execution, and a
  // `type="application/ld+json"` block is never executed. Measured in a real browser under
  // `script-src 'self'` on 2026-08-25: parsed fine, console clean.
  it('adds no executable inline script to the page', async () => {
    const html = await (await app.request('/a-post')).text()
    expect(html).not.toContain('speculationrules')
    expect(html).not.toMatch(/<script(?![^>]*(?:\ssrc=|\stype="application\/ld\+json"))[^>]*>/)
  })
})
