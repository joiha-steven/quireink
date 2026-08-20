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

/** A form filled faster than this was filled by nothing with hands. */
const MIN_FILL_MS = 3_000

type Submission = { email: string; wantsHtml: boolean; honeypot: string; renderedAt: number | null }

/**
 * Read the address from either a JSON body or a form post.
 *
 * DELIBERATE DEVIATION, and the reason is worth stating. The frozen tree only ever built
 * its sign-up form in JavaScript, so a reader without it saw no form and lost nothing.
 * 2.0 renders the form server-side — to keep it out of the JavaScript budget and out of
 * the layout shift — which means a reader without JavaScript now CAN submit it. Answering
 * their submit with a page of JSON would be a defect I created, not one I ported. So the
 * endpoint takes both, and replies in kind.
 *
 * Both carry the bot traps: `website` is the honeypot (a field no human can see, so a
 * value in it is a confession) and `ts` is when the form was rendered.
 */
async function readEmail(c: Context): Promise<Submission> {
  const type = c.req.header('content-type') ?? ''
  const fields = type.includes('form')
    ? ((await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>)
    : ((await c.req.json().catch(() => ({}))) as Record<string, unknown>)
  const ts = typeof fields.ts === 'string' ? Number(fields.ts) : NaN
  return {
    email: typeof fields.email === 'string' ? fields.email : '',
    wantsHtml: type.includes('form'),
    honeypot: typeof fields.website === 'string' ? fields.website : '',
    renderedAt: Number.isFinite(ts) && ts > 0 ? ts : null,
  }
}

/**
 * Is this submission a machine's? Two cheap tells, both silent on failure.
 *
 * The honeypot is the load-bearing one: it works whatever cached copy of the page the
 * form came from. The fill-time check only REJECTS too-fast — a missing or ancient `ts`
 * passes, because the page cache and the CDN legitimately serve forms rendered minutes
 * ago, and the enhanced (JavaScript) path never sends one at all. Neither tell is told:
 * a caught bot gets the same cheerful answer a reader gets, because an error message to
 * a bot author is a specification of the next bot.
 */
function looksLikeBot(sub: Submission): boolean {
  if (sub.honeypot !== '') return true
  return sub.renderedAt !== null && Date.now() - sub.renderedAt < MIN_FILL_MS
}

export async function handleSubscribe(c: Context): Promise<Response> {
  if (rateLimited(`subscribe:${clientIp(c)}`, SIGNUPS_PER_MINUTE)) {
    return fail(c, 'Too many requests', 429)
  }
  const sub = await readEmail(c)
  const { email, wantsHtml } = sub

  /** The answer, as JSON for the island and as a page for a plain form post. */
  const reply = async (status: string, title: string, body = ''): Promise<Response> => {
    if (!wantsHtml) return json({ status })
    const settings = await getSettings()
    return resultPage(title, body, resolveSiteUrl(settings), settings.title)
  }

  // A bot gets the success page and nothing else: no row, no email, no hint. Before
  // `addSubscriber`, so a bombing run cannot even fill the pending list with junk.
  if (looksLikeBot(sub)) {
    const settings = await getSettings()
    return reply('sent', t(settings.language).nlSuccess)
  }

  let token: string
  let alreadyConfirmed: boolean
  let sendConfirm: boolean
  try {
    ({ token, alreadyConfirmed, sendConfirm } = await addSubscriber(email))
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

  // Cooling down: a confirm email already left for this address within the hour. The row
  // is pending and the earlier email still works, so there is nothing to send — and the
  // reply says "sent" anyway, because "try again later" addressed to a bombing script is
  // instructions, and addressed to a reader is a lie (their link IS in the inbox).
  if (!sendConfirm) return reply('sent', tx.nlSuccess)

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
