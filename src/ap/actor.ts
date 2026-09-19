// WHO THIS BLOG IS, to a server that has never heard of it.
//
// ADR 0059. Two documents and one predicate. Everything here is derived from the settings and
// the public key — nothing is stored — so the identity cannot drift from what the owner set.

import type { SiteSettings } from '@/types'
import { siteUrlIsUnset } from '@/content/settings-resolve'
import { publicKeyPem } from '@/ap/keys'
import type { Actor, Json } from '@/ap/objects'

/** Where the actor and its two collections live. One prefix, so a move is one edit. */
export const AP = {
  actor: '/ap/actor',
  inbox: '/ap/inbox',
  outbox: '/ap/outbox',
  followers: '/ap/followers',
} as const

/** The media type every one of these documents is served and accepted under. */
export const AP_TYPE = 'application/activity+json; charset=utf-8'

/**
 * True when this blog has an identity it can actually use.
 *
 * THREE CONDITIONS, NOT ONE, and the third is the one that would otherwise fail in a way nobody
 * could diagnose. An actor's id is `<site>/ap/actor`; with no site address set, `resolveSiteUrl`
 * answers `http://localhost:3000`, so the blog would publish an identity pointing at the
 * follower's own machine — and every delivery it signed would be verified against a key fetched
 * from there. The feature refuses to run rather than run wrongly.
 */
export const apReady = (s: SiteSettings): boolean =>
  s.activitypub.enabled && s.activitypub.handle !== '' && !siteUrlIsUnset(s)

/** The three URLs an activity needs, built from one site address. */
export const actorOf = (site: string, handle: string): Actor => ({
  id: `${site}${AP.actor}`,
  followers: `${site}${AP.followers}`,
  handle,
})

/** The key's own id, which is how a receiver knows which key to fetch and check against. */
export const keyIdOf = (site: string): string => `${site}${AP.actor}#main-key`

/**
 * The actor document.
 *
 * ⚠️ `Person`, NOT `Service`. Mastodon draws a `Service` with a bot badge, and this blog is one
 * person writing — the posts are theirs, under their name, in their voice. A badge saying
 * otherwise would be a small lie repeated on every post.
 *
 * ⚠️ AND THE PUBLIC KEY IS THE ONLY KEY HERE. There is no code path from this function to the
 * private half: `publicKeyPem()` is the only reader `ap/keys.ts` exposes, and there is no
 * `privateKeyPem()` to call by accident.
 */
export function actorDocument(s: SiteSettings, site: string): Json {
  const actor = actorOf(site, s.activitypub.handle)
  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: actor.id,
    type: 'Person',
    preferredUsername: s.activitypub.handle,
    name: s.title || s.activitypub.handle,
    summary: s.description ?? '',
    url: site,
    // `manuallyApprovesFollowers: false` is what makes the follow button work without the owner
    // being asked: this blog publishes in public and has nothing to approve.
    manuallyApprovesFollowers: false,
    discoverable: true,
    inbox: `${site}${AP.inbox}`,
    outbox: `${site}${AP.outbox}`,
    followers: actor.followers,
    // ONE shared inbox, offered so a server with many followers here can send once. It is the
    // same address as the personal one because this blog has exactly one actor.
    endpoints: { sharedInbox: `${site}${AP.inbox}` },
    publicKey: {
      id: keyIdOf(site),
      owner: actor.id,
      publicKeyPem: publicKeyPem(),
    },
    ...(s.logoUrl ? { icon: { type: 'Image', url: absolute(s.logoUrl, site) } } : {}),
  }
}

const absolute = (url: string, site: string): string => (url.startsWith('/') ? `${site}${url}` : url)

/**
 * The WebFinger answer: "yes, that name is here, and here is where to look".
 *
 * ⚠️ THE RESOURCE IS MATCHED CASE-INSENSITIVELY ON THE HOST AND EXACTLY ON THE NAME. A server
 * asking for `acct:Name@host` is asking about a different account on every implementation that
 * treats names as case-sensitive, and answering it would mean this blog claims two identities
 * that resolve to one actor — which is how a duplicate appears in somebody's search results.
 * The handle is stored lower-case, so a lower-case comparison here accepts exactly one spelling.
 */
export function webfingerFor(resource: string, s: SiteSettings, site: string): Json | null {
  const host = hostOf(site)
  if (!host) return null
  const want = `acct:${s.activitypub.handle}@${host}`.toLowerCase()
  if (resource.trim().toLowerCase() !== want) return null
  return {
    subject: want,
    aliases: [`${site}${AP.actor}`],
    links: [
      { rel: 'self', type: 'application/activity+json', href: `${site}${AP.actor}` },
      // The human page, so a client that follows the profile link lands on the blog.
      { rel: 'http://webfinger.net/rel/profile-page', type: 'text/html', href: site },
    ],
  }
}

const hostOf = (site: string): string => {
  try {
    return new URL(site).host
  } catch {
    return ''
  }
}
