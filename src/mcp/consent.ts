// The OAuth consent step.
//
// The redirect_uri allowlist alone does NOT stop account takeover. `/api/mcp/register` is
// public, so an attacker can register THEIR OWN client with their own redirect_uri, then
// phish the signed-in owner into `authorize?client_id=<theirs>&redirect_uri=<attacker>`.
// The allowlist passes — it IS registered for that client — and a code would auto-issue
// straight to the attacker. So the owner has to SEE the exact client_id and redirect_uri
// and click Approve.
//
// A consent page is only meaningful if its POST cannot be forged. The approve form
// therefore carries a CSRF token bound to the owner's SESSION: an auto-submitting
// cross-site POST rides the owner's cookies but cannot compute the token.
//
// Ported from `src/lib/mcp/consent.ts`. One substitution, below.

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { COOKIE_NAME, resolveSession } from '@/auth/sessions'
import { serverSecret } from '@/auth/secret'

const secret = (): string => process.env.MCP_OAUTH_SECRET || serverSecret('mcp-oauth')

export type OAuthParams = { clientId: string; redirectUri: string; challenge: string; state: string; scope?: string }

/**
 * The session-bound value the CSRF token is keyed to.
 *
 * Was the raw next-auth session JWT. Here it is the stored session ID — the SHA-256 of
 * the cookie token, which never leaves the server. The property that matters is identical
 * and arguably stronger: an attacker who can make the owner's browser send its cookie
 * still cannot READ that cookie (HttpOnly), and cannot derive the ID without it.
 */
function sessionKey(c: Context): string | null {
  const session = resolveSession(getCookie(c, COOKIE_NAME))
  return session === null ? null : session.id
}

/**
 * HMAC over the session key and the exact parameters. Binding to the session is what
 * makes this CSRF-proof; pinning the parameters is what stops a token minted for one
 * client being replayed for another.
 */
function computeCsrf(session: string, p: OAuthParams): string {
  const material = [session, p.clientId, p.redirectUri, p.challenge].join('|')
  return createHmac('sha256', secret()).update(material).digest('base64url')
}

/** The token to embed in the consent form. Null when there is no session. */
export function csrfToken(c: Context, p: OAuthParams): string | null {
  const session = sessionKey(c)
  return session === null ? null : computeCsrf(session, p)
}

/** Constant-time check that a submitted token matches this session and these parameters. */
export function verifyCsrf(c: Context, p: OAuthParams, submitted: string): boolean {
  const session = sessionKey(c)
  if (session === null || !submitted) return false
  const expected = Buffer.from(computeCsrf(session, p))
  const given = Buffer.from(submitted)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/**
 * A self-contained consent page.
 *
 * No theme tokens and no site chrome, deliberately: this is an out-of-band OAuth
 * interstitial, not part of the blog's UI, and it must render identically whatever the
 * owner's theme is set to.
 *
 * Deny links to the blog home, NOT to the redirect_uri, so refusing never navigates to
 * the requesting host at all and issues nothing.
 */
export function consentPage(p: OAuthParams, csrf: string, denyHref: string): string {
  const hidden = (name: string, value: string): string =>
    `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Authorize MCP connection</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1.25rem;line-height:1.5;color:#111}
  h1{font-size:1.25rem} dl{background:#f4f4f5;border-radius:.5rem;padding:1rem;overflow-wrap:anywhere}
  dt{font-weight:600;font-size:.8rem;color:#52525b} dd{margin:0 0 .75rem;font-family:ui-monospace,monospace;font-size:.85rem}
  dd:last-child{margin-bottom:0} .row{display:flex;gap:.75rem;margin-top:1.5rem}
  button,.deny{font:inherit;padding:.6rem 1.1rem;border-radius:.5rem;border:1px solid #d4d4d8;cursor:pointer;text-decoration:none;color:#111}
  button{background:#111;color:#fff;border-color:#111}
  @media(prefers-color-scheme:dark){body{background:#0a0a0a;color:#fafafa}dl{background:#18181b}dt{color:#a1a1aa}
    .deny{color:#fafafa;border-color:#3f3f46}button{background:#fafafa;color:#0a0a0a;border-color:#fafafa}}
</style></head>
<body>
  <h1>Authorize MCP connection</h1>
  <p>An application is requesting access to operate this blog on your behalf. Approve only if you recognize it.</p>
  <dl>
    <dt>Client ID</dt><dd>${esc(p.clientId || '(none)')}</dd>
    <dt>Redirect URI</dt><dd>${esc(p.redirectUri)}</dd>
    ${p.scope ? `<dt>Scope</dt><dd>${esc(p.scope)}</dd>` : ''}
  </dl>
  <div class="row">
    <form method="POST">
      ${hidden('client_id', p.clientId)}${hidden('redirect_uri', p.redirectUri)}
      ${hidden('code_challenge', p.challenge)}${hidden('state', p.state)}${hidden('scope', p.scope ?? '')}${hidden('csrf', csrf)}
      <button type="submit">Approve</button>
    </form>
    <a class="deny" href="${esc(denyHref)}">Deny</a>
  </div>
</body></html>`
}
