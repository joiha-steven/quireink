// MCP auth: the thin OAuth 2.1 layer.
//
// Access tokens are admin-managed (`tokens.ts`) and the endpoint is gated by a settings
// toggle. This layer exists for connectors that REQUIRE OAuth: the owner approves, the
// token endpoint mints a managed token and hands it back. The only identity involved is
// the blog owner.
//
// Ported from `src/lib/mcp/auth.ts`. Two substitutions, both forced by things that left
// with next-auth, and both noted where they happen.

import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto'
import { getSettings } from '@/content/settings'
import { verifyTokenHash } from '@/mcp/tokens'
import { consumeCodeJti } from '@/mcp/used-codes'
import { serverSecret } from '@/auth/secret'

/**
 * The code-signing secret.
 *
 * Was `MCP_OAUTH_SECRET || AUTH_SECRET`. `AUTH_SECRET` is gone, so the fallback is a
 * generated per-purpose secret — which means a self-hoster no longer has to set anything
 * for OAuth to work, and cannot set it badly. `MCP_OAUTH_SECRET` still wins when present,
 * because 06-auth.md keeps it.
 *
 * Rotating it invalidates authorization codes in flight. They live 300 seconds, so that
 * is not a migration concern; the TOKEN hash format, which is, is untouched here.
 */
const secret = (): string => process.env.MCP_OAUTH_SECRET || serverSecret('mcp-oauth')

/** MCP is live only when the owner has switched it on (Settings → Advanced). */
export async function mcpEnabled(): Promise<boolean> {
  try {
    return (await getSettings()).mcp.enabled
  } catch {
    return false
  }
}

/** Constant-time compare. Differing lengths return false without reaching the compare. */
function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/** What a verified bearer resolves to. Was the SDK's `AuthInfo`; the shape is the same. */
export type McpAuth = { token: string; clientId: string; scopes: string[] }

/** Accept any live managed token while MCP is enabled. The token's stored scope rides
 *  along, and the transport decides which tools that scope may even see. */
export async function verifyMcpToken(bearer?: string): Promise<McpAuth | undefined> {
  if (!bearer || !(await mcpEnabled())) return undefined
  const hit = await verifyTokenHash(bearer)
  if (!hit) return undefined
  return { token: bearer, clientId: `token:${hit.id}`, scopes: [hit.scope] }
}

// ----- HMAC-signed authorization codes -----------------------------------------

/**
 * `jti` is a per-code nonce, and it is what makes a stateless code single-use: the token
 * endpoint records it on first exchange and rejects any later code carrying the same one.
 * Without it an HMAC code is replayable for its whole lifetime.
 */
type CodePayload = { redirectUri: string; challenge: string; exp: number; jti: string }

const sign = (data: string): string =>
  createHmac('sha256', secret()).update(data).digest('base64url')

/** A short-lived code bound to the client's redirect_uri and PKCE challenge. */
export function issueCode(redirectUri: string, challenge: string, ttlSec = 300): string {
  const payload: CodePayload = {
    redirectUri,
    challenge,
    exp: Date.now() + ttlSec * 1000,
    jti: randomBytes(16).toString('base64url'),
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

/**
 * Validate a code at the token endpoint: signature, expiry, redirect_uri match, PKCE
 * (S256 — the verifier must hash to the baked-in challenge) and single use.
 *
 * Returns false on ANY failure, with no distinction between them.
 */
export async function verifyCode(
  code: string, redirectUri: string, verifier: string,
): Promise<boolean> {
  const [body, sig] = code.split('.')
  if (!body || !sig || !safeEq(sig, sign(body))) return false

  let payload: CodePayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as CodePayload
  } catch {
    return false
  }
  if (Date.now() > payload.exp || payload.redirectUri !== redirectUri || !payload.jti) return false

  const computed = createHash('sha256').update(verifier).digest('base64url')
  if (!safeEq(computed, payload.challenge)) return false

  // Consumed LAST, after every stateless check has passed, so an invalid code never burns
  // a nonce. A false here means it was already spent — a replay.
  return consumeCodeJti(payload.jti, payload.exp)
}
