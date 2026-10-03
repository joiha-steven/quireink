// Manual newsletter broadcast: email one or more chosen posts to the confirmed
// subscribers, triggered by the owner from Admin → Newsletter. There is no automatic
// send — a scheduled post goes live on time but never mails anyone by itself (owner's
// call: every send is previewed and pressed by hand).
//
// Several posts = ONE digest email (newest leads, the rest follow), not one email per
// post — picking three posts should not put three messages in someone's inbox.
//
// Every subscriber gets their OWN message: the unsubscribe link and the open pixel are
// per-recipient, so a single BCC blast would break both.
//
// Double-send guard: `posts.broadcast_at` is stamped on every send, and the caller must
// pass `force` to send a post that already has successful sends in the log. The LOG is
// the source of truth for "already sent", not the stamp — older posts carry a backfilled
// stamp from the retired auto-broadcast with no matching log rows.
// SERVER-ONLY.

import { getConfirmedSubscribers } from '@/news/subscribers'
import { getSmtpConfig, mailBlocked, openMailPool, sendMail } from '@/news/mail'
import { getSettings } from '@/content/settings'
import { emailBrand } from '@/news/email-brand'
import { broadcastEmail, type EmailBrand, type EmailPost } from '@/news/newsletter-email'
import { logSend, statsByPost } from '@/news/newsletter-log'
import {
  claimNext, HEARTBEAT_MS, hasOpenRun, INTERRUPTED, latestRun, leaseLapsed, openRun, recordResult, releaseLease, renewLease,
  type BroadcastRun,
} from '@/news/outbox'
import { randomBytes } from 'node:crypto'
import { expandBlob } from '@/media/blob'
import { isPublicallyVisible } from '@/utils'
import type { SiteLang } from '@/types'
import { t, formatDate } from '@/i18n/i18n'
import { all } from '@/store/query'
import { logActivity } from '@/server/activity'
import { liveOnly, toIso } from '@/store/db'

export class BroadcastError extends Error {}

type Row = { slug: string; title: string; excerpt: string | null; cover_image: string | null; status: string; date: number }

const keyList = (keys: string[]) => JSON.stringify(keys)

// Read the chosen posts, IN THE ORDER GIVEN (the admin lists newest-first, so the lead
// of a digest is whatever the owner ticked first). Only publicly-visible posts can be
// mailed — the email links straight to them.
async function readSendablePosts(slugs: string[], lang: SiteLang, tz: string): Promise<EmailPost[]> {
  if (slugs.length === 0) throw new BroadcastError('no_posts')
  const rows = all<Row>(
    `select slug, title, excerpt, cover_image, status, date from posts
      where ${liveOnly('posts')} and slug in (select value from json_each(?))`,
    keyList(slugs),
  )
  const found = new Map(rows.map((r) => [r.slug, r]))
  return slugs.map((slug) => {
    const row = found.get(slug)
    if (!row) throw new BroadcastError('post_not_found')
    const date = toIso(row.date)
    if (!isPublicallyVisible(row.status, date)) throw new BroadcastError('post_not_public')
    return {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      // Cover refs are stored store-relative (Invariant 3) — an email needs the real URL.
      coverImage: row.cover_image ? expandBlob(row.cover_image) : null,
      dateLabel: formatDate(date, lang, tz),
    }
  })
}

// Subject + HTML exactly as a subscriber would receive it, minus the tracking pixel and
// with a placeholder unsubscribe token — for the admin preview pane. `recipients` is read
// off the SAME list the send will use, because the armed send button prints it: a count
// from anywhere else could disagree with what the second press actually does.
export async function previewBroadcast(slugs: string[]): Promise<{ subject: string; html: string; recipients: number }> {
  const settings = await getSettings()
  const posts = await readSendablePosts(slugs, settings.language, settings.timezone)
  const email = broadcastEmail(t(settings.language), emailBrand(settings), posts, 'preview-token')
  return { ...email, recipients: (await getConfirmedSubscribers()).length }
}

/**
 * A SEND IS NOT A REQUEST.
 *
 * The loop used to run inside the POST that started it. `Bun.serve` closes a response that
 * has sent no bytes after two minutes, and a thousand addresses over one connection per
 * address took far longer than that, so the admin was told "broadcast_failed" while the mail
 * was still going out — and the only thing offered next was a button that sends the whole
 * list a second time. The run is detached now and the request answers at once with what it
 * has started; the screen watches it through `broadcastRun`.
 *
 * AND IT IS NOT A PROCESS EITHER. The detached loop kept its place in memory, so a restart —
 * every deploy of a Durable Object, any eviction, a Bun upgrade — cut the list off where it
 * stood. The place is kept in the database now (`news/outbox.ts`), and the minute tick picks a
 * run back up wherever it stopped, with the same one connection and one message at a time.
 *
 * One at a time, for the whole blog and not only this process: `openRun` refuses a second run
 * while one is open, and the lease lets exactly one runner deliver it. Two overlapping runs of
 * the same posts is the duplicate send this whole file is built to prevent.
 */
export type { BroadcastRun }

/** What a message is made of, fixed at the press, so the second half of a resumed list gets the same letter. */
type Letter = { posts: EmailPost[]; brand: EmailBrand; lang: SiteLang }

/** This process's runner while it runs; null before the first send and between runs. */
let runner: Promise<void> | null = null

/** The run in progress, or the last one to finish. Null before this blog's first send. */
export function broadcastRun(): BroadcastRun | null {
  return latestRun()
}

/** Test seam: forget this process's runner, as a restart does. The database keeps what it holds. */
export function resetBroadcastRun(): void {
  runner = null
}

// Send the chosen posts as one email to every confirmed subscriber. Each send is logged
// (kind 'broadcast') with its own open token.
//
// Everything that can REFUSE the send is decided here, before returning: an unknown slug, a
// post that is not public, a repeat without consent, no SMTP. What is left is the delivering,
// and that is what runs on without us.
export async function broadcastPosts(
  slugs: string[],
  opts: { force?: boolean } = {},
): Promise<BroadcastRun> {
  if (hasOpenRun()) throw new BroadcastError('already_running')
  const settings = await getSettings()
  const posts = await readSendablePosts(slugs, settings.language, settings.timezone)
  if (!opts.force) {
    const prior = await statsByPost()
    if (slugs.some((s) => (prior.get(s)?.sent ?? 0) > 0)) throw new BroadcastError('already_sent')
  }
  const cfg = await getSmtpConfig()
  // The reason, not just the refusal: the screen prints this code, and "switched off here" is
  // a different thing for the owner to do about it than "not configured".
  const blocked = mailBlocked(cfg)
  if (blocked) throw new BroadcastError(blocked)

  // The whole list is written down before the first message goes (`news/outbox.ts`).
  const letter: Letter = { posts, brand: emailBrand(settings), lang: settings.language }
  const subs = await getConfirmedSubscribers()
  const started = openRun({ slugs, letter: JSON.stringify(letter), subs, now: Date.now() })
  if (!started) throw new BroadcastError('already_running')
  void resumeBroadcast()
  return started
}

/**
 * Deliver whatever a send still owes, from wherever it stopped. Called by the press, and by both
 * ticks of the clock (`server/tick.ts`) — the Durable Object's alarm and Bun's timer — which is
 * how a list cut off by a restart carries on within a minute or two of the blog coming back.
 *
 * Returns at once with the runner, which goes on detached as the press's always did. A runner of
 * this process that is still renewing its lease is left alone. One whose lease has lapsed is not
 * trusted to be alive — on Cloudflare a module outlives the object it ran for, and a promise left
 * by an evicted object can stay unresolved for ever — so a new one starts, which is safe because
 * no address can be claimed twice.
 */
export function resumeBroadcast(): Promise<void> | null {
  if (!hasOpenRun()) return null
  if (runner && !leaseLapsed()) return runner
  const mine: Promise<void> = deliver().finally(() => {
    if (runner === mine) runner = null
  })
  runner = mine
  return mine
}

async function deliver(): Promise<void> {
  const owner = randomBytes(9).toString('base64url')
  const beat = setInterval(() => {
    try {
      renewLease(owner)
    } catch (error) {
      console.error(`[ERROR] broadcast.heartbeat: ${(error as Error).message}`)
    }
  }, HEARTBEAT_MS)
  ;(beat as { unref?: () => void }).unref?.()
  // One pooled connection for the whole run rather than one per address, and closed with it.
  // Opened at the first message, so a runner that finds the lease taken never dials the relay.
  let pool: { close: () => void } | null | undefined
  // The letter, parsed once per run rather than once per address.
  let letterOf = 0
  let render: (token: string, openToken: string) => { subject: string; html: string } = () => ({ subject: '', html: '' })
  try {
    for (;;) {
      const step = claimNext(owner)
      if (step.kind === 'idle' || step.kind === 'busy') return
      // A dead runner's message in doubt, written down once by the runner that took over.
      for (const gone of step.interrupted) {
        await logSend({ email: gone.email, kind: 'broadcast', ok: false, postSlugs: gone.slugs, error: INTERRUPTED })
      }
      if (step.kind === 'finished') {
        void logActivity('newsletter.send', `${step.run.slugs.join(',')} — ${step.run.sent}/${step.run.recipients}`)
        return
      }
      if (letterOf !== step.runId) {
        const l = JSON.parse(step.letter) as Letter
        const words = t(l.lang)
        letterOf = step.runId
        render = (token, openToken) => broadcastEmail(words, l.brand, l.posts, token, openToken)
      }
      if (pool === undefined) pool = await openMailPool()
      const { subject, html } = render(step.token, step.openToken)
      const res = await sendMail({ to: step.email, subject, html, kind: 'broadcast', postSlugs: step.slugs, openToken: step.openToken })
      // False when another runner holds the lease now: it carries on, and this one must not.
      if (!recordResult(owner, step.id, res.sent)) return
    }
  } catch (error) {
    console.error(`[ERROR] broadcast.deliver: ${(error as Error).message}`)
  } finally {
    clearInterval(beat)
    pool?.close()
    try {
      releaseLease(owner)
    } catch { /* the database closed under it; the lease lapses by itself */ }
  }
}
