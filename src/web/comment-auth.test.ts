// Reader sign-in, driven through the real router. Google itself is never called: the
// interesting behaviour is everything AROUND the exchange, and all of it is reachable
// without a network.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { saveSettings } from '@/content/settings'
import { saveIntegrationKeys } from '@/store/integration-keys'
import { commenterCookie, issueCommenter } from '@/comments/commenter'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-comment-auth'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const get = async (path: string, headers?: Record<string, string>): Promise<Response> =>
  app.request(path, { headers })

const PAST = '2020-01-01T00:00:00.000Z'

async function configured(): Promise<void> {
  await saveSettings({ comments: { enabled: true, turnstile: false, googleAuth: true } })
  await saveIntegrationKeys({ googleClientId: 'client-id', googleClientSecret: 'client-secret' })
}

beforeEach(async () => {
  clearCache()
  for (const t of ['posts', 'comments', 'settings', 'integration_keys']) db().run(`delete from ${t}`)
})

describe('GET /comment-auth/google', () => {
  it('sends the reader to Google with the scopes and state it needs', async () => {
    await configured()
    const res = await get('/comment-auth/google?return=/a-post')
    expect(res.status).toBe(302)

    const target = new URL(res.headers.get('location')!)
    expect(target.origin + target.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(target.searchParams.get('client_id')).toBe('client-id')
    expect(target.searchParams.get('scope')).toBe('openid email profile')
    expect(target.searchParams.get('response_type')).toBe('code')
    expect(target.searchParams.get('redirect_uri')).toEndWith('/comment-auth/google/callback')

    // The state has to be in the cookie too, or the callback has nothing to compare against.
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain(target.searchParams.get('state')!)
    expect(cookie).toContain('HttpOnly')
  })

  // The secret never leaves the server. The client id does, by necessity.
  it('never puts the client secret in the redirect', async () => {
    await configured()
    const res = await get('/comment-auth/google')
    expect(res.headers.get('location')).not.toContain('client-secret')
  })

  it('bounces back instead of leaving when the feature is off or the keys are missing', async () => {
    await saveSettings({ comments: { enabled: true, turnstile: false, googleAuth: true } })
    // Toggle on, no keys.
    let res = await get('/comment-auth/google?return=/a-post')
    expect(res.headers.get('location')).toBe('/a-post#comment-auth-error')

    // Keys, toggle off.
    await saveIntegrationKeys({ googleClientId: 'id', googleClientSecret: 'secret' })
    await saveSettings({ comments: { enabled: true, turnstile: false, googleAuth: false } })
    res = await get('/comment-auth/google?return=/a-post')
    expect(res.headers.get('location')).toBe('/a-post#comment-auth-error')
  })

  // `//evil.example` starts with a slash, so a "must be relative" check written the obvious
  // way lets it through and the browser reads it as another origin.
  it('refuses to be steered off the site by the return path', async () => {
    await configured()
    for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example']) {
      const res = await get(`/comment-auth/google?return=${encodeURIComponent(bad)}`)
      const cookie = res.headers.get('set-cookie') ?? ''
      const encoded = cookie.split('.')[1]?.split(';')[0] ?? ''
      expect(Buffer.from(encoded, 'base64url').toString('utf8')).toBe('/')
    }
  })
})

describe('GET /comment-auth/google/callback', () => {
  it('refuses a code whose state does not match the cookie, and reaches no exchange', async () => {
    await configured()
    const res = await get(
      '/comment-auth/google/callback?code=abc&state=attacker',
      { cookie: '__Host-quire_comment_oauth=mine.Lw' },
    )
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/#comment-auth-error')
    // No commenter cookie was issued.
    expect(res.headers.get('set-cookie') ?? '').not.toContain('__Host-quire_commenter=ey')
  })

  it('refuses a callback with no state cookie at all', async () => {
    await configured()
    const res = await get('/comment-auth/google/callback?code=abc&state=anything')
    expect(res.headers.get('location')).toBe('/#comment-auth-error')
  })

  it('clears the one-shot state cookie on the way out', async () => {
    await configured()
    const res = await get('/comment-auth/google/callback?code=abc&state=no')
    expect(res.headers.get('set-cookie') ?? '').toContain('__Host-quire_comment_oauth=;')
  })
})

describe('GET /api/comments/me', () => {
  it('is null for a stranger, and never cached', async () => {
    const res = await get('/api/comments/me')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ success: true, data: { commenter: null } })
  })

  it('names a signed-in reader, and does NOT hand back their email', async () => {
    const cookie = commenterCookie(issueCommenter({
      name: 'Reader', email: 'reader@example.com', provider: 'google',
    }))
    const res = await get('/api/comments/me', { cookie: cookie.split(';')[0]! })
    const body = await res.text()
    expect(body).toContain('Reader')
    expect(body).not.toContain('reader@example.com')
  })
})

describe('POST /api/comments as a signed-in reader', () => {
  const comment = async (cookie: string | undefined, body: unknown): Promise<Response> =>
    app.request('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    })

  const signedIn = (name: string, email: string): string =>
    commenterCookie(issueCommenter({ name, email, provider: 'google' })).split(';')[0]!

  it('takes the identity from the cookie and ignores what the body claims', async () => {
    await configured()
    await savePost({ title: 'Post', slug: 'post', status: 'published', date: PAST })

    const res = await comment(signedIn('Real Name', 'real@example.com'), {
      postSlug: 'post', content: 'hello', name: 'Fake Name', email: 'fake@example.com',
      website: 'https://spam.example',
    })
    expect(res.status).toBe(200)

    const row = db().query<{ author_name: string; author_email: string; provider: string; author_website: string | null }, []>(
      `select author_name, author_email, provider, author_website from comments`,
    ).get()!
    expect(row.author_name).toBe('Real Name')
    expect(row.author_email).toBe('real@example.com')
    expect(row.provider).toBe('google')
    // The website field is a link a spammer would love; a signed-in comment carries none.
    expect(row.author_website ?? '').toBe('')
  })

  it('needs no name, email or Turnstile token', async () => {
    await saveSettings({ comments: { enabled: true, turnstile: true, googleAuth: true } })
    await saveIntegrationKeys({
      googleClientId: 'id', googleClientSecret: 'secret', turnstileSecretKey: 'ts-secret',
    })
    await savePost({ title: 'Post', slug: 'post', status: 'published', date: PAST })

    // Turnstile is ON and configured, so an anonymous comment here would have to verify a
    // token against Cloudflare. This one is accepted without the network being touched.
    const res = await comment(signedIn('Reader', 'reader@example.com'), {
      postSlug: 'post', content: 'hello',
    })
    expect(res.status).toBe(200)
  })

  // Turning the feature off has to stop trusting the cookies already handed out, or the
  // switch does nothing until each of them expires a month later.
  it('stops trusting the cookie the moment the owner turns Google sign-in off', async () => {
    await saveSettings({ comments: { enabled: true, turnstile: false, googleAuth: false } })
    await savePost({ title: 'Post', slug: 'post', status: 'published', date: PAST })

    const res = await comment(signedIn('Reader', 'reader@example.com'), {
      postSlug: 'post', content: 'hello',
    })
    expect(res.status).toBe(400) // falls back to the manual path, which wants a name
  })

  it('refuses a forged cookie and falls back to the manual path', async () => {
    await configured()
    await savePost({ title: 'Post', slug: 'post', status: 'published', date: PAST })

    const forged = Buffer.from(JSON.stringify({
      name: 'Impostor', email: 'nobody@example.com', provider: 'google', exp: Date.now() + 60_000,
    })).toString('base64url')
    const res = await comment(`__Host-quire_commenter=${forged}.not-a-signature`, {
      postSlug: 'post', content: 'hello',
    })
    expect(res.status).toBe(400)
    expect(db().query(`select 1 from comments`).all()).toHaveLength(0)
  })
})
