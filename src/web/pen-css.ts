// The pen as a stylesheet anyone may link (ADR 0048): `GET /pen.css`.
//
// The same hand that marks this blog's pages, for a page that is not this blog — a
// WordPress theme, a static site, a slide. Both halves of the sheet under the `.pen` class
// instead of `.prose`, in whichever inks this blog writes with, so a site that links a
// Quire Ink's pen.css gets that Quire Ink's colours. The markup contract is the same three
// elements the renderer emits (`docs/pen.md`), and nothing in the sheet assumes a variable
// or a font of this blog's exists on the host page.
//
// A STABLE path, not a hashed one, because the whole point is a URL somebody else writes
// down once. So it revalidates rather than living a year: an hour fresh, a day stale while
// a new copy is fetched, and the compression layer's ETag answers a conditional request
// with 304. CORS is open — a stylesheet is fetched cross-origin without credentials, and
// there is nothing private in a colour.

import type { Context } from 'hono'
import { getSettings } from '@/content/settings'
import { inkEmbedCss, inkSignature, resolveInks } from '@/pen'
import { minifyCss } from '@/web/css-min'

const HEAD = '/* The pen, from Quire Ink (quireink.com). Wrap the text in class="pen"; put class="dark" on an'
  + ' ancestor for a dark page. <mark data-pen="N"> highlights (data-ink="green|pink|blue|orange"),'
  + ' <u data-pen="N"> underlines, <mark data-form="o" data-pen="N"> rings; N is 0-79. */\n'

/** One sheet per ink signature; a blog changes its inks about never. */
const built = new Map<string, string>()

export function penCssFor(signature: string, build: () => string): string {
  const hit = built.get(signature)
  if (hit) return hit
  built.clear()
  const css = HEAD + minifyCss(build())
  built.set(signature, css)
  return css
}

export async function handlePenCss(c: Context): Promise<Response> {
  const inks = (await getSettings()).inks
  const body = penCssFor(inkSignature(inks), () => inkEmbedCss(resolveInks(inks)))
  return c.body(body, 200, {
    'content-type': 'text/css; charset=utf-8',
    'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    'access-control-allow-origin': '*',
  })
}
