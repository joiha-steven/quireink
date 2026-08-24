// Serving the browser bundles.
//
// Each bundle is imported as TEXT, which means `bun build --compile` embeds it in the
// binary and the server needs no files beside it. The URL carries a content hash, so the
// response is `immutable` for a year and a deploy that changes the code changes the URL:
// no cache busting to remember, and no reader stuck on a stale script.

import coreJs from '@/assets/dist/core.js' with { type: 'text' }
import postJs from '@/assets/dist/post.js' with { type: 'text' }
import loginJs from '@/assets/dist/login.js' with { type: 'text' }
import { PUBLIC_CSS } from '@/web/public.css'
import { INK_HIGHLIGHT_CSS, INK_LINES_CSS, inkHighlightCss, inkLinesCss } from '@/web/ink.css'
import { inkSignature, resolveInks } from '@/render/ink-palette'
import type { InkSettings } from '@/types'
import { minifyCss } from '@/web/css-min'

/** Bundles by logical name. Adding one is an import and a line. */
const BUNDLES: Record<string, string> = { core: coreJs, post: postJs, login: loginJs }

/**
 * Short content hash. Not a security boundary, so speed matters more than collision
 * resistance: `Bun.hash` over the source is enough to change the URL whenever the bytes
 * change, which is the entire job.
 */
const hashOf = (source: string): string => Bun.hash(source).toString(36).slice(0, 10)

const PATHS = new Map<string, string>()
const BY_PATH = new Map<string, string>()
for (const [name, source] of Object.entries(BUNDLES)) {
  const path = `/assets/${name}.${hashOf(source)}.js`
  PATHS.set(name, path)
  BY_PATH.set(path, source)
}

/**
 * The public stylesheet, on the same hashed-and-immutable footing as the bundles.
 *
 * It used to be inlined into every page, which buys one less round trip on a COLD visit
 * and charges for it on every visit after. Measured 2026-07-29: of the 48.7 KB assembled
 * per page, 42.6 KB (13.8 KB gzipped) is this sheet and is byte-identical everywhere,
 * while only 6.1 KB (1.7 KB gzipped) actually varies with the owner's settings. Reading
 * three articles re-sent 41 KB of gzipped CSS for one page's worth of information.
 *
 * So the STATIC half moves here and is cached for a year, and the settings half stays
 * inline. The cascade is unchanged because the link is emitted before that inline block,
 * which is where the sheet sat in the assembled string.
 *
 * Minified once, here, on the way to being hashed. The sheets are commented the way the
 * rest of this codebase is, and those comments were going out on the wire: measured
 * 2026-07-30, 34,438 of the 65,645 bytes served were comment text, and a first visit paid
 * for all of it. Stripping them is worth about 14 KB compressed per cold visit, which is
 * more than the entire JavaScript budget for a page. The prose stays in the .ts file.
 */
const PUBLIC_CSS_SERVED = minifyCss(PUBLIC_CSS)

export const PUBLIC_SHEET = `/assets/site.${hashOf(PUBLIC_CSS_SERVED)}.css`
BY_PATH.set(PUBLIC_SHEET, PUBLIC_CSS_SERVED)

/**
 * The pen, in two sheets of its own — and linked only where it wrote something.
 *
 * The ink is 280 SVG data-URIs and it had grown to ~21 of the public sheet's 29 KB
 * gzipped, paid on every cold visit and re-parsed on every page, highlights or not.
 * Splitting it out of `site.css` keeps the split invisible: a page that DOES carry a mark
 * links the sheet render-blocking exactly as before, so not one pixel or paint order
 * changes there — while the home page, the archive and every unmarked post stop carrying
 * the whole pen case. Deferred/async loading was rejected outright: it shows bare words
 * for a beat before the ink lands, and the pen's whole argument is that it never flickers.
 *
 * Two halves rather than one, because the gestures travel separately: highlights are
 * common, underlines and rings are rare. The ring lives in the LINES sheet but its base
 * box rules ride `<mark>` — a ringed page contains `<mark data-form="o">`, which the
 * highlighter detection matches too, so both sheets arrive and the cascade reads exactly
 * as it did when the ink was one string. ADR 0027 records the trade.
 */
const PEN_MARKS_CSS_SERVED = minifyCss(INK_HIGHLIGHT_CSS)
const PEN_LINES_CSS_SERVED = minifyCss(INK_LINES_CSS)

export const PEN_MARKS_SHEET = `/assets/pen-marks.${hashOf(PEN_MARKS_CSS_SERVED)}.css`
export const PEN_LINES_SHEET = `/assets/pen-lines.${hashOf(PEN_LINES_CSS_SERVED)}.css`
BY_PATH.set(PEN_MARKS_SHEET, PEN_MARKS_CSS_SERVED)
BY_PATH.set(PEN_LINES_SHEET, PEN_LINES_CSS_SERVED)

/**
 * Which pen sheets this HTML needs, decided by looking at the HTML itself.
 *
 * The renderer stamps every gesture as an element — `<mark …>` for a highlight or a ring,
 * `<u …>` for an underline — and rendered bodies are trusted, escaped output: a literal
 * "<mark" in someone's prose arrives as &lt;mark. So a tag scan is exact, not heuristic.
 * The `[\\s>]` guard keeps `<u` from matching `<ul>`. Scanning the assembled page costs
 * microseconds against bodies that are already cached, and it is the reason no route, no
 * cache key and no setting had to learn what a page contains.
 */
export function penSheetsFor(body: string, inks?: InkSettings): string[] {
  const { marks, lines } = inks ? penSheets(inks) : { marks: PEN_MARKS_SHEET, lines: PEN_LINES_SHEET }
  const sheets: string[] = []
  if (/<mark[\s>]/.test(body)) sheets.push(marks)
  if (/<u[\s>]/.test(body) || body.includes('data-form="o"')) sheets.push(lines)
  return sheets
}

/**
 * The pen sheets for a site that has CHOSEN its inks.
 *
 * An install that has chosen nothing never reaches the second half of this function: it
 * keeps the two sheets built at module load, with the hashes they have always had, and
 * nothing about it costs a byte or a millisecond more than before the colours became a
 * setting. That is what `inkSignature` returning '' is for.
 *
 * When they HAVE been chosen, the sheets are rebuilt — 280 data-URIs, about 270 KB before
 * minifying — and cached under the signature. Two are kept, not one: a page rendered a
 * moment before the owner pressed Save names the OLD sheet in its HTML, and that fetch has
 * to still resolve or the marks on it arrive unpainted. Three would only widen a window
 * that is already generous; the memory is real (roughly half a megabyte for the pair).
 */
const CUSTOM_PEN = new Map<string, { marks: string; lines: string }>()

export function penSheets(inks: InkSettings): { marks: string; lines: string } {
  const signature = inkSignature(inks)
  if (!signature) return { marks: PEN_MARKS_SHEET, lines: PEN_LINES_SHEET }
  const cached = CUSTOM_PEN.get(signature)
  if (cached) return cached

  const palette = resolveInks(inks)
  const marksCss = minifyCss(inkHighlightCss(palette))
  const linesCss = minifyCss(inkLinesCss(palette))
  const made = {
    marks: `/assets/pen-marks.${hashOf(marksCss)}.css`,
    lines: `/assets/pen-lines.${hashOf(linesCss)}.css`,
  }
  BY_PATH.set(made.marks, marksCss)
  BY_PATH.set(made.lines, linesCss)
  CUSTOM_PEN.set(signature, made)

  if (CUSTOM_PEN.size > 2) {
    const [oldest] = CUSTOM_PEN.keys()
    const gone = CUSTOM_PEN.get(oldest!)
    if (gone) {
      // Never evict the built-ins: a custom pen can hash to the same bytes as the default
      // one if every override happens to match a measured value.
      if (gone.marks !== PEN_MARKS_SHEET) BY_PATH.delete(gone.marks)
      if (gone.lines !== PEN_LINES_SHEET) BY_PATH.delete(gone.lines)
    }
    CUSTOM_PEN.delete(oldest!)
  }
  return made
}

/** The hashed URL for a bundle. Callers use this rather than writing paths by hand. */
export function assetPath(name: keyof typeof BUNDLES & string): string {
  const path = PATHS.get(name)
  if (!path) throw new Error(`assetPath: no bundle named ${JSON.stringify(name)}`)
  return path
}

/** A `<script>` tag for a bundle. `defer` because no island needs to block parsing. */
export function scriptTag(name: string): string {
  return `<script src="${assetPath(name)}" defer></script>`
}

/**
 * A stylesheet request whose hash this build does not know — answered with the CURRENT
 * sheet rather than a 404.
 *
 * The reader did not invent that URL. HTML is `s-maxage=60, stale-while-revalidate=600`, so
 * for up to eleven minutes after a deploy a shared cache hands out the PREVIOUS deploy's
 * page, and the only stylesheet it names is one this process no longer has. The strict
 * answer is a 404, and a 404 on the only stylesheet is an unstyled site — which is a worse
 * failure than a page rendered with CSS one deploy newer than its markup.
 *
 * Only the sheet. A stale JS bundle is a genuine mismatch: it can call into markup that
 * moved, and silently doing nothing is better than doing the wrong thing. CSS degrades the
 * other way round.
 *
 * `immutable` stays honest through this. A client asking for an old hash is by definition
 * one that has never held those bytes, and once it loads any fresh page it moves to the
 * current URL and never asks again — so no client can observe a URL changing under it.
 */
function staleSheet(path: string): string | null {
  const m = /^\/assets\/(site|pen-marks|pen-lines)\.[a-z0-9]+\.css$/.exec(path)
  if (!m) return null
  return m[1] === 'site' ? PUBLIC_CSS_SERVED
    : m[1] === 'pen-marks' ? PEN_MARKS_CSS_SERVED : PEN_LINES_CSS_SERVED
}

/** The bundle served at a request path, or null when nothing matches. */
export function assetBody(path: string): string | null {
  return BY_PATH.get(path) ?? staleSheet(path)
}
