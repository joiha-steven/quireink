// WHAT THE BLOG STILL HAS TO SAY, worked out by comparison rather than by being told.
//
// ADR 0059. A post can become public three ways — a save that publishes it, the minute tick
// flipping a scheduled one live, and an MCP call — and can stop being public two more. Hooking
// each of them is five places to remember, and the sixth is the one somebody adds next year.
//
// So nothing calls in here. The sweep reads the public posts, reads what has already been
// announced, and the difference IS the work: a post with no row is a `Create`, a row whose
// digest has changed is an `Update`, and a row whose post is no longer public is a `Delete`.

import type { SiteSettings } from '@/types'
import { getPublicPosts } from '@/content/posts'
import { langOf } from '@/content/translations'
import { actorOf } from '@/ap/actor'
import { createOf, deleteOf, noteOf, updateOf } from '@/ap/objects'
import {
  announced, digestOfNote, enqueue, forgetAnnounced, inboxesToReach, rememberAnnounced,
} from '@/ap/store'

/**
 * How many posts one pass may announce.
 *
 * ⚠️ THE BACK CATALOGUE IS THE REASON THIS IS BOUNDED AT ALL. Even with the cutoff below, a blog
 * that publishes ten pieces in an hour, or restores a dozen from the trash at once, would
 * otherwise put every one of them into every follower's timeline in the same second. A handful
 * a minute is a blog posting; forty at once is a blog nobody follows for long.
 */
export const PER_PASS = 3

export type Announcement = { kind: 'Create' | 'Update' | 'Delete'; objectId: string }

/**
 * Work out and queue what has changed.
 *
 * `since` is when this blog's key was made, which is the moment ActivityPub was first switched
 * on. Posts older than that are NEVER announced.
 *
 * ⚠️ WITHOUT THAT CUTOFF, TURNING THE SWITCH ON PUBLISHES A DECADE OF WRITING AT ONCE, into the
 * timeline of everybody who follows the blog five minutes later. It is the single worst thing
 * this feature could do to somebody, it cannot be taken back, and it is what the naive version
 * of a state comparison does on its first run.
 */
export function pendingAnnouncements(args: {
  settings: SiteSettings
  site: string
  since: number
  posts: Awaited<ReturnType<typeof getPublicPosts>>
}): { note: Record<string, unknown> | null; activity: Record<string, unknown>; kind: Announcement['kind']; objectId: string; slug: string; digest: string }[] {
  const { settings, site, since, posts } = args
  const actor = actorOf(site, settings.activitypub.handle)
  const seen = new Map(announced().map((a) => [a.objectId, a]))
  const out: ReturnType<typeof pendingAnnouncements> = []

  for (const post of posts) {
    if (new Date(post.date).getTime() < since) continue
    const note = noteOf({ post, site, actor, lang: langOf(post, settings.language) })
    const objectId = note.id as string
    const digest = digestOfNote(note)
    const already = seen.get(objectId)
    seen.delete(objectId)
    if (!already) {
      out.push({ note, activity: createOf(note, actor), kind: 'Create', objectId, slug: post.slug, digest })
    } else if (already.digest !== digest) {
      const at = post.updatedAt ?? new Date().toISOString()
      out.push({ note, activity: updateOf(note, actor, at), kind: 'Update', objectId, slug: post.slug, digest })
    }
  }

  // ⚠️ WHAT IS LEFT IN `seen` IS WHAT IS GONE, and "gone" covers more than the trash: a post
  // moved back to draft, a slug renamed (the old URL is a different object), a purge. All of
  // them mean the same thing to a follower's timeline, and all of them reach it the same way.
  for (const [objectId] of seen) {
    const at = new Date().toISOString()
    out.push({
      note: null, activity: deleteOf(objectId, actor, at), kind: 'Delete',
      objectId, slug: '', digest: '',
    })
  }
  return out
}

/**
 * Queue the next few announcements, and remember them as said.
 *
 * ⚠️ REMEMBERED WHEN QUEUED, NOT WHEN DELIVERED. A delivery can fail for one follower's server
 * and succeed for the other three hundred, so "has this been announced" is a fact about this
 * blog rather than about any one of them — and a ledger written on delivery would announce the
 * post again on the next pass for as long as any single server stayed down.
 *
 * With nobody following, nothing is queued and everything is still remembered: a blog that
 * switches this on and writes for a week before its first follower arrives should not then
 * deliver that week to them.
 */
export async function sweepAnnounce(args: {
  settings: SiteSettings
  site: string
  since: number
  limit?: number
}): Promise<Announcement[]> {
  const posts = await getPublicPosts()
  const work = pendingAnnouncements({ ...args, posts }).slice(0, args.limit ?? PER_PASS)
  if (work.length === 0) return []
  const inboxes = inboxesToReach()
  const done: Announcement[] = []
  for (const item of work) {
    if (inboxes.length > 0) enqueue(JSON.stringify(item.activity), inboxes)
    if (item.kind === 'Delete') forgetAnnounced(item.objectId)
    else rememberAnnounced(item.objectId, item.slug, item.digest)
    done.push({ kind: item.kind, objectId: item.objectId })
  }
  return done
}
