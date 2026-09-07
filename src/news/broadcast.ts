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
import { getSmtpConfig, isMailConfigured, openMailPool, sendMail } from '@/news/mail'
import { getSettings } from '@/content/settings'
import { emailBrand } from '@/news/email-brand'
import { broadcastEmail, type EmailPost } from '@/news/newsletter-email'
import { newOpenToken, statsByPost } from '@/news/newsletter-log'
import { expandBlob } from '@/media/blob'
import { isPublicallyVisible } from '@/utils'
import type { SiteLang } from '@/types'
import { t, formatDate } from '@/i18n/i18n'
import { all, run } from '@/store/query'
import { logActivity } from '@/server/activity'
import { liveOnly, nowMs, toIso } from '@/store/db'

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
 * One at a time, in this process. Two overlapping runs of the same posts is the duplicate
 * send this whole file is built to prevent.
 */
export type BroadcastRun = {
  slugs: string[]
  recipients: number
  sent: number
  failed: number
  done: boolean
  startedAt: number
}

let current: BroadcastRun | null = null

/** The run in progress, or the last one to finish. Null before the first send of a process. */
export function broadcastRun(): BroadcastRun | null {
  return current
}

/** Test seam: a run left behind by one test must not refuse the next one's send. */
export function resetBroadcastRun(): void {
  current = null
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
  if (current && !current.done) throw new BroadcastError('already_running')
  const settings = await getSettings()
  const posts = await readSendablePosts(slugs, settings.language, settings.timezone)
  if (!opts.force) {
    const prior = await statsByPost()
    if (slugs.some((s) => (prior.get(s)?.sent ?? 0) > 0)) throw new BroadcastError('already_sent')
  }
  const cfg = await getSmtpConfig()
  if (!isMailConfigured(cfg)) throw new BroadcastError('smtp_not_configured')

  const subs = await getConfirmedSubscribers()
  const started: BroadcastRun = {
    slugs, recipients: subs.length, sent: 0, failed: 0, done: false, startedAt: Date.now(),
  }
  current = started
  void deliver(started, subs, posts, emailBrand(settings), t(settings.language))
  return started
}

async function deliver(
  state: BroadcastRun,
  subs: { email: string; token: string }[],
  posts: EmailPost[],
  brand: ReturnType<typeof emailBrand>,
  tx: ReturnType<typeof t>,
): Promise<void> {
  // One pooled connection for the whole run rather than one per address, and closed with it.
  const pool = await openMailPool()
  try {
    for (const s of subs) {
      const openToken = newOpenToken()
      const { subject, html } = broadcastEmail(tx, brand, posts, s.token, openToken)
      const res = await sendMail({ to: s.email, subject, html, kind: 'broadcast', postSlugs: state.slugs, openToken })
      if (res.sent) state.sent++
      else state.failed++
    }
  } catch (error) {
    console.error(`[ERROR] broadcast.deliver: ${(error as Error).message}`)
  } finally {
    pool?.close()
    // Stamp even when nobody was reachable: it records that these posts have been through
    // the send flow, and keeps the column meaningful for anything still reading it.
    run(
      `update posts set broadcast_at = ? where slug in (select value from json_each(?))`,
      nowMs(), keyList(state.slugs),
    )
    state.done = true
    void logActivity('newsletter.send', `${state.slugs.join(',')} — ${state.sent}/${state.recipients}`)
  }
}
