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
import { getSmtpConfig, isMailConfigured, sendMail } from '@/news/mail'
import { getSettings } from '@/content/settings'
import { emailBrand } from '@/news/email-brand'
import { broadcastEmail, type EmailPost } from '@/news/newsletter-email'
import { newOpenToken, statsByPost } from '@/news/newsletter-log'
import { expandBlob } from '@/media/blob'
import { isPublicallyVisible } from '@/utils'
import type { SiteLang } from '@/types'
import { t, formatDate } from '@/i18n/i18n'
import { all, run } from '@/store/query'
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

// Send the chosen posts as one email to every confirmed subscriber. Each send is logged
// (kind 'broadcast') with its own open token.
export async function broadcastPosts(
  slugs: string[],
  opts: { force?: boolean } = {},
): Promise<{ sent: number; failed: number; recipients: number }> {
  const settings = await getSettings()
  const posts = await readSendablePosts(slugs, settings.language, settings.timezone)
  if (!opts.force) {
    const prior = await statsByPost()
    if (slugs.some((s) => (prior.get(s)?.sent ?? 0) > 0)) throw new BroadcastError('already_sent')
  }
  const cfg = await getSmtpConfig()
  if (!isMailConfigured(cfg)) throw new BroadcastError('smtp_not_configured')

  const subs = await getConfirmedSubscribers()
  const brand = emailBrand(settings)
  const tx = t(settings.language)

  let sent = 0
  let failed = 0
  for (const s of subs) {
    const openToken = newOpenToken()
    const { subject, html } = broadcastEmail(tx, brand, posts, s.token, openToken)
    const res = await sendMail({ to: s.email, subject, html, kind: 'broadcast', postSlugs: slugs, openToken })
    if (res.sent) sent++
    else failed++
  }
  // Stamp even when nobody was reachable: it records that these posts have been through
  // the send flow, and keeps the column meaningful for anything still reading it.
  run(
    `update posts set broadcast_at = ? where slug in (select value from json_each(?))`,
    nowMs(), keyList(slugs),
  )
  return { sent, failed, recipients: subs.length }
}
