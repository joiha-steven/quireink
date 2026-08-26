// The public comments API.
//
//   GET  /api/comments?post=<slug>  the rendered tree, without email addresses
//   POST /api/comments              leave a comment
//
// Both are public and unauthenticated, because a reader is. The post page itself is
// cached HTML (Invariant 1); comments are fetched separately so a new one appears without
// anything having to invalidate the page it is on.
//
// Two identity paths, as the frozen tree had (ADR 0013 restores the second one). A reader
// signed in with Google is TRUSTED: name and address come from the cookie, and Turnstile is
// skipped because Google already established there is a person there. Everyone else fills
// in a name and a valid address, and passes Turnstile when the owner has it on.

import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { addComment, getCommentTree, CommentInputError, MAX_COMMENT_LEN } from '@/comments/comments'
import { COMMENTER_COOKIE, readCommenter } from '@/comments/commenter'
import { notifyReply } from '@/comments/comment-notify'
import { guardComment } from '@/comments/comment-guard'
import { getCommentEnv } from '@/comments/comment-env'
import { verifyTurnstile } from '@/auth/turnstile'
import { verifyStamp, issueStamp } from '@/comments/stamp'
import { getPost } from '@/content/posts'
import { getSettings } from '@/content/settings'
import { logActivity } from '@/server/activity'
import { isPublicallyVisible } from '@/utils'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { fail, json } from '@/web/api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Tight. Turnstile is the real defence; this blunts a trivial flood before it starts. */
const PER_MINUTE = 6

/** Keep an http(s) URL, drop everything else. `javascript:` in a website field is an XSS. */
function cleanWebsite(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return ''
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : ''
  } catch {
    return ''
  }
}

export async function handleCommentsGet(c: Context): Promise<Response> {
  const slug = c.req.query('post')?.trim()
  const { comments } = await getSettings()
  // An empty list rather than an error: the island renders nothing and the page is fine.
  if (!comments.enabled || !slug) return json({ comments: [] })
  return json({ comments: await getCommentTree(slug) })
}

/**
 * A fresh challenge, for a page whose own one has expired (ADR 0032).
 *
 * Public and uncached by definition — it is one request on an unusual path, rather than a
 * request every reader pays for. It hands out nothing but a signed puzzle.
 */
export async function handleStampGet(): Promise<Response> {
  const { comments } = await getSettings()
  if (!comments.enabled) return json({ stamp: null })
  return json({ stamp: issueStamp() })
}

export async function handleCommentsPost(c: Context): Promise<Response> {
  const { comments } = await getSettings()
  if (!comments.enabled) return fail(c, 'Comments are disabled', 403)

  const ip = clientIp(c)
  // Best-effort, from the CDN edge. Absent without one.
  const country = (c.req.header('cf-ipcountry') ?? '').trim()
  if (rateLimited(`comment:${ip}`, PER_MINUTE)) {
    return fail(c, 'Too many comments — slow down a moment', 429)
  }

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const postSlug = typeof body.postSlug === 'string' ? body.postSlug.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const parentId = typeof body.parentId === 'number' ? body.parentId : null
  const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : ''

  if (!content) return fail(c, 'Comment cannot be empty', 400)
  if (content.length > MAX_COMMENT_LEN) {
    return fail(c, `Comment must be under ${MAX_COMMENT_LEN} characters`, 400)
  }

  // Only on a post that is actually published and visible. Without this, a draft's slug is
  // a place to store text on someone else's server.
  const post = await getPost(postSlug)
  if (!post || !isPublicallyVisible(post.status, post.date)) return fail(c, 'Post not found', 404)

  // The cookie is only an identity while the owner still offers the feature. Turning
  // `googleAuth` off has to stop trusting the cookies already issued under it, or the
  // switch means nothing until each one expires.
  const signedIn = comments.googleAuth ? readCommenter(getCookie(c, COMMENTER_COOKIE)) : null

  let name: string
  let email: string
  let website = ''
  if (signedIn) {
    // Nothing from the body. The point of signing in is that the identity is Google's
    // answer, not the poster's claim, and reading either field here would hand it back.
    ;({ name, email } = signedIn)
  } else {
    name = typeof body.name === 'string' ? body.name.trim() : ''
    email = typeof body.email === 'string' ? body.email.trim() : ''
    website = cleanWebsite(body.website)
    if (!name || name.length > 80) return fail(c, 'A name (under 80 chars) is required', 400)
    if (!EMAIL_RE.test(email) || email.length > 120) return fail(c, 'A valid email is required', 400)

    const { turnstileConfigured } = await getCommentEnv()
    if (comments.turnstile && turnstileConfigured) {
      if (!(await verifyTurnstile(turnstileToken, ip))) {
        return fail(c, 'Verification failed — please try again', 400)
      }
    } else {
      // The blog's own gate (ADR 0032). 409 for a stale challenge is a SEPARATE answer from
      // 400 on purpose: the island re-solves a fresh one and sends again, so a page that sat
      // in a cache does not cost somebody the paragraph they just wrote.
      const verdict = verifyStamp(body.stamp)
      if (verdict === 'expired') return fail(c, 'This page has been open a while — sending again', 409)
      if (verdict !== 'ok') {
        return fail(c, 'Verification failed — please try again', 400)
      }
    }
  }

  let created
  try {
    created = await addComment({
      postSlug, parentId, name, email, website, provider: signedIn ? 'google' : 'manual',
      content, ip: ip === 'unknown' ? '' : ip, country,
    })
  } catch (error) {
    // Bad input (missing parent, reply too deep) is a 400, not a 500.
    if (error instanceof CommentInputError) return fail(c, error.message, 400)
    throw error
  }

  await logActivity('comment.create', postSlug)
  // The spam gate (comments/comment-guard.ts): background, hold-in-Trash, never delete.
  void guardComment(created.id, name, content, website)
  // A reply emails the parent commenter. Best-effort and awaited: without SMTP it is a
  // no-op, and with it the send is fast enough not to be worth deferring past a response
  // that is already writing to the database.
  if (parentId !== null) {
    await notifyReply({
      parentId, postSlug, replierName: name, replierEmail: email, contentHtml: created.contentHtml,
    })
  }
  return json({ comment: created })
}
