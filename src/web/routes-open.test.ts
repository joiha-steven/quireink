// EVERY ROUTE THE RUNNING APP REGISTERS, ASKED WITHOUT A SESSION.
//
// `scripts/checks/routes-guarded.ts` is the other half of this and reads the SOURCE: it makes
// mounting a write route outside the owner-gated group a build failure. It cannot say anything
// about a GET, and a GET is how owner data leaves a server — a screen, a JSON endpoint, a file
// listing. It also cannot say what the app actually answers, only where a line was written.
//
// So this asks. Every method and path Hono knows about, with no cookie, and the answer has to
// be one of: not 200, or a path on the list below. A new route that answers 200 to a stranger
// turns this red, which makes it a decision rather than a thing to notice in review — the same
// shape as that file's `PUBLIC_WRITES`, and for the same reason.
//
// ⚠️ THE COUNTER-TEST AT THE FOOT IS LOAD-BEARING. A sweep that finds nothing because nothing
// renders proves nothing, and that is a real failure mode here: one missing table and every
// admin screen answers 500, which this would read as a clean bill of health.

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { clearCache } from '@/server/cache'
import { savePost } from '@/content/posts'

const DIR = './.tmp/test-routes-open'
freshDatabase(DIR)
const app = createApp()
let cookie = ''

beforeAll(async () => {
  resetSecretCache()
  resetLimits()
  // ⚠️ THE PAGE CACHE IS PER PROCESS AND THE TEST FILES SHARE ONE. Without this, `/` and
  // `/archive` are served from whatever the file that ran before this one rendered, against
  // ITS database — which passes alone and fails in the suite, the worst way for a test to be
  // wrong. Measured 2026-09-19: these two files, in this order.
  clearCache()
  const user = await createUser({
    username: 'hung', email: 'owner@example.com', password: 'wandering violet cassette',
  })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
  await savePost({
    title: 'Bài', slug: 'bai', content: 'Thân bài.', status: 'published',
    date: new Date(Date.now() - 3_600_000).toISOString(),
  } as Parameters<typeof savePost>[0])
})
afterAll(() => dropDatabase(DIR))

/**
 * What a stranger may be answered 200 by: the reader's own site, the files it loads, and the
 * public API a reader's browser calls. Anything else answering 200 without a cookie is the
 * finding, and adding a line here should feel like the decision it is.
 */
const PUBLIC_EXACT = new Set([
  '/', '/archive', '/notes', '/bai', '/login', '/og', '/search',
  // A browser hint file, and the endpoint a sending site GETs to confirm it is there.
  '/speculation-rules.json', '/webmention',
  '/feed.xml', '/robots.txt', '/llms.txt', '/manifest.webmanifest', '/sitemap.xml',
  // The notebook subscribes like the blog does, and both do it in two formats.
  '/feed.json', '/notes/feed.xml', '/notes/feed.json',
  '/api/health', '/api/search', '/api/search/index', '/api/md/bai',
  '/api/comments', '/api/comments/me', '/api/comments/stamp', '/api/pen/me',
  '/api/newsletter/confirm', '/api/newsletter/open', '/api/newsletter/unsubscribe',
  '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource',
])

/** The static families, by shape rather than by name, so a new font is not a test failure. */
const PUBLIC_SHAPES = [/^\/fonts\//, /\.(css|js|png|ico|svg|webmanifest|txt|xml|woff2?)$/]

/** `:slug` and friends, filled with something this instance actually has. */
const fill = (path: string): string =>
  path
    .replace(/:slug\??/g, 'bai')
    .replace(/:id\??/g, '1')
    .replace(/:[A-Za-z]+\??/g, 'x')

describe('what a stranger can open', () => {
  it('nothing but the reader’s own site and the files it loads', async () => {
    const seen = new Set<string>()
    const unexpected: string[] = []
    let asked = 0

    for (const route of app.routes) {
      const key = `${route.method} ${route.path}`
      if (seen.has(key) || route.method === 'ALL' || route.path.includes('*')) continue
      seen.add(key)
      const url = fill(route.path)
      if (url.includes(':')) continue
      asked += 1

      const res = await app.request(url, {
        method: route.method,
        headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
        body: route.method === 'GET' || route.method === 'HEAD' ? undefined : '{}',
      })
      if (res.status !== 200) continue
      if (PUBLIC_EXACT.has(url) || PUBLIC_SHAPES.some((re) => re.test(url))) continue
      unexpected.push(`${route.method} ${url} answered 200 with ${(await res.text()).length} bytes`)
    }

    // A sweep that asked almost nothing would pass on an empty list.
    expect(asked).toBeGreaterThan(100)
    expect(unexpected).toEqual([])
  })

  it('and no answer to a stranger carries a secret, whatever its status', async () => {
    const SECRETS = /password_hash|totp_secret|smtp_pass|ai_api_key|recovery_code|token_hash/i
    const leaks: string[] = []
    for (const url of ['/', '/bai', '/login', '/api/health', '/feed.xml', '/api/search?q=bai', '/archive']) {
      const body = await (await app.request(url)).text()
      if (SECRETS.test(body)) leaks.push(url)
    }
    expect(leaks).toEqual([])
  })

  it('opens the admin for a session, which is what makes the sweep above mean something', async () => {
    const opened: string[] = []
    for (const url of ['/admin', '/admin/analytics', '/admin/settings', '/admin/write']) {
      const res = await app.request(url, { headers: { cookie } })
      if (res.status === 200 && (await res.text()).length > 2000) opened.push(url)
    }
    expect(opened).toEqual(['/admin', '/admin/analytics', '/admin/settings', '/admin/write'])
  })
})
