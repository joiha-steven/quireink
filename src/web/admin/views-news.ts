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
import { all } from '@/store/query'

/**
 * WHO each post reached, as DISTINCT addresses, written as small integers (an index into the
 * addresses met on the way) so the page can take the union across several ticked posts without
 * shipping the addresses themselves. `stats.sent` cannot answer this: it counts rows, so a
 * deliberate resend to the same 18 reads 36, and a digest credits each of its posts with the
 * same 18 again.
 */
function reachedByPost(): Map<string, number[]> {
  const seen = new Map<string, number>()
  const sets = new Map<string, Set<number>>()
  try {
    for (const r of all<{ email: string; post_slug: string }>(
      `select email, post_slug from newsletter_sends
        where kind = 'broadcast' and ok = 1 and post_slug is not null`,
    )) {
      let i = seen.get(r.email)
      if (i === undefined) { i = seen.size; seen.set(r.email, i) }
      for (const slug of r.post_slug.split(',')) {
        const set = sets.get(slug) ?? new Set<number>()
        set.add(i)
        sets.set(slug, set)
      }
    }
  } catch (error) {
    console.error(`[ERROR] views-news.reachedByPost: ${(error as Error).message}`)
  }
  return new Map([...sets].map(([slug, set]) => [slug, [...set]]))
}

/** The published posts a broadcast can carry, each with what it has already been sent to. */
export async function newsletterView() {
  const [posts, stats, mail] = await Promise.all([
    getPublicPosts(), statsByPost(), getMailStatus(),
  ])
  const reached = reachedByPost()
  return {
    posts: posts.map((p) => ({
      slug: p.slug, title: p.title, date: p.date, stats: stats.get(p.slug) ?? null,
      reached: reached.get(p.slug) ?? [],
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
/**
 * How many people the list draws at once.
 *
 * A newsletter is the one list here that grows without anybody deciding to grow it: every
 * sign-up adds a row, and a blog with twenty thousand readers drew twenty thousand rows and a
 * second copy of each for the phone layout. The three counts above the table are the WHOLE list
 * and are counted before the slice, because "1,240 confirmed" is the number the owner came for.
 */
export const PEOPLE_PAGE = 200

export async function subscribersView(page = 1) {
  const [subscribers, stats] = await Promise.all([listSubscribers(), statsByEmail()])
  const counts = { confirmed: 0, pending: 0, unsubscribed: 0 }
  for (const s of subscribers) counts[s.status] += 1
  const at = Math.max(1, Math.floor(page) || 1)
  const shown = subscribers.slice((at - 1) * PEOPLE_PAGE, at * PEOPLE_PAGE)
  return {
    subscribers: shown.map((s) => ({ ...s, stats: stats.get(s.email) ?? null })),
    counts,
    at,
    pages: Math.max(1, Math.ceil(subscribers.length / PEOPLE_PAGE)),
  }
}
