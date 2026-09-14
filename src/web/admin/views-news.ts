// The newsletter's two payloads: what can be sent, and who it would go to.
//
// Split from `views.ts` for the reason `views-home.ts` was, and the same one that keeps that
// file honest: it sits near its 400-line limit, and the Newsletter screen's conversion to
// server-rendered HTML (ADR 0054) needs a second view beside the first. One home for both.
//
// ⚠️ EVERYTHING HERE IS A READ. `src/news/` also holds the functions that open a TCP
// connection to a relay and put mail on it, and none of them is imported by this file or may
// ever be: a view is rendered by a GET, and a GET that sends a newsletter is the one bug this
// product cannot apologise for.
import { getPublicPosts } from '@/content/posts'
import { statsByPost, statsByEmail } from '@/news/newsletter-log'
import { getMailStatus } from '@/news/mail'
import { listSubscribers } from '@/news/subscribers'

/** The published posts a broadcast can carry, each with what it has already been sent to. */
export async function newsletterView() {
  const [posts, stats, mail] = await Promise.all([
    getPublicPosts(), statsByPost(), getMailStatus(),
  ])
  return {
    posts: posts.map((p) => ({
      slug: p.slug, title: p.title, date: p.date, stats: stats.get(p.slug) ?? null,
    })),
    mailConfigured: mail.configured,
  }
}

/**
 * Who is on the list, what each address has actually been sent, and the three counts the
 * band prints.
 *
 * THE COUNTS ARE FOLDED FROM THE LIST, not asked for separately. `subscriberCounts()` is
 * implemented by calling `listSubscribers()` a second time and filtering it three ways, so
 * asking for both read the whole table twice to answer one question. Same numbers, one read.
 *
 * The counts are over the WHOLE live set and never the filtered one: a total that changes as
 * you type is not a total.
 *
 * ⚠️ `getConfirmedSubscribers()` is the neighbouring function and it must never be used here.
 * It returns each address with its UNSUBSCRIBE TOKEN, which is a credential: anyone holding
 * one can take that reader off the list. This view goes to a client-bound payload.
 */
export async function subscribersView() {
  const [subscribers, stats] = await Promise.all([listSubscribers(), statsByEmail()])
  const counts = { confirmed: 0, pending: 0, unsubscribed: 0 }
  for (const s of subscribers) counts[s.status] += 1
  return {
    subscribers: subscribers.map((s) => ({ ...s, stats: stats.get(s.email) ?? null })),
    counts,
  }
}
