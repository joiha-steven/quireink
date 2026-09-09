// The reader's marks over the wire (ADR 0047): four small routes, none owner-gated, because
// the person on the other end is a reader and the thing they write is theirs.
//
// Every write is authorised by what names the reader — the code header, or the commenter
// cookie — and by nothing else. A cross-site page cannot forge either: it does not know the
// code, and the cookie is SameSite=Lax, which withholds it from a fetch that did not start
// here. Each route is rate limited per address, and all of it answers 404 while the owner's
// pen switch is off, so a blog that never offered this never serves it.

import { Hono, type Context } from 'hono'
import { getSettings } from '@/content/settings'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { forgetReader, getMarks, mintCode, putMarks, readerOf, MAX_BODY_BYTES } from '@/server/reader-marks'
import { json } from '@/web/api'

/** Codes per address per hour: a reader mints one, twice if they lost the first. */
const CODES_PER_HOUR = 5
/** Reads and writes per address per minute: a page load and a debounced save each. */
const PER_MINUTE = 120

const NO_STORE = { 'cache-control': 'no-store' }

/** A page path this blog could have served: absolute, one origin, short. */
function cleanPath(raw: string | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.length > 512) return null
  if (/[\s<>"'\\]/.test(raw)) return null
  return raw.split('#')[0]!
}

async function penOn(): Promise<boolean> {
  return (await getSettings()).features.readerPen
}

function limited(c: Context, key: string, max: number, windowMs?: number): Response | null {
  return rateLimited(`${key}:${clientIp(c)}`, max, windowMs)
    ? json({ error: 'too many requests' }, 429, NO_STORE)
    : null
}

export function penRoutes(): Hono {
  const app = new Hono()

  // Who the browser's code or cookie names, so the island knows whether it is kept.
  app.get('/api/pen/me', async (c) => {
    if (!(await penOn())) return c.notFound()
    const slow = limited(c, 'pen-read', PER_MINUTE)
    if (slow) return slow
    const who = readerOf(c)
    return json({ via: who?.via ?? null }, 200, NO_STORE)
  })

  // A new notebook code, shown once.
  app.post('/api/pen/code', async (c) => {
    if (!(await penOn())) return c.notFound()
    const slow = limited(c, 'pen-code', CODES_PER_HOUR, 60 * 60 * 1000)
    if (slow) return slow
    return json({ code: mintCode() }, 201, NO_STORE)
  })

  // One page's marks: the list the browser stores, or 404 when this reader never kept it.
  app.get('/api/pen', async (c) => {
    if (!(await penOn())) return c.notFound()
    const slow = limited(c, 'pen-read', PER_MINUTE)
    if (slow) return slow
    const who = readerOf(c)
    if (!who) return json({ error: 'unauthorized' }, 401, NO_STORE)
    const path = cleanPath(c.req.query('path'))
    if (!path) return json({ error: 'bad path' }, 400, NO_STORE)
    const body = getMarks(who.id, path)
    if (body === null) return json({ error: 'not found' }, 404, NO_STORE)
    return new Response(`{"success":true,"data":{"items":${body}}}`, {
      status: 200, headers: { 'content-type': 'application/json; charset=utf-8', ...NO_STORE },
    })
  })

  app.put('/api/pen', async (c) => {
    if (!(await penOn())) return c.notFound()
    const slow = limited(c, 'pen-write', PER_MINUTE)
    if (slow) return slow
    const who = readerOf(c)
    if (!who) return json({ error: 'unauthorized' }, 401, NO_STORE)
    const path = cleanPath(c.req.query('path'))
    if (!path) return json({ error: 'bad path' }, 400, NO_STORE)
    const raw = await c.req.text()
    if (raw.length > MAX_BODY_BYTES * 2) return json({ error: 'too large' }, 413, NO_STORE)
    let items: unknown
    try { items = (JSON.parse(raw) as { items?: unknown }).items } catch { items = undefined }
    if (!putMarks(who.id, path, JSON.stringify(items ?? null))) return json({ error: 'bad body' }, 400, NO_STORE)
    return c.body(null, 204)
  })

  // Everything this reader kept here, gone. The browser forgets its side itself.
  app.delete('/api/pen', async (c) => {
    if (!(await penOn())) return c.notFound()
    const slow = limited(c, 'pen-write', PER_MINUTE)
    if (slow) return slow
    const who = readerOf(c)
    if (!who) return json({ error: 'unauthorized' }, 401, NO_STORE)
    forgetReader(who)
    return c.body(null, 204)
  })

  return app
}
