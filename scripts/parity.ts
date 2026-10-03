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
// Then every file those pages link — the islands, the sheets, the fonts, and with PARITY_SESSION
// (an owner's session cookie value) the admin's chunks — is fetched from both and compared on status,
// content type, cache-control, the security headers and the bytes. On Cloudflare most of them are
// answered by Static Assets before the Worker runs (`scripts/build-worker.ts`, 2026-10-03), and this
// is what holds that copy to what the Bun routes send. Skipped with PARITY_ASSET_HASHES=0, where the
// two builds name different files by construction.
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
  // Cloudflare Web Analytics, which a proxied zone injects into the page on its way out: the
  // zone's script, not the blog's. Removed until none is left, not in one pass, so the pattern
  // cannot rebuild itself from the pieces either side of one it took out.
  const BEACON = /<script[^>]*static\.cloudflareinsights\.com[^>]*><\/script>\n?/g
  for (let before = ''; before !== out;) { before = out; out = out.replace(BEACON, '') }
  return out
    .replace(/nonce="[^"]*"/g, 'nonce="{nonce}"')
    .replace(/'nonce-[^']*'/g, "'nonce-{nonce}'")
    // The comment form's proof-of-work challenge: a fresh salt per response, on purpose.
    .replace(/data-stamp="[^"]*"/g, 'data-stamp="{stamp}"')
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
const linked = new Set<string>()
const LINKED = /(?:href|src)="(\/(?:assets|fonts|admin\/assets)\/[^"?#]+|\/app-icon\.png)"/g
for (const path of paths) {
  const [a, b] = await Promise.all([get(A, path), get(B, path)])
  for (const m of a.body.matchAll(LINKED)) linked.add(m[1]!)
  if (a.status !== b.status) differing.push({ path, why: `status ${a.status} on Bun, ${b.status} on Cloudflare` })
  else if (a.type !== b.type) differing.push({ path, why: `content type ${a.type} on Bun, ${b.type} on Cloudflare` })
  else if (a.body !== b.body) differing.push({ path, why: firstDifference(a.body, b.body) })
  else same++
}

console.log(`parity: ${same} of ${paths.length} pages identical between ${A} and ${B}`)
for (const d of differing.slice(0, SHOW)) console.log(`  ✗ ${d.path} — ${d.why}`)
if (differing.length > SHOW) console.log(`  … and ${differing.length - SHOW} more: ${differing.slice(SHOW).map((d) => d.path).join(' ')}`)

// ----- the files the pages link ------------------------------------------------------------------

/** What a file is served WITH, beside its bytes: the headers a browser or a cache acts on. */
const HEADERS = ['content-type', 'cache-control', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy']
async function file(base: string, path: string): Promise<string> {
  const res = await fetch(`${base}${path}`, { redirect: 'manual' })
  const bytes = new Uint8Array(await res.arrayBuffer())
  const digest = new Bun.CryptoHasher('sha256').update(bytes).digest('hex').slice(0, 16)
  return [`status ${res.status}`, ...HEADERS.map((h) => `${h}: ${res.headers.get(h) ?? '-'}`), `${bytes.length} bytes ${digest}`].join('\n')
}

let filesDiffer = 0
if (process.env.PARITY_ASSET_HASHES !== '0') {
  // The admin's files are linked only from an owner's page; its HTML is not compared, only read.
  if (process.env.PARITY_SESSION) {
    const admin = await (await fetch(`${A}/admin`, { headers: { cookie: `__Host-quire_session=${process.env.PARITY_SESSION}` } })).text()
    for (const m of admin.matchAll(LINKED)) linked.add(m[1]!)
  }
  let filesSame = 0
  for (const path of linked) {
    const [a, b] = await Promise.all([file(A, path), file(B, path)])
    if (a === b) { filesSame++; continue }
    filesDiffer++
    if (filesDiffer <= SHOW) console.log(`  ✗ ${path} — ${firstDifference(a, b)}`)
  }
  console.log(`parity: ${filesSame} of ${linked.size} linked files identical, headers and bytes`)
}
process.exit(differing.length || filesDiffer ? 1 : 0)
