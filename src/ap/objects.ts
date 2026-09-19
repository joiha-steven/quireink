// A POST, AS THE FEDIVERSE READS IT, and the four activities that carry it.
//
// ADR 0059. Pure: a post and a few facts in, a plain object out. Nothing here fetches, signs or
// stores, so every shape below can be asserted whole — which matters more than usual, because
// the way these get it wrong is not an error anywhere. A malformed object is accepted with a
// 202 and dropped, or shown in somebody's timeline as an empty box.

import type { Post, SiteLang } from '@/types'
import { escapeHtml } from '@/utils'

/** The public collection every public activity is addressed to. It is a URL, not a keyword. */
export const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'

/** The JSON-LD context every object needs, plus the one extension the key lives under. */
const CONTEXT = [
  'https://www.w3.org/ns/activitystreams',
  'https://w3id.org/security/v1',
] as const

/** Who is speaking: the three URLs an activity needs to name its author and its audience. */
export type Actor = {
  id: string
  followers: string
  /** The `@name` half of `@name@host`, for a mention of this blog. */
  handle: string
}

export type Json = Record<string, unknown>

/**
 * ⚠️ A `Note`, NOT AN `Article`, AND THAT IS A JUDGEMENT RATHER THAN A READING OF THE SPEC.
 *
 * `Article` is what a blog post IS, and Mastodon renders one as a bare link with no words —
 * which means the owner's writing arrives in a follower's timeline as an unexplained URL. A
 * `Note` carrying the title, the standfirst and the link renders as a paragraph everywhere, and
 * the canonical article stays where it was written. The cost is stated: a reader who looks at
 * the raw object sees a Note where the semantics wanted an Article.
 *
 * `id` IS THE PAGE'S OWN URL. One address, two representations, chosen by `Accept` — which is
 * what the specification asks for and what makes the object findable by anyone who has the link.
 */
export function noteOf(args: {
  post: Post
  site: string
  actor: Actor
  lang: SiteLang
}): Json {
  const { post, site, actor, lang } = args
  const url = `${site}/${post.slug}`
  const body = [
    `<p><strong>${escapeHtml(post.title)}</strong></p>`,
    post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : '',
    `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
  ].join('')
  return {
    id: url,
    type: 'Note',
    attributedTo: actor.id,
    published: post.date,
    ...(post.updatedAt ? { updated: post.updatedAt } : {}),
    to: [PUBLIC],
    cc: [actor.followers],
    // `sensitive` is required reading for some servers and absent here on purpose: nothing this
    // blog publishes is behind a content warning, and claiming otherwise would hide every post.
    sensitive: false,
    content: body,
    // ⚠️ THE PIECE'S OWN LANGUAGE (ADR 0056), not the site's, and this is the one surface where
    // the distinction is machine-read: a reader who filters their timeline by language gets a
    // Vietnamese blog's one English essay only if this says so.
    contentMap: { [lang]: body },
    url,
    attachment: post.coverImage ? [{
      type: 'Document',
      url: absolute(post.coverImage, site),
      // The alt text is not stored beside a cover image, so none is claimed. An empty `name`
      // would assert that the picture needs no description, which is a different thing.
    }] : [],
    tag: post.tags.map((name) => ({
      type: 'Hashtag',
      // ⚠️ SPACES BECOME NOTHING. A hashtag with a space in it is not a hashtag anywhere, and
      // this blog's tags are ordinary words ("giao diện"), so the fediverse form is the joined
      // one. The blog's own tag page keeps the real name.
      name: `#${name.replace(/\s+/g, '')}`,
      href: `${site}/tag/${encodeURIComponent(name)}`,
    })),
  }
}

const absolute = (url: string, site: string): string => (url.startsWith('/') ? `${site}${url}` : url)

/** `Create`: this is new. Its id hangs off the object's, so it is stable per post. */
export const createOf = (note: Json, actor: Actor): Json => envelope('Create', `${note.id as string}#create`, actor, {
  object: note,
  published: note.published,
})

/**
 * `Update`: this changed.
 *
 * ⚠️ ITS ID CARRIES THE TIMESTAMP, where `Create`'s does not. Receivers remember activity ids
 * and drop a repeat, so an `Update` reusing one id is delivered once and every later correction
 * is silently discarded — the post in a follower's timeline then stays at whatever it said the
 * first time it was edited.
 */
export const updateOf = (note: Json, actor: Actor, at: string): Json =>
  envelope('Update', `${note.id as string}#update-${at}`, actor, { object: note, published: at })

/**
 * `Delete`: this is gone, addressed to the same audience that was told it existed.
 *
 * The object is a `Tombstone` rather than the id alone: several implementations will not remove
 * anything for a bare string, and a delete that is ignored is worse than one never sent —
 * the owner believes the post is withdrawn.
 */
export const deleteOf = (objectId: string, actor: Actor, at: string): Json =>
  envelope('Delete', `${objectId}#delete`, actor, {
    object: { id: objectId, type: 'Tombstone' },
    published: at,
  })

/**
 * `Accept`: yes, you may follow.
 *
 * ⚠️ THE WHOLE FOLLOW ACTIVITY GOES BACK, not its id. The follower's server matches the Accept
 * against what it sent, and one that cannot match leaves the follow "pending" on their side
 * forever — the owner sees a follower, the follower sees a button still spinning.
 */
export const acceptOf = (follow: Json, actor: Actor): Json => ({
  '@context': CONTEXT[0],
  id: `${actor.id}#accept-${hashOf(String(follow.id ?? ''))}`,
  type: 'Accept',
  actor: actor.id,
  object: follow,
})

/** A short, stable id fragment for an arbitrary URL — an Accept needs one and may not reuse it. */
const hashOf = (value: string): string => {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function envelope(type: string, id: string, actor: Actor, rest: Json): Json {
  return {
    '@context': CONTEXT,
    id,
    type,
    actor: actor.id,
    to: [PUBLIC],
    cc: [actor.followers],
    ...rest,
  }
}
