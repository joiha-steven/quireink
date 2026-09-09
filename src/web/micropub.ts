// Micropub (W3C): a standard door into the notebook for any client that speaks it
// (ADR 0046). A post arrives as a form or as JSON, with a bearer token minted by the
// IndieAuth flow the MCP OAuth server now also serves; what it makes is a NOTE, never a
// post — the notebook is where things that arrive from outside belong (0044).
//
// The subset implemented is the one a reader's tools actually use: `h-entry` with a name,
// content, `bookmark-of` / `quotation-of` (which make it a clip), `post-status`, `mp-slug`;
// `q=config` and `q=source`; `action=delete`. Anything else answers with the error shape the
// spec names, so a client can say what it could not do.

import { Hono } from 'hono'
import type { Context } from 'hono'
import { verifyMcpToken } from '@/mcp/auth'
import { deleteNote, getNote, saveNote } from '@/content/notes'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { SlugConflictError } from '@/content/slugs'
import { clearCache } from '@/server/cache'
import { logActivity } from '@/server/activity'
import { afterNoteSaved } from '@/server/webmention'

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
}
const reply = (data: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), {
    status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', ...extra },
  })
const oops = (error: string, description: string, status = 400) =>
  reply({ error, error_description: description }, status)

/** One property, whatever shape it came in: a string, an array, or `{ html }`. */
function first(v: unknown): string {
  const x = Array.isArray(v) ? v[0] : v
  if (typeof x === 'string') return x
  if (x && typeof x === 'object' && 'html' in x && typeof (x as { html: unknown }).html === 'string') {
    return (x as { html: string }).html
  }
  return ''
}

type Incoming = { type: string; props: Record<string, unknown>; action?: string; url?: string }

/** The two encodings the spec allows, read into one shape. */
async function read(req: Request): Promise<Incoming | null> {
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as
      | { type?: unknown; properties?: unknown; action?: unknown; url?: unknown } | null
    if (!body || typeof body !== 'object') return null
    if (typeof body.action === 'string') return { type: '', props: {}, action: body.action, url: first(body.url) }
    const type = Array.isArray(body.type) ? String(body.type[0] ?? '') : ''
    const props = body.properties && typeof body.properties === 'object' ? body.properties as Record<string, unknown> : {}
    return { type: type.replace(/^h-/, ''), props }
  }
  const form = await req.formData().catch(() => null)
  if (!form) return null
  const props: Record<string, unknown> = {}
  for (const [k, v] of form.entries()) {
    if (typeof v !== 'string') continue
    const key = k.replace(/\[\]$/, '')
    props[key] = key === k ? v : [...(Array.isArray(props[key]) ? props[key] as string[] : []), v]
  }
  if (typeof props.action === 'string') return { type: '', props, action: props.action, url: first(props.url) }
  return { type: first(props.h), props }
}

/** The bearer off the Authorization header; the transport reads it the same way. */
async function bearerAuth(c: Context) {
  const header = c.req.header('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  return token ? verifyMcpToken(token) : undefined
}

export function micropubRoutes(): Hono {
  const app = new Hono()
  app.options('/micropub', () => new Response(null, { status: 204, headers: CORS }))

  app.get('/micropub', async (c) => {
    const auth = await bearerAuth(c)
    if (!auth) return oops('unauthorized', 'a bearer token is required', 401)
    const q = c.req.query('q')
    const site = resolveSiteUrl(await getSettings())
    if (q === 'config') return reply({ 'syndicate-to': [], q: ['config', 'source'], 'media-endpoint': undefined })
    if (q === 'source') {
      const url = c.req.query('url') ?? ''
      const slug = url.startsWith(`${site}/notes/`) ? url.slice(`${site}/notes/`.length) : ''
      const note = slug ? await getNote(slug) : null
      if (!note) return oops('invalid_request', 'no note at that url', 404)
      return reply({ type: ['h-entry'], properties: {
        name: [note.title], content: [note.content], published: [note.date],
        'post-status': [note.status === 'published' ? 'published' : 'draft'],
        ...(note.sourceUrl ? { 'quotation-of': [note.sourceUrl] } : {}),
      } })
    }
    return oops('invalid_request', 'unknown q')
  })

  app.post('/micropub', async (c) => {
    const auth = await bearerAuth(c)
    if (!auth) return oops('unauthorized', 'a bearer token is required', 401)
    if (!auth.scopes.includes('full')) return oops('insufficient_scope', 'this token may only read', 403)
    const site = resolveSiteUrl(await getSettings())
    const inc = await read(c.req.raw)
    if (!inc) return oops('invalid_request', 'could not read the request')

    if (inc.action) {
      if (inc.action !== 'delete') return oops('invalid_request', `action ${inc.action} is not supported`)
      const slug = (inc.url ?? '').startsWith(`${site}/notes/`) ? (inc.url ?? '').slice(`${site}/notes/`.length) : ''
      if (!slug || !(await getNote(slug))) return oops('invalid_request', 'no note at that url', 404)
      await deleteNote(slug)
      clearCache()
      void logActivity('note.delete', slug)
      return new Response(null, { status: 204, headers: CORS })
    }
    if (inc.type !== 'entry') return oops('invalid_request', 'only h-entry is supported')

    const p = inc.props
    const source = first(p['quotation-of']) || first(p['bookmark-of']) || first(p['in-reply-to'])
    const status = first(p['post-status']) === 'draft' ? 'draft' : 'published'
    const content = first(p.content)
    const title = first(p.name)
    if (!content && !title && !source) return oops('invalid_request', 'an entry needs a name, content or a source')
    try {
      const meta = await saveNote({
        title, content, status, date: first(p.published) || new Date().toISOString(),
        slug: first(p['mp-slug']) || undefined,
        sourceUrl: source || undefined,
        sourceTitle: first(p['source-name']) || undefined,
        quote: first(p.quote) || undefined,
      })
      clearCache()
      void logActivity('note.create', meta.title || meta.slug)
      afterNoteSaved(meta, site)
      return reply({}, 201, { location: `${site}/notes/${meta.slug}` })
    } catch (error) {
      if (error instanceof SlugConflictError) return oops('invalid_request', 'that slug is taken', 409)
      throw error
    }
  })
  return app
}
