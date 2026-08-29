// The MCP OAuth layer and token management.
//
// Ported from `src/app/api/mcp/{authorize,token,register,tokens}` and
// `src/app/.well-known/*`. The MCP transport itself (`/api/mcp`) and its tools land
// separately: the frozen tree used `mcp-handler`, which is Next-specific, so that piece is
// a rewrite rather than a port.
//
// The security argument for this whole file, unchanged: `/api/mcp/register` is PUBLIC, so
// an attacker can register their own client pointing at their own host and then phish the
// signed-in owner into authorizing it. The allowlist would pass — it really is registered
// for that client. Only an explicit, CSRF-protected Approve closes that.

import { Hono } from 'hono'
import type { Context } from 'hono'
import { isRedirectAllowed, registerClient } from '@/mcp/clients'
import { createToken, deleteToken, listTokens, mintOAuthToken } from '@/mcp/tokens'
import { issueCode, mcpEnabled, verifyCode } from '@/mcp/auth'
import { consentPage, csrfToken, verifyCsrf, type OAuthParams } from '@/mcp/consent'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { logActivity } from '@/server/activity'
import { currentOwner, ownerRouter, param } from '@/web/guard'
import { fail, json } from '@/web/api'

/** These endpoints are called cross-origin by connectors, so they answer preflight. */
const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
}

const corsJson = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  })

/** OAuth parameters from a query string (GET) or a form body (the approve POST). */
function parseParams(src: URLSearchParams): {
  params: OAuthParams
  method: string | null
  responseType: string | null
} {
  return {
    params: {
      clientId: src.get('client_id') ?? '',
      redirectUri: src.get('redirect_uri') ?? '',
      challenge: src.get('code_challenge') ?? '',
      state: src.get('state') ?? '',
    },
    method: src.get('code_challenge_method'),
    responseType: src.get('response_type'),
  }
}

/**
 * The shared validity gate for both verbs.
 *
 * Returns an error Response — never a redirect to the unvalidated URI, which would make
 * this endpoint an open redirect in its own right.
 */
async function validate(
  p: OAuthParams, method: string | null, responseType: string | null,
): Promise<Response | null> {
  if (responseType !== 'code' || !p.redirectUri || !p.challenge || method !== 'S256') {
    return new Response('invalid_request (need response_type=code, redirect_uri, S256 PKCE)', { status: 400 })
  }
  try {
    new URL(p.redirectUri)
  } catch {
    return new Response('invalid redirect_uri', { status: 400 })
  }
  if (!(await isRedirectAllowed(p.clientId, p.redirectUri))) {
    return new Response('invalid_request: redirect_uri not registered for this client', { status: 400 })
  }
  return null
}

/** Issue a code and 302 to the ALREADY VALIDATED redirect_uri, carrying state through. */
function issueAndRedirect(p: OAuthParams): Response {
  const dest = new URL(p.redirectUri)
  dest.searchParams.set('code', issueCode(p.redirectUri, p.challenge))
  if (p.state) dest.searchParams.set('state', p.state)
  return new Response(null, { status: 302, headers: { location: dest.toString() } })
}

/** The owner-gated half: managing tokens from Settings → Advanced. */
export function mcpAdminRoutes() {
  const router = ownerRouter()

  router.get('/api/mcp/tokens', async () => json(await listTokens()))

  router.post('/api/mcp/tokens', async (c) => {
    const input = (await c.req.json().catch(() => ({}))) as { name?: unknown; scope?: unknown }
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) return fail(c, 'Name is required', 400)
    // Anything that is not exactly 'read' mints a full token — the value every token was
    // before scopes existed, and the one an unaware client still expects.
    const scope = input.scope === 'read' ? 'read' as const : 'full' as const
    try {
      const { token, info } = await createToken(name, scope)
      void logActivity('mcp.token.create', info.name)
      // The plaintext is returned ONCE and never again; only its hash is stored.
      return json({ token, info }, 201)
    } catch (error) {
      if ((error as Error).message === 'token_limit') return fail(c, 'token_limit', 409)
      throw error
    }
  })

  router.delete('/api/mcp/tokens/:id', async (c) => {
    const id = Number(param(c, 'id'))
    if (!Number.isInteger(id)) return fail(c, 'Invalid id', 400)
    await deleteToken(id)
    void logActivity('mcp.token.delete', String(id))
    return json({ id })
  })

  return router
}

/** The OAuth endpoints. Public by protocol; each has its own gate. */
export function mcpOAuthRoutes(): Hono {
  const app = new Hono()

  // ----- authorize ------------------------------------------------------------

  app.get('/api/mcp/authorize', async (c) => {
    if (!(await mcpEnabled())) return new Response('MCP is disabled', { status: 503 })
    const url = new URL(c.req.url)
    const { params, method, responseType } = parseParams(url.searchParams)
    const bad = await validate(params, method, responseType)
    if (bad !== null) return bad

    // Only the owner may authorize. Anyone else is sent to sign in and returned here.
    if (currentOwner(c) === null) {
      const next = encodeURIComponent(url.pathname + url.search)
      return c.redirect(`/login?next=${next}`, 302)
    }

    // Loopback used to auto-approve here, on the reasoning that 127.0.0.1 is the owner's
    // own machine. But this is a GET, and a GET any web page can cause: an <img> tag on a
    // hostile page walked the signed-in owner through this route and the server handed an
    // authorization code to whatever was listening on that port — no click, no CSRF,
    // nothing. Removed 2026-08-29. A desktop client still may not pre-register (loopback
    // stays a valid redirect target in `isRedirectAllowed`); it now costs the owner the
    // same one Approve click every other client costs.
    const csrf = csrfToken(c, params)
    if (csrf === null) return new Response('not_authorized', { status: 401 })
    return new Response(consentPage(params, csrf, url.origin), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  })

  // The Approve button. Everything is re-checked: never trust that the GET validated.
  app.post('/api/mcp/authorize', async (c) => {
    if (!(await mcpEnabled())) return new Response('MCP is disabled', { status: 503 })
    const form = await c.req.formData().catch(() => null)
    if (form === null) return new Response('invalid_request', { status: 400 })

    const src = new URLSearchParams()
    for (const [k, v] of form.entries()) if (typeof v === 'string') src.set(k, v)
    const { params, responseType } = parseParams(src)

    // The form omits response_type and the challenge method — it is an approval of an
    // already-valid GET — so they are pinned to the only values this flow supports and
    // `validate` runs identically to the GET path.
    const bad = await validate(params, 'S256', responseType ?? 'code')
    if (bad !== null) return bad

    if (currentOwner(c) === null) return new Response('not_authorized', { status: 401 })

    // THE load-bearing check. A forged cross-site POST rides the owner's cookies but
    // cannot compute this session-bound token, so it is rejected and no code is issued.
    if (!verifyCsrf(c, params, src.get('csrf') ?? '')) {
      return new Response('invalid_csrf', { status: 403 })
    }
    return issueAndRedirect(params)
  })

  // ----- token ----------------------------------------------------------------

  app.options('/api/mcp/token', () => new Response(null, { status: 204, headers: CORS }))

  app.post('/api/mcp/token', async (c) => {
    if (!(await mcpEnabled())) return corsJson({ error: 'temporarily_unavailable' }, 503)
    const form = await c.req.formData().catch(() => null)
    if (form === null) return corsJson({ error: 'invalid_request' }, 400)

    const grantType = String(form.get('grant_type') ?? '')
    const code = String(form.get('code') ?? '')
    const redirectUri = String(form.get('redirect_uri') ?? '')
    const verifier = String(form.get('code_verifier') ?? '')

    if (grantType !== 'authorization_code') return corsJson({ error: 'unsupported_grant_type' }, 400)
    if (!code || !redirectUri || !verifier || !(await verifyCode(code, redirectUri, verifier))) {
      // One error for every failure mode. Which check failed is not the client's business
      // and telling them turns this into an oracle.
      return corsJson({ error: 'invalid_grant' }, 400)
    }

    try {
      // A fresh 180-day token. Nothing else is touched: existing tokens persist until the
      // owner deletes them, so re-authorizing never severs another connection.
      const minted = await mintOAuthToken()
      return corsJson({ access_token: minted.token, token_type: 'Bearer', scope: 'full' })
    } catch {
      return corsJson({ error: 'server_error', error_description: 'could not mint token' }, 500)
    }
  })

  // ----- dynamic client registration (RFC 7591) -------------------------------

  app.options('/api/mcp/register', () => new Response(null, { status: 204, headers: CORS }))

  app.post('/api/mcp/register', async (c) => {
    // Registration is only useful when MCP is on. Refusing otherwise stops a disabled
    // server being used to grow the clients table.
    if (!(await mcpEnabled())) return corsJson({ error: 'temporarily_unavailable' }, 503)
    if (rateLimited(`mcp-register:${clientIp(c)}`, 5)) {
      return corsJson({ error: 'too_many_requests' }, 429)
    }

    const input = (await c.req.json().catch(() => ({}))) as {
      redirect_uris?: unknown; client_name?: unknown
    }
    const redirectUris = Array.isArray(input.redirect_uris)
      ? input.redirect_uris.filter((u): u is string => typeof u === 'string')
      : []
    // A non-loopback flow cannot authorize without a registered redirect_uri, so one is
    // required here rather than later (RFC 7591 §3.2.2 permits rejecting bad metadata).
    if (redirectUris.length === 0) {
      return corsJson({ error: 'invalid_redirect_uri', error_description: 'redirect_uris is required' }, 400)
    }

    try {
      const clientId = await registerClient(redirectUris)
      return corsJson({
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        // No client secret. PKCE is what secures this flow.
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code'],
        response_types: ['code'],
        redirect_uris: redirectUris,
        client_name: typeof input.client_name === 'string' ? input.client_name : 'MCP Client',
      }, 201)
    } catch {
      return corsJson({ error: 'server_error' }, 500)
    }
  })

  // ----- .well-known metadata -------------------------------------------------
  // How a connector discovers all of the above. Both are CORS-open by protocol.

  /**
   * The origin a CLIENT reaches this server on — which is not the one the request arrived
   * with.
   *
   * A CDN terminates TLS and forwards to the origin over plain HTTP, so `c.req.url` is
   * `http://…` and every URL in these two documents came out `http://example.com/...`. A
   * connector fetches the discovery document over https, reads an issuer on http, and
   * rejects the pair: RFC 8414 and RFC 9728 both require the issuer to match the origin the
   * document was served from, exactly. That is the whole of why connecting failed.
   *
   * `x-forwarded-proto` is what the proxy says it accepted, and it is trusted for the same
   * reason the rest of the app trusts this deployment's proxy. Falls back to the request's
   * own scheme, which is correct for a direct connection with no proxy in front.
   */
  const origin = (c: Context): string => {
    const url = new URL(c.req.url)
    const proto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim()
    if (proto) url.protocol = `${proto}:`
    return url.origin
  }

  for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-authorization-server']) {
    app.options(path, () => new Response(null, { status: 204, headers: CORS }))
  }

  // RFC 9728. The 401 from the MCP endpoint points a client here, and this says which
  // authorization server guards it — the same origin.
  app.get('/.well-known/oauth-protected-resource', (c) =>
    corsJson({ resource: `${origin(c)}/api/mcp`, authorization_servers: [origin(c)] }))

  // RFC 8414.
  app.get('/.well-known/oauth-authorization-server', (c) => corsJson({
    issuer: origin(c),
    authorization_endpoint: `${origin(c)}/api/mcp/authorize`,
    token_endpoint: `${origin(c)}/api/mcp/token`,
    registration_endpoint: `${origin(c)}/api/mcp/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['full'],
  }))

  return app
}
