// Purging the CDN — Cloudflare, or anything else (ADR 0033).
//
// The keys for this have been in `integration_keys` and in the Admin UI since the import —
// `cloudflareApiToken` and `cloudflareZoneId`, described in the schema as "Zone.Cache
// Purge" — and NOTHING in 2.0 ever read them. The port dropped the call and kept the
// configuration, so the owner has been looking at a filled-in Cloudflare panel while every
// edit stayed at the edge for up to eleven minutes.
//
// Measured on the live site before this landed: `cf-cache-status: HIT`, `Age: 165` on the
// home page, against `s-maxage=60, stale-while-revalidate=600`. The edge really does hold
// HTML here, so this is not a theoretical gap.
//
// Unconfigured is a no-op, not an error: a self-hosted install with no CDN in front is the
// normal case, and every test runs in exactly that state.

import { getIntegrationKeys } from '@/store/integration-keys'

const ENDPOINT = 'https://api.cloudflare.com/client/v4/zones'

/**
 * Purge everything, and never throw.
 *
 * Everything rather than a URL list because that is the same argument Invariant 1 already
 * settled for the page cache: a per-write superset of affected URLs is a dependency graph,
 * and this one would have to include the feeds, the sitemap, every taxonomy page the post
 * appears on and the OG image. Cloudflare's own limit on a purge-everything is once every
 * few seconds, which the caller's debounce already respects.
 */
export async function purgeEdge(): Promise<'ok' | 'skipped' | 'failed'> {
  // Both, when both are configured. They are two edges in front of one blog, not two ways
  // of describing the same one, and an install with a CDN behind Cloudflare has both.
  const [cf, hook] = await Promise.all([purgeCloudflare(), purgeWebhook()])
  if (cf === 'skipped' && hook === 'skipped') return 'skipped'
  if (cf === 'failed' || hook === 'failed') return 'failed'
  return 'ok'
}

/**
 * Any other CDN: one POST to a URL the owner pasted in.
 *
 * Deliberately not a provider list. Bunny, Fastly, KeyCDN and a script in front of nginx
 * all differ in the URL and the header, and every one of them can be reached by something
 * that answers this. A provider list would be four integrations to keep current instead.
 */
async function purgeWebhook(): Promise<'ok' | 'skipped' | 'failed'> {
  const { purgeWebhookUrl } = await getIntegrationKeys()
  if (!purgeWebhookUrl) return 'skipped'
  try {
    const res = await fetch(purgeWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ purge: 'everything', source: 'quireink' }),
      signal: AbortSignal.timeout(10_000),
    })
    // The URL is never logged: a purge endpoint usually carries its own token in the path
    // or the query, and this is the same rule the Cloudflare half keeps for its token.
    if (!res.ok) {
      console.error(`[ERROR] edge-cache.purgeWebhook: the endpoint returned ${res.status}`)
      return 'failed'
    }
    console.log('edge-cache: purge webhook called')
    return 'ok'
  } catch (error) {
    console.error(`[ERROR] edge-cache.purgeWebhook: ${(error as Error).message}`)
    return 'failed'
  }
}

async function purgeCloudflare(): Promise<'ok' | 'skipped' | 'failed'> {
  const keys = await getIntegrationKeys()
  if (!keys.cloudflareApiToken || !keys.cloudflareZoneId) return 'skipped'
  try {
    const res = await fetch(`${ENDPOINT}/${keys.cloudflareZoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${keys.cloudflareApiToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ purge_everything: true }),
      signal: AbortSignal.timeout(10_000),
    })
    // The token and the zone id are never logged, on success or on failure. A 403 here is
    // the commonest outcome of a mis-scoped token and the temptation is to log what was
    // sent; that is how a token ends up in a journal somebody later pastes into a bug.
    if (!res.ok) {
      console.error(`[ERROR] edge-cache.purgeCloudflare: cloudflare returned ${res.status}`)
      return 'failed'
    }
    console.log('edge-cache: cloudflare purged')
    return 'ok'
  } catch (error) {
    console.error(`[ERROR] edge-cache.purgeCloudflare: ${(error as Error).message}`)
    return 'failed'
  }
}
