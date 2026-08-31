// The newsletter admin, comment moderation and the integration-key forms.
//
// Nothing here sends real mail: SMTP is unconfigured in the test database, so `sendMail`
// fails and the routes take their failure paths. That is the right default for this
// suite — a test that could send is a test that will, eventually, send to a real address.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one } from '@/store/query'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { payload } from '@/test/api'

const DIR = './.tmp/test-admin-news'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
let cookie = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'posts', 'comments', 'subscribers', 'newsletter_sends',
                   'integration_keys', 'activity_log', 'settings', 'server_secrets']) {
    db().run(`delete from ${t}`)
  }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'owner@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

const asOwner = (path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: { cookie, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  })

const post = (path: string, data: unknown) =>
  asOwner(path, { method: 'POST', body: JSON.stringify(data) })

describe('the gate', () => {
  it('refuses every newsletter and moderation route without a session', async () => {
    const routes: Array<[string, string]> = [
      ['GET', '/api/mail'], ['POST', '/api/mail'], ['POST', '/api/mail/test'],
      ['GET', '/api/broadcast'], ['POST', '/api/broadcast'],
      ['GET', '/api/subscribers'], ['DELETE', '/api/subscribers/1'],
      ['DELETE', '/api/comments/1'],
      ['POST', '/api/comments/keys'], ['POST', '/api/integrations/cloudflare'],
    ]
    for (const [method, path] of routes) {
      const res = await app.request(path, {
        method,
        headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
        ...(method === 'GET' || method === 'DELETE' ? {} : { body: '{}' }),
      })
      expect(`${method} ${path} -> ${res.status}`).toBe(`${method} ${path} -> 401`)
    }
  })
})

describe('SMTP configuration', () => {
  /**
   * The password must never come back. This response goes to a browser, and the form
   * shows a filled placeholder from `hasPass` instead of the value.
   */
  it('reports whether a password is set, never the password', async () => {
    await post('/api/mail', { host: 'smtp.example.com', port: 587, user: 'u', pass: 'hunter2', from: 'a@b.c' })
    const config = await payload<Record<string, unknown>>(asOwner('/api/mail'))
    expect(config.hasPass).toBe(true)
    expect(config.host).toBe('smtp.example.com')
    expect(JSON.stringify(config)).not.toContain('hunter2')
  })

  /**
   * Field by field, so an absent key leaves the stored value alone. A wholesale assignment
   * wipes the password every time the form is saved without retyping it — which is every
   * time, because the form cannot show it.
   */
  it('does not wipe the password when the form omits it', async () => {
    await post('/api/mail', { host: 'smtp.example.com', pass: 'hunter2' })
    await post('/api/mail', { host: 'smtp2.example.com' })
    const config = await payload<{ host: string; hasPass: boolean }>(asOwner('/api/mail'))
    expect(config.host).toBe('smtp2.example.com')
    expect(config.hasPass).toBe(true)
  })

  it('reports configured only once it really is', async () => {
    expect((await payload<{ configured: boolean }>(asOwner('/api/mail'))).configured).toBe(false)
    await post('/api/mail', { host: 'smtp.example.com', port: 587, user: 'u', pass: 'p', from: 'a@b.c' })
    expect((await payload<{ configured: boolean }>(asOwner('/api/mail'))).configured).toBe(true)
  })
})

describe('the test send', () => {
  it('rejects a kind it does not know', async () => {
    const res = await post('/api/mail/test', { kind: 'carrier-pigeon' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ success: false, error: 'invalid_kind' })
  })

  // 502, not 500. The failure is the upstream mail server's, and the distinction is what
  // tells the owner to check their SMTP settings rather than report a bug.
  it('reports an upstream failure as 502', async () => {
    const res = await post('/api/mail/test', { kind: 'smtp' })
    expect(res.status).toBe(502)
  })

  it('defaults the recipient to the signed-in owner', async () => {
    // Unconfigured SMTP still fails, but reaching 502 rather than 400 proves a recipient
    // was resolved: `no_recipient` is the 400 that would fire otherwise.
    const res = await post('/api/mail/test', { kind: 'smtp' })
    expect(res.status).not.toBe(400)
  })
})

describe('the broadcast', () => {
  it('requires at least one slug, on both the preview and the send', async () => {
    expect((await asOwner('/api/broadcast')).status).toBe(400)
    expect((await post('/api/broadcast', { slugs: [] })).status).toBe(400)
  })

  // Several posts go out as ONE digest, so the preview has to take the same list the send
  // will, which is why the parameter repeats rather than being comma-separated.
  it('previews a digest from repeated slug parameters', async () => {
    await post('/api/posts', { title: 'First', status: 'published', content: 'A' })
    await post('/api/posts', { title: 'Second', status: 'published', content: 'B' })
    const res = await asOwner('/api/broadcast?slug=first&slug=second')
    expect(res.status).toBe(200)
    const preview = await payload<{ subject: string; html: string }>(res)
    expect(preview.html).toContain('First')
    expect(preview.html).toContain('Second')
  })

  it('reports a validation failure with its own code, not a 500', async () => {
    const res = await asOwner('/api/broadcast?slug=no-such-post')
    expect(res.status).toBe(400)
    expect((await payload<{ error: string }>(res)).error).not.toBe('broadcast_failed')
  })
})

describe('subscribers', () => {
  it('lists with counts and per-address stats', async () => {
    db().run(
      `insert into subscribers (email, status, token, created_at) values (?, 'confirmed', 'tok', ?)`,
      ['reader@example.com', Date.now()],
    )
    const res = await asOwner('/api/subscribers')
    expect(res.status).toBe(200)
    const data = await payload<{
      subscribers: Array<{ email: string; stats: unknown }>
      counts: { confirmed: number }
    }>(res)
    expect(data.counts.confirmed).toBe(1)
    // The full address, not a truncated one. A subscriber list showing `reader@e…` was a
    // real defect in the frozen tree, and it shipped because nobody opened the page.
    expect(data.subscribers[0].email).toBe('reader@example.com')
    expect('stats' in data.subscribers[0]).toBe(true)
  })

  it('deletes by id and rejects one that is not a number', async () => {
    db().run(
      `insert into subscribers (email, status, token, created_at) values (?, 'confirmed', 'tok2', ?)`,
      ['gone@example.com', Date.now()],
    )
    const id = one<{ id: number }>(`select id from subscribers`)!.id
    expect((await asOwner(`/api/subscribers/${id}`, { method: 'DELETE' })).status).toBe(200)
    expect((await asOwner('/api/subscribers/abc', { method: 'DELETE' })).status).toBe(400)
  })
})

describe('comment moderation', () => {
  it('soft deletes, so the comment is restorable', async () => {
    await post('/api/posts', { title: 'Discussed', status: 'published', content: 'x' })
    db().run(
      `insert into comments (post_slug, author_name, content, created_at)
       values ('discussed', 'A Reader', 'hi', ?)`,
      [Date.now()],
    )
    const id = one<{ id: number }>(`select id from comments`)!.id

    expect((await asOwner(`/api/comments/${id}`, { method: 'DELETE' })).status).toBe(200)
    // Invariant 6: the row is still there, marked.
    expect(one<{ deleted_at: number | null }>(`select deleted_at from comments`)!.deleted_at).not.toBeNull()

    const restored = await post('/api/trash', { kind: 'comments', action: 'restore', ids: [String(id)] })
    expect(restored.status).toBe(200)
    expect(one<{ deleted_at: number | null }>(`select deleted_at from comments`)!.deleted_at).toBeNull()
  })

  it('rejects a comment id that is not a number', async () => {
    expect((await asOwner('/api/comments/abc', { method: 'DELETE' })).status).toBe(400)
  })
})

describe('integration keys', () => {
  // Two forms, two routes. `saveIntegrationKeys` leaves any field it is not given, so the
  // Turnstile form must not be able to clear the Cloudflare token.
  it('each form writes only its own pair', async () => {
    await post('/api/integrations/cloudflare', { cloudflareApiToken: 'cf-token', cloudflareZoneId: 'zone' })
    await post('/api/comments/keys', { turnstileSiteKey: 'site', turnstileSecretKey: 'secret' })

    const row = one<{ cloudflare_api_token: string; turnstile_site_key: string }>(
      `select cloudflare_api_token, turnstile_site_key from integration_keys`,
    )
    expect(row!.cloudflare_api_token).toBe('cf-token')
    expect(row!.turnstile_site_key).toBe('site')
  })
})

describe('the public search index', () => {
  it('carries no drafts and no bodies', async () => {
    await post('/api/posts', { title: 'Public one', status: 'published', content: 'SECRET BODY TEXT' })
    await post('/api/posts', { title: 'A draft', status: 'draft', content: 'also secret' })

    const res = await app.request('/api/search/index')
    expect(res.status).toBe(200)
    const docs = await payload<Array<{ title: string }>>(res)
    expect(docs.map((d) => d.title)).toEqual(['Public one'])
    expect(JSON.stringify(docs)).not.toContain('SECRET BODY TEXT')
  })

  // A disabled feature should not leave an endpoint quietly answering.
  it('404s when search is switched off', async () => {
    await asOwner('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ features: { search: false } }),
    })
    expect((await app.request('/api/search/index')).status).toBe(404)
  })
})

// LISTING THE MODELS IS THE KEY TEST, and the shape of its answer is the contract the AI
// card is written against. It returns 200 for a REFUSED key on purpose: the request was
// well formed and the question was "does this key work", so "no, and here is what the
// provider said" is the answer to it rather than a failure to answer. Sent back as a 502 —
// which it was until 2026-08-31 — the envelope has one `error` string and nowhere to put
// the provider's own sentence, so the card fell back to "could not read the model list"
// whether the key was wrong, the account was out of credit, or the box had no route out.
describe('the model list', () => {
  const realFetch = globalThis.fetch
  afterAll(() => { globalThis.fetch = realFetch })

  const answering = (status: number, body: unknown) => {
    globalThis.fetch = (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
  }

  it('hands back what the account can see', async () => {
    answering(200, { data: [{ id: 'deepseek-v4-flash' }, { id: 'text-embedding-3-small' }] })
    const res = await post('/api/integrations/ai/models', { provider: 'deepseek', apiKey: 'sk-typed-not-yet-saved' })
    expect(res.status).toBe(200)
    const listing = await payload<{ ok: boolean; models: { id: string }[] }>(res)
    expect(listing.ok).toBe(true)
    // The embedding model is filtered out: it is on the account and cannot hold a conversation.
    expect(listing.models.map((m) => m.id)).toEqual(['deepseek-v4-flash'])
  })

  it('answers a refused key with the reason and the provider’s own words', async () => {
    answering(401, { error: { message: 'Authentication Fails, Your api key is invalid' } })
    const res = await post('/api/integrations/ai/models', { provider: 'deepseek', apiKey: 'sk-wrong' })
    expect(res.status).toBe(200)
    const listing = await payload<{ ok: boolean; code: string; status: number; detail: string }>(res)
    expect(listing.ok).toBe(false)
    expect(listing.code).toBe('bad_key')
    expect(listing.status).toBe(401)
    expect(listing.detail).toBe('Authentication Fails, Your api key is invalid')
  })

  it('tries a typed key BEFORE it is saved, and stores nothing while doing it', async () => {
    answering(200, { data: [{ id: 'deepseek-v4-flash' }] })
    await post('/api/integrations/ai/models', { provider: 'deepseek', apiKey: 'sk-only-being-tried' })
    expect(one<{ n: number }>('select count(*) as n from integration_keys')!.n).toBe(0)
  })

  // Both are the caller's mistake rather than the provider's, so both stay 400s.
  it('refuses a provider it cannot serve, and a request with no key anywhere', async () => {
    expect((await post('/api/integrations/ai/models', { provider: 'mistral', apiKey: 'k' })).status).toBe(400)
    expect((await post('/api/integrations/ai/models', { provider: 'openai' })).status).toBe(400)
  })
})
