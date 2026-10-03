// The admin's built files, ANSWERED: the route behind `/admin/assets/*`, and the list of those files
// the Cloudflare build hands to the edge.
//
// Split out of `spa.ts` on 2026-10-03, when the Static Assets list put that file over its 400-line
// ceiling. The seam is not the line count: `spa.ts` draws the shell and decides every name in it —
// the fingerprints, the boot script, the chunk an island lives in — and this file only answers a
// request for one of those names, or for a name an OLDER shell decided. Nothing here invents a name.

import type { Context } from 'hono'
import type { AdminFile } from '@/runtime/ports'
import { ADMIN_FILES, INK_NAME, STYLES_NAME } from '@/web/admin/spa'

type Asset = AdminFile

/**
 * An OLD shell's sheet: chrome AND pen, joined. A tab open across the release that split the pen
 * out links one sheet and no pen, and may be on the editor — the chrome alone would leave every
 * stroke bare until a reload (`tour-flows-pen.ts`).
 */
let staleSheetBody: Promise<Uint8Array> | null = null
const STALE_SHEET: Asset | null = (() => {
  const chrome = ADMIN_FILES.get('admin.css')
  const ink = ADMIN_FILES.get('admin-ink.css')
  if (!chrome || !ink) return chrome ?? null
  // Joined on the first request that wants it, which is rare: a tab that outlived a release.
  const join = async (): Promise<Uint8Array> => {
    const [a, b] = await Promise.all([chrome.body(), ink.body()])
    const body = new Uint8Array(a.length + b.length)
    body.set(a, 0)
    body.set(b, a.length)
    return body
  }
  return {
    type: chrome.type, hash: '', imports: [],
    body: () => (staleSheetBody ??= join().catch((error: unknown) => { staleSheetBody = null; throw error })),
  }
})()

/** One built file, or null. */
export function adminAsset(name: string): Asset | null {
  return ADMIN_FILES.get(name) ?? null
}

/**
 * A sheet name from a PREVIOUS release: `admin.<fingerprint>.css`, but not this shell's.
 *
 * A tab left open across a release still holds the old shell, and what it asks for on the
 * next screen is that shell's stylesheet. Until 2026-09-19 the answer was 404 and the admin
 * drew with no stylesheet at all — the two wordmark shapes side by side among the rest of it,
 * because the rule that picks between them (`#admin-rail .rail-mark`) was in the sheet that
 * never arrived. The current sheet under the old name is the smaller wrong by far: styles one
 * release ahead of the markup are a nudge out of place, a 404 is a bare page.
 */
export const staleSheet = (name: string): boolean =>
  (name !== STYLES_NAME && /^admin\.[a-z0-9]+\.css$/.test(name))
  || (name !== INK_NAME && /^admin-ink\.[a-z0-9]+\.css$/.test(name))

export async function handleAdminAsset(c: Context): Promise<Response> {
  const name = c.req.path.replace('/admin/assets/', '')
  // ONE virtual name, the sheet's. The entry had one too and that was the bug: a module is
  // identified by the URL it was fetched from, so an entry reachable under two names is two
  // modules, and a chunk that imports the entry back gets a second copy of everything in it.
  // The bare `admin.css` still serves — a bookmark, or a shell an old tab is still holding —
  // and still revalidates, because only the fingerprinted URL promises the bytes cannot change.
  const stale = staleSheet(name)
  const ink = name === INK_NAME || (stale && name.startsWith('admin-ink.'))
  const stored = name === STYLES_NAME ? 'admin.css' : ink ? 'admin-ink.css' : name
  const asset = stale && !ink ? STALE_SHEET : adminAsset(stored)
  if (!asset) return new Response('Not found', { status: 404 })
  // Every name the shell emits carries a hash: the bundler's on the entry and the chunks,
  // ours on the sheet. Anything else is a bare name and must revalidate — and so must a
  // fingerprint from an earlier release, whose bytes have just changed under it.
  const immutable = !stale && (stored !== name || /[-.][a-z0-9]{8,}\./.test(name))
  return new Response(await asset.body(), {
    headers: {
      'content-type': asset.type,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    },
  })
}

/**
 * Every admin URL whose bytes can never change, and the file behind it: each built file whose name
 * carries the bundler's hash, under that name; the two sheets under their fingerprints; the boot
 * script. These are exactly the names `handleAdminAsset` answers `immutable`, and the Cloudflare
 * build (`scripts/build-worker.ts`) writes each one into Static Assets at its URL, so the edge
 * answers them before the Worker runs. Asking the shell for the list, rather than restating its
 * naming rules in the build, means the two cannot disagree about a name.
 *
 * What is NOT here still comes to `handleAdminAsset`, on both runtimes: the bare `admin.css`, which
 * must revalidate, a sheet named by an earlier release, and anything that was never built.
 */
export function shippedAdminFiles(): { url: string; name: string; file: Asset }[] {
  const out: { url: string; name: string; file: Asset }[] = []
  for (const [name, file] of ADMIN_FILES) {
    const served = name === 'admin.css' ? STYLES_NAME : name === 'admin-ink.css' ? INK_NAME : name
    if (served === name && !/[-.][a-z0-9]{8,}\./.test(name)) continue
    out.push({ url: `/admin/assets/${served}`, name, file })
  }
  return out
}
