// Shareable draft-preview tokens. A token is an HMAC of the slug, so anyone holding the
// link can view that ONE draft without signing in, and the link cannot be guessed or
// reused for another slug.
//
// The key was `process.env.AUTH_SECRET ?? ''`. `AUTH_SECRET` left with next-auth
// (06-auth.md), which silently made the key the EMPTY STRING — every preview token then
// signed with a key an attacker also has, so any draft slug's token is computable and
// every unpublished post is readable by anyone who guesses the slug. Found by auditing
// which environment variables the server still needs, not by a test.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { serverSecret } from '@/auth/secret'

/**
 * A link dies after 30 days, because until 2026-08-29 it never died at all: the token was
 * an HMAC of the slug alone, so one link pasted into the wrong chat exposed that draft for
 * as long as it kept its slug, and nothing short of renaming the post could take it back.
 * Thirty days outlives any review a draft is actually sent out for; the owner mints a
 * fresh link in one click when it does not.
 */
const PREVIEW_TTL_MS = 30 * 24 * 60 * 60 * 1000

const sign = (slug: string, exp: number): string =>
  createHmac('sha256', serverSecret('preview-link')).update(`${slug}.${exp}`).digest('base64url').slice(0, 24)

/** `<sig>.<expiry-ms-base36>` — the expiry rides in the token so verification needs no table. */
export function previewToken(slug: string): string {
  const exp = Date.now() + PREVIEW_TTL_MS
  return `${sign(slug, exp)}.${exp.toString(36)}`
}

export function verifyPreview(slug: string, token: string | undefined): boolean {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot < 0) return false // including every pre-expiry token: they never expired, so they all expire now
  const exp = parseInt(token.slice(dot + 1), 36)
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  // The signature covers slug AND expiry, so the date in the URL cannot be edited forward.
  const expected = sign(slug, exp)
  const given = token.slice(0, dot)
  if (given.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}
