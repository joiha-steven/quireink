// The same blog from two runtimes, page by page (ADR 0066 rule 4, G2.7).
//
//   bun scripts/parity.ts <bun-url> <cloudflare-url>
//
// Both must serve the SAME data — `scripts/ops/cloudflare-dev.ts` runs this right after loading the
// Bun blog's archive into the worker, before anything writes to either. Every page the sitemap
// names, plus the feeds, robots, llms, search and a missing page, is fetched from both and compared
// on status, content type and body, with only what has to differ taken out first: each one's own
// origin, and the per-response nonce. Anything else that differs is a runtime leaking into a page.
//
// Env: PARITY_MAX (pages, default all), PARITY_SHOW (how many differing pages to print in full),
// PARITY_SITE_URL when both serve the same SITE_URL (a staging copy of a live blog), and
// PARITY_ASSET_HASHES=0 when they run different builds.

const [A, B] = process.argv.slice(2).map((u) => (u ?? '').replace(/\/+$/, ''))
if (!A || !B) {
  console.error('usage: bun scripts/parity.ts <bun-url> <cloudflare-url>')
  process.exit(2)
}
const MAX = Number(process.env.PARITY_MAX || Infinity)
const SHOW = Number(process.env.PARITY_SHOW || 5)

const sitemap = await (await fetch(`${A}/sitemap.xml`)).text()
const fromSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname)
const paths = [...new Set([
  '/', ...fromSitemap, '/feed.xml', '/robots.txt', '/llms.txt', '/sitemap.xml',
  '/search?q=the', '/search?q=ti%E1%BA%BFng', '/no-such-page-at-all',
])].slice(0, MAX)

/** What may differ between two servers of the same data. */
function normalize(body: string, base: string): string {
  // PARITY_SITE_URL: both serve the same SITE_URL (a staging copy of a live blog), so their
  // absolute links already agree and only that one address is taken out.
  const origin = process.env.PARITY_SITE_URL || base
  const host = new URL(origin).host
  let out = body
  // Each spelling of the address a page carries: plain, and percent-encoded inside another URL
  // (the OG card's `bg=`, a query's `site=`).
  for (const [from, to] of [[origin, '{origin}'], [encodeURIComponent(origin), '{origin}'], [host, '{host}'], [encodeURIComponent(host), '{host}']]) {
    out = out.split(from).join(to)
  }
  return out
    .replace(/nonce="[^"]*"/g, 'nonce="{nonce}"')
    .replace(/'nonce-[^']*'/g, "'nonce-{nonce}'")
    // The comment form's proof-of-work challenge: a fresh salt per response, on purpose.
    .replace(/data-stamp="[^"]*"/g, 'data-stamp="{stamp}"')
    // Cloudflare Web Analytics, which a proxied zone injects into the page on its way out: the
    // zone's script, not the blog's.
    .replace(/<script[^>]*static\.cloudflareinsights\.com[^>]*><\/script>\n?/g, '')
    // PARITY_ASSET_HASHES=0 when the two run different builds (a live release against a newer
    // tree): the content hash in an asset's name differs by construction.
    .replace(process.env.PARITY_ASSET_HASHES === '0' ? /(\/(?:assets|fonts|static)\/[\w-]+)[.-][0-9a-z]{8,16}(\.\w+)/g : /$^/g, '$1.{hash}$2')
}

type Got = { status: number; type: string; body: string }
async function get(base: string, path: string): Promise<Got> {
  const res = await fetch(`${base}${path}`, { redirect: 'manual', headers: { accept: 'text/html,*/*' } })
  const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim()
  const body = type.startsWith('image/') ? `<${(await res.arrayBuffer()).byteLength} bytes>` : await res.text()
  return { status: res.status, type, body: normalize(body, base) }
}

/** The first line where two bodies part, with a little of each, so a difference reads at a glance. */
function firstDifference(a: string, b: string): string {
  const la = a.split('\n')
  const lb = b.split('\n')
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] === lb[i]) continue
    const x = la[i] ?? ''
    const y = lb[i] ?? ''
    let at = 0
    while (at < x.length && x[at] === y[at]) at++
    const from = Math.max(0, at - 60)
    return `line ${i + 1}, column ${at + 1}:\n      bun: …${x.slice(from, at + 120)}\n      cf:  …${y.slice(from, at + 120)}`
  }
  return 'bodies differ only in length'
}

let same = 0
const differing: { path: string; why: string }[] = []
for (const path of paths) {
  const [a, b] = await Promise.all([get(A, path), get(B, path)])
  if (a.status !== b.status) differing.push({ path, why: `status ${a.status} on Bun, ${b.status} on Cloudflare` })
  else if (a.type !== b.type) differing.push({ path, why: `content type ${a.type} on Bun, ${b.type} on Cloudflare` })
  else if (a.body !== b.body) differing.push({ path, why: firstDifference(a.body, b.body) })
  else same++
}

console.log(`parity: ${same} of ${paths.length} pages identical between ${A} and ${B}`)
for (const d of differing.slice(0, SHOW)) console.log(`  ✗ ${d.path} — ${d.why}`)
if (differing.length > SHOW) console.log(`  … and ${differing.length - SHOW} more: ${differing.slice(SHOW).map((d) => d.path).join(' ')}`)
process.exit(differing.length ? 1 : 0)
