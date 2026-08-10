// The public newsletter surface: sign up, confirm, unsubscribe, and the open pixel.
//
// Double opt-in throughout. A sign-up creates a PENDING subscriber and emails a confirm
// link; nothing is broadcast to an address until it clicks. That is not politeness, it is
// what keeps a typo'd or malicious sign-up from turning this blog into a source of mail
// somebody never asked for.

import type { Context } from 'hono'
import { addSubscriber, confirmSubscriber, unsubscribeByToken, SubscribeError } from '@/news/subscribers'
import { recordOpen } from '@/news/newsletter-log'
import { sendMail } from '@/news/mail'
import { confirmEmail } from '@/news/newsletter-email'
import { confirmPage, resultPage } from '@/news/newsletter-html'
import { emailBrand } from '@/news/email-brand'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { t } from '@/i18n/i18n'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { fail, json } from '@/web/api'

/** Tight, unlike the analytics cap: each attempt can send an email to a stranger. */
const SIGNUPS_PER_MINUTE = 5

/**
 * Read the address from either a JSON body or a form post.
 *
 * DELIBERATE DEVIATION, and the reason is worth stating. The frozen tree only ever built
 * its sign-up form in JavaScript, so a reader without it saw no form and lost nothing.
 * 2.0 renders the form server-side — to keep it out of the JavaScript budget and out of
 * the layout shift — which means a reader without JavaScript now CAN submit it. Answering
 * their submit with a page of JSON would be a defect I created, not one I ported. So the
 * endpoint takes both, and replies in kind.
 */
async function readEmail(c: Context): Promise<{ email: string; wantsHtml: boolean }> {
  const type = c.req.header('content-type') ?? ''
  if (type.includes('form')) {
    const form = await c.req.parseBody().catch(() => ({}))
    const value = (form as Record<string, unknown>).email
    return { email: typeof value === 'string' ? value : '', wantsHtml: true }
  }
  const body = (await c.req.json().catch(() => ({}))) as { email?: unknown }
  return { email: typeof body.email === 'string' ? body.email : '', wantsHtml: false }
}

export async function handleSubscribe(c: Context): Promise<Response> {
  if (rateLimited(`subscribe:${clientIp(c)}`, SIGNUPS_PER_MINUTE)) {
    return fail(c, 'Too many requests', 429)
  }
  const { email, wantsHtml } = await readEmail(c)

  /** The answer, as JSON for the island and as a page for a plain form post. */
  const reply = async (status: string, title: string, body = ''): Promise<Response> => {
    if (!wantsHtml) return json({ status })
    const settings = await getSettings()
    return resultPage(title, body, resolveSiteUrl(settings), settings.title)
  }

  let token: string
  let alreadyConfirmed: boolean
  try {
    ({ token, alreadyConfirmed } = await addSubscriber(email))
  } catch (error) {
    if (!(error instanceof SubscribeError)) throw error
    if (!wantsHtml) return fail(c, 'invalid_email', 400)
    const settings = await getSettings()
    const page = resultPage(t(settings.language).nlInvalid, '', resolveSiteUrl(settings), settings.title)
    // 400 for the form path too. The status code describes the request, not how the answer
    // is presented, and a 200 here tells every log and every monitor that it worked.
    return new Response(page.body, { status: 400, headers: page.headers })
  }

  // Already on the list: nothing to send, and the answer is the same as a fresh sign-up.
  // Saying "you are already subscribed" would turn this endpoint into a way to test
  // whether a given address reads this blog.
  const settings = await getSettings()
  if (alreadyConfirmed) {
    return reply('already', t(settings.language).nlSuccess, t(settings.language).nlThanksBody)
  }

  const tx = t(settings.language)
  const confirmUrl = `${resolveSiteUrl(settings)}/api/newsletter/confirm?token=${encodeURIComponent(token)}`
  const { subject, html } = confirmEmail(tx, emailBrand(settings), confirmUrl)

  // Best-effort. The row is already pending, so an unconfigured mail server costs the
  // reader their confirm link but the owner can still see the sign-up and act on it.
  const { sent } = await sendMail({ to: email.trim().toLowerCase(), subject, html, kind: 'confirm' })
  return sent
    ? reply('sent', tx.nlSuccess)
    : reply('pending_no_mail', tx.nlNoMail)
}

export async function handleConfirm(c: Context): Promise<Response> {
  const confirmed = await confirmSubscriber(c.req.query('token') ?? '')
  const settings = await getSettings()
  const tx = t(settings.language)
  const base = resolveSiteUrl(settings)
  return confirmed
    ? resultPage(tx.nlThanksTitle, tx.nlThanksBody, base, settings.title)
    : resultPage(tx.nlLinkInvalid, '', base, settings.title)
}

/**
 * GET shows a page with a button; the unsubscribe itself happens on POST.
 *
 * Mail clients and link scanners follow GETs. Unsubscribing on GET means a reader can be
 * removed from the list by a security appliance that merely looked at their inbox. A
 * List-Unsubscribe one-click POST from the mail client lands on the POST handler directly,
 * which is the case this shape exists to keep working.
 */
export async function handleUnsubscribeGet(c: Context): Promise<Response> {
  const token = c.req.query('token') ?? ''
  const tx = t((await getSettings()).language)
  return confirmPage(
    tx.nlUnsubFooter,
    tx.nlUnsubConfirm,
    tx.nlUnsubConfirmBtn,
    `/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
  )
}

export async function handleUnsubscribePost(c: Context): Promise<Response> {
  // Idempotent: the same page whether or not anything changed. A reader clicking twice
  // should not be told the second click failed.
  await unsubscribeByToken(c.req.query('token') ?? '')
  const settings = await getSettings()
  const tx = t(settings.language)
  return resultPage(tx.nlUnsubTitle, tx.nlUnsubBody, resolveSiteUrl(settings), settings.title)
}

// The smallest transparent GIF, 42 bytes, inline. The open pixel needs no file and no
// image library, and embedding it keeps it working in a compiled binary for free.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

/**
 * The open-tracking pixel in a broadcast, fetched by the reader's mail client.
 *
 * Deliberately dumb. The token maps to a SEND, never to an address, so the URL carries no
 * identity, and no IP, user-agent or referrer is recorded. An unknown token is a silent
 * no-op that still returns a valid GIF: a 404 inside somebody's inbox is a broken image
 * where there should be nothing at all.
 */
export async function handleOpenPixel(c: Context): Promise<Response> {
  const token = c.req.query('t') ?? ''
  if (token) await recordOpen(token)
  return new Response(new Uint8Array(PIXEL), {
    headers: {
      'content-type': 'image/gif',
      'content-length': String(PIXEL.length),
      // Never cached. A cached pixel hides every later open, and the proxies in front of
      // some inboxes would serve it without ever reaching this server.
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
}
