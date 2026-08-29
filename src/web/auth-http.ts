// What the sign-in and enrolment routes both need to answer a request.
//
// These four were written when the whole flow lived in one file. Splitting the enrolment
// half out (`enrol-routes.ts`) would have meant two copies of each, which is how the two
// halves of `newsletter-html.ts` drifted, so they moved here instead.

import type { Context } from 'hono'
import { sessionCookie } from '@/auth/sessions'

export const html = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })

/** Read named fields from a form post or a JSON body, without caring which it was. */
export async function readFields(c: Context, names: string[]): Promise<{
  values: Record<string, string>
  wantsHtml: boolean
}> {
  const type = c.req.header('content-type') ?? ''
  const source: Record<string, unknown> = type.includes('form')
    ? ((await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>)
    : ((await c.req.json().catch(() => ({}))) as Record<string, unknown>)
  const values: Record<string, string> = {}
  for (const name of names) {
    const value = source[name]
    values[name] = typeof value === 'string' ? value : ''
  }
  return { values, wantsHtml: type.includes('form') }
}

/**
 * Where to go after signing in.
 *
 * Only a same-site ABSOLUTE PATH is honoured. A full URL here is the open-redirect that
 * turns a trustworthy sign-in page into a link an attacker can send: sign in on the real
 * site, get bounced somewhere else. `//evil.example` is rejected too — the browser reads a
 * protocol-relative URL as another origin, and it starts with a slash. `/\evil.example` is
 * the same trick against a check that only knows about slashes: browsers normalise the
 * backslash and leave the site just as readily. `safeReturnPath` in `web/comment-auth.ts`
 * guards the identical pair, for the identical reason.
 */
export function safeNext(raw: string | undefined): string {
  if (raw === undefined || raw === '') return '/admin'
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/admin'
  return raw
}

/**
 * The answer to a request that has just produced a session.
 *
 * Three routes end this way — the second factor, acknowledging the recovery codes, and
 * deferring enrolment — and all three had it written out longhand, six lines apiece. Only
 * the destination differed.
 *
 * The cookie is set whichever shape the caller asked for; a fetch gets JSON because a 303 to
 * a page of HTML is not an answer a script can read, and a form post gets the redirect
 * because its browser is going to follow one.
 */
export function signedIn(
  session: { token: string; expiresAt: number },
  location: string,
  wantsHtml: boolean,
): Response {
  const headers = new Headers({ 'set-cookie': sessionCookie(session.token, session.expiresAt) })
  if (!wantsHtml) {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { ...Object.fromEntries(headers), 'content-type': 'application/json; charset=utf-8' },
    })
  }
  headers.set('location', location)
  return new Response(null, { status: 303, headers })
}
