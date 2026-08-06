// GET /og — the dynamic Open Graph card.
//
// Everything comes from the query string, so the route reads no settings and touches no
// database: the caller (`render/og.ts`) has already decided what the card says.
//
// SSRF is the whole risk here. `?bg=` and `?font=` are attacker-controlled URLs that the
// SERVER fetches, so both are restricted to this site's own origin. Without that, a public
// URL on the blog becomes a way to probe the machine's network from inside it. "This
// site's own origin" is SITE_URL when it is configured, NOT the Host header the caller
// sent — see the note in the handler.
//
// The same-origin test is the gate; `safeFetch` is the backstop underneath it, because the
// fallback origin is the Host header and a Host header is not a fact about this server.
// The alternative — refusing to fetch at all unless SITE_URL is set — was rejected: the
// card URL is built from `settings.siteUrl` (the admin field), which an install configured
// through the UI alone leaves the env unaware of, so that rule would silently drop the
// background on a correctly configured site.

import type { Context } from 'hono'
import { readEnv } from '@/env'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { safeFetch } from '@/server/safe-fetch'
import { renderOgCard, type OgCard } from '@/render/og-card'

/**
 * Neither fetch may hold the render open.
 *
 * This route is public and unauthenticated, the runtime has one thread, and the origin
 * being fetched is by definition one an attacker chose: without a deadline, a host that
 * accepts the connection and then says nothing parks a request per call.
 */
const FETCH_TIMEOUT_MS = 5_000

/**
 * Cards per minute per IP.
 *
 * The fetch deadline above bounds how long ONE card can be held open and stops there, which
 * left the render itself — the expensive half — with nothing in front of it. Measured on the
 * origin: a cached page answers in about 1ms and a card costs about 44ms, and because the
 * card is a pure function of its query string, changing one character of ?title= is a miss
 * at the edge AND at the origin. So a single unauthenticated client can ask for arbitrarily
 * many full-price renders: at 40 concurrent it took the median page from 1.9ms to 10.6ms
 * here, on a machine with cores to spare. The self-hosting target is a 1-2 vCPU box.
 *
 * Every other public endpoint that costs something already has this — search, comments,
 * subscribe, the tracker, and `/api/cron`, whose cap is deliberately charged BEFORE its
 * token check for exactly this reason. This route was the expensive one without it.
 *
 * 30, because a real caller is a crawler or a chat app unfurling a link it just saw: one
 * card per shared URL, not thirty a minute. Generous enough that a burst of shares of the
 * same post never trips, since those are all one URL and answer from the edge.
 */
const CARDS_PER_MINUTE = 30

/** Same-origin only. Anything else, including a malformed URL, is dropped. */
function sameOrigin(candidate: string, origin: string): boolean {
  if (!candidate) return false
  try {
    return new URL(candidate).origin === origin
  } catch {
    return false
  }
}

/**
 * Fetch a same-origin image and inline it as a data URI.
 *
 * satori emits `<image href="...">` and hands the SVG to sharp, which does NOT fetch remote
 * references. Passing the URL through would silently produce a card with the gradient and
 * no picture, which is exactly the kind of failure nobody notices until it is on Twitter.
 */
async function inlineImage(url: string): Promise<string | undefined> {
  try {
    const res = await safeFetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return undefined
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    if (!type.startsWith('image/')) return undefined
    const bytes = new Uint8Array(await res.arrayBuffer())
    return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`
  } catch {
    return undefined // a missing background is a gradient, not an error page
  }
}

export async function handleOg(c: Context): Promise<Response> {
  // Before anything is parsed, fetched or drawn: the work this route does is the reason it
  // needs a cap, so nothing expensive may happen above the cap.
  if (rateLimited(`og:${clientIp(c.req.raw)}`, CARDS_PER_MINUTE)) {
    return c.text('Too many requests', 429, { 'retry-after': '60' })
  }
  const url = new URL(c.req.url)
  const q = url.searchParams
  // The configured origin when there is one, and the request's own only as a fallback.
  //
  // `c.req.url` is built from the Host header, which the CLIENT sends: with `Host:
  // 127.0.0.1:9200` the same-origin test below approves `bg=http://127.0.0.1:9200/…`, and
  // this route then fetches it server-side and paints it into a PNG. That is a request the
  // caller could not make themselves, which is the whole of SSRF. SITE_URL is read from the
  // environment rather than from settings, so this route keeps the property that makes it
  // cheap — it touches no database.
  const origin = readEnv().siteUrl || url.origin

  // Caps mirror the frozen route. They bound the work this endpoint can be asked to do:
  // it is public and uncached upstream, so an unbounded title is an unbounded render.
  const card: OgCard = {
    title: (q.get('title') ?? '').slice(0, 160),
    desc: (q.get('desc') ?? '').slice(0, 340) || undefined,
    date: (q.get('date') ?? '').slice(0, 60) || undefined,
    site: (q.get('site') ?? '').slice(0, 120) || undefined,
  }

  const bg = q.get('bg') ?? ''
  if (sameOrigin(bg, origin)) card.bg = await inlineImage(bg)

  const font = q.get('font') ?? ''
  if (sameOrigin(font, origin)) {
    card.customFont = await safeFetch(font, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      .then((r) => (r.ok ? r.arrayBuffer() : undefined))
      .catch(() => undefined)
  }

  try {
    const png = await renderOgCard(card)
    return new Response(png, {
      headers: {
        'content-type': 'image/png',
        // A card is a pure function of its query string, so it is safe to cache hard.
        // Crawlers refetch these often and rendering one is not cheap.
        'cache-control': 'public, max-age=86400, s-maxage=604800, immutable',
      },
    })
  } catch (error) {
    console.error(`[ERROR] og: ${(error as Error).message}`)
    return c.text('Could not render card', 500)
  }
}
