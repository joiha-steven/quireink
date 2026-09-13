// Markdown -> HTML. 100% Markdown: raw HTML/CSS is escaped and shown verbatim,
// never rendered. Only Markdown-generated elements (incl. GFM tables) are produced.
//
// Ported from the frozen tree's `components/blog/PostContent.tsx`, and the transforms below
// are still byte-for-byte that port. WHAT CHANGED ON 2026-09-13 is the parser underneath them:
// `marked` drew this page for two years and `src/md/` draws it now (ADR 0052). The five things
// this site wants that no Markdown spec mentions used to live here as `marked` renderer
// overrides — a safe `href`, a demoted body `h1`, `scope="col"`, raw HTML as text, and a lone
// newline as a line break — and they are now `md/html-rules.ts`'s `PAGE`, asked for by name in
// `renderPostContent` below.
//
// The gate held: 45 of 45 golden fixtures and 89 of 92 of this blog's real posts paint
// identically, measured in a browser (`scripts/md-paint-diff.ts`). The three that moved are in
// the commit message, and all three are repairs.
import { buildFigures, groupGalleries, type ImageDims, type ReadyOriginals } from '@/render/figures'
import { PAGE, toHtml as mdToHtml } from '@/md/index'
import { videoEmbed, videoFileUrl } from '@/render/video'
import { highlightCode } from '@/render/highlight'
import { readRendered, renderKey, writeRendered } from '@/render/render-cache'
import { prepareFootnotes, applyFootnotes } from '@/render/footnotes'
import { buildSha } from '@/server/build-info'

// Reverse of escapeHtml — Shiki needs the raw text back before re-highlighting.
const unescapeHtml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

// Swap marked's `<pre><code>` blocks for Shiki-highlighted markup (parallel; a
// null result leaves the original block untouched).
async function highlightBlocks(html: string): Promise<string> {
  const re = /<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g
  const matches = [...html.matchAll(re)]
  if (matches.length === 0) return html
  const out = await Promise.all(
    matches.map((m) => highlightCode(unescapeHtml(m[2]), (m[1] || 'text').toLowerCase())),
  )
  let i = 0
  return html.replace(re, (whole) => out[i++] ?? whole)
}

// GFM-style callouts: a blockquote whose first line is `[!NOTE]` (TIP/WARNING/
// IMPORTANT/CAUTION) becomes a labelled callout box. Monochrome by design (an accent
// left-border + a bold label — the label carries the meaning), matching the calm
// palette. The non-greedy blockquote match doesn't handle a nested blockquote inside a
// callout (rare); such a case is left as a plain blockquote.
const CALLOUT_LABELS: Record<string, string> = {
  note: 'Note', tip: 'Tip', warning: 'Warning', important: 'Important', caution: 'Caution',
}

/**
 * A GFM task item wears a class, so a stylesheet can tell it from a bullet.
 *
 * marked prints `<li><input disabled="" type="checkbox"> …` with nothing on the `<li>`
 * itself, and the pen's list marks (`pen/lists.css.ts`) draw a dot before EVERY item of
 * a `<ul>` — which put an ink dot beside every checkbox. A `:has()` selector would tell
 * them apart without touching the markup, and is the one selector this site does not use:
 * it has crashed WebKit. So the item says what it is. Golden: `task-lists` diverges from
 * 1.x by this attribute and nothing else.
 */
function markTaskItems(html: string): string {
  // A loose list wraps the item in a paragraph first; the checkbox is still what leads.
  //
  // THE NEWLINE IS OPTIONAL AND HAS TO BE. CommonMark writes `<li>\n<p>` where `marked` wrote
  // `<li><p>`, and a pattern spelling the two tags adjacent stopped matching the loose case on
  // the day the engine changed (ADR 0052) — quietly, because an item missing `class="task"`
  // still renders, with a bullet AND a checkbox sitting next to each other.
  return html.replace(/<li>(\n?)(<p>)?<input /g, '<li class="task">$1$2<input ')
}

function buildCallouts(html: string): string {
  return html.replace(/<blockquote>\s*([\s\S]*?)<\/blockquote>/g, (whole, inner: string) => {
    const m = inner.match(/^\s*<p>\s*\[!(\w+)\]/i)
    if (!m) return whole
    const type = m[1].toLowerCase()
    const label = CALLOUT_LABELS[type]
    if (!label) return whole
    const body = inner
      .replace(/^\s*<p>\s*\[!\w+\]\s*(?:<br\s*\/?>\s*)?/i, '<p>') // drop the marker
      .replace(/^\s*<p>\s*<\/p>\s*/, '') // and an empty leading paragraph (title on its own line)
    return `<div class="callout callout-${type}"><p class="callout-label">${label}</p>${body}</div>`
  })
}

// 2nd occurrence of a slug → `slug-2`, etc. MUST match extractHeadings' counter
// (both walk H2/H3 in document order) or the ToC anchors break.
/**
 * A wide table scrolls INSIDE ITS OWN BOX, and the article does not move.
 *
 * The scroll used to sit on `.prose` itself (`prose.css.ts`, `.prose:has(table){overflow-x:auto}`),
 * which fixed the phone bug it was written for and created a worse one everywhere else. CSS
 * gives no way to scroll one axis alone: an `overflow-x` that is not `visible` computes
 * `overflow-y` to `auto` as well, so an article carrying a single table became a scroll box
 * four thousand pixels tall. Measured on a live post: `clientHeight` 4119 against
 * `scrollHeight` 4120 — one pixel of overflow, and enough for Safari to draw a scrollbar down
 * the side of the reading column and take that width out of the text.
 *
 * The reason it was on `.prose` at all was that `overflow` is ignored on a `display:table`
 * box, and making the table `display:block` shrink-to-fits it (measured 607px down to 345px).
 * Both are true of the TABLE. Neither is true of a plain block wrapped around it, which is
 * what this adds: the table keeps `display:table` and its full width, and the box that
 * scrolls is one element rather than the whole piece.
 *
 * A string pass rather than a `renderer.table` override, so marked's own table HTML stays
 * byte-for-byte what it was and the golden diff is exactly this wrapper. GFM cannot nest a
 * table inside a table, so the non-greedy match cannot close on the wrong tag.
 */
function wrapTables(html: string): string {
  return html.replace(/<table>[\s\S]*?<\/table>/g, (table) => `<div class="table-scroll">${table}</div>`)
}

function dedupeHeadingIds(html: string): string {
  const counts = new Map<string, number>()
  return html.replace(/(<h[23] id=")([^"]*)(")/g, (whole, pre, id, post) => {
    const n = counts.get(id) ?? 0
    counts.set(id, n + 1)
    return n === 0 ? whole : `${pre}${id}-${n + 1}${post}`
  })
}

// Turn a standalone video URL (bare or autolinked by marked) into a player: a
// known platform (YouTube/Vimeo/TikTok) becomes a responsive iframe embed; a
// direct video FILE (a Library upload under /uploads, or any absolute .mp4/.webm)
// becomes a native <video>. The player HTML is ours (trusted), added after marked
// has run; videoFileUrl only passes http(s)/root-relative URLs, and the quote
// strip keeps the (already-escaped) URL from breaking out of the src attribute.
function buildVideos(html: string): string {
  return html.replace(
    /<p>\s*(?:<a\b[^>]*href="([^"]+)"[^>]*>[^<]*<\/a>|([^<\s]+))\s*<\/p>/g,
    (whole, hrefUrl?: string, textUrl?: string) => {
      const raw = (hrefUrl || textUrl || '').trim()
      // A trailing `#wide` fragment sizes the player like an img-wide figure (nose into
      // the gutter on wide screens); strip it before URL detection. Mirrors image sizing.
      const [url, frag = ''] = raw.split('#')
      const wide = /wide/.test(frag) ? ' video-wide' : ''
      const f = videoFileUrl(url)
      if (f) {
        const src = f.replace(/"/g, '%22')
        return `<div class="video-file${wide}"><video controls preload="metadata" playsinline src="${src}"></video></div>`
      }
      const v = videoEmbed(url)
      if (!v) return whole
      // Spotify / Apple Music are audio players — a short fixed-height frame, not 16:9.
      if (v.kind === 'spotify' || v.kind === 'applemusic')
        return `<div class="audio-embed"><iframe src="${v.embed}" loading="lazy" allow="encrypted-media; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
      return `<div class="video-embed${wide}"><iframe src="${v.embed}" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    },
  )
}

/**
 * The cache key for a rendered body: everything that can change the output.
 *
 * MEASURED on the live box: `marked.parse` alone is 360ms for an 85,000-character post,
 * and the whole page render was 364ms of which 359ms was this. That cost was paid again by
 * the next reader after every single write, because `clearCache()` empties the page cache
 * on any edit anywhere. Content-addressed, it is paid once ever.
 *
 * `01-schema.md` used to say only highlighting is cached, "a body cache would have to key
 * on media variants, theme and locale, which is the invalidation graph Invariant 1 avoids".
 * Two thirds of that is wrong: the theme is CSS and never reaches this HTML, and the locale
 * does not either — the body is the author's own words. Media variants are a real input,
 * and they are IN the key rather than invalidated out of it, which is the same trick the
 * highlighter already uses and needs no graph.
 *
 * The build commit is in the key too, so a deploy that changes any transform below cannot
 * serve yesterday's HTML out of a cache that has no way to tell. That costs one re-render
 * per post per deploy, which the cache warmer absorbs in the background. A hand-maintained
 * version constant would have been free and would eventually have been forgotten.
 */
function bodyKey(markdown: string, ready: ReadyOriginals, dims: ImageDims): string {
  const media = [...dims].map(([k, v]) => `${k}:${v.width}x${v.height}`).sort().join(',')
  // The VERSION is part of the key, not just the membership: an image upgraded from two
  // widths to three changes the srcset this body prints, and a cached body keyed only on
  // "has variants" would go on serving the old one until something unrelated evicted it.
  const variants = [...ready].map(([k, v]) => `${k}:${v}`).sort().join(',')
  return renderKey('body', buildSha() ?? 'dev', variants, media, markdown)
}

export async function renderPostContent({
  markdown,
  readyOriginals = new Map(),
  imageDims = new Map(),
}: {
  markdown: string
  // Collapsed pathnames (media/x.jpg) whose AVIF/WebP variants exist. Images not
  // in this set render as a plain <img> of the original (no broken <picture>).
  readyOriginals?: ReadyOriginals
  // Intrinsic width/height per collapsed pathname (for CLS-free rendering).
  imageDims?: ImageDims
}): Promise<string> {
  const key = bodyKey(markdown, readyOriginals, imageDims)
  const hit = readRendered(key)
  if (hit !== null) return hit
  // Pull footnote refs/defs out of the markdown FIRST (references become placeholders
  // that survive marked), then re-insert the <sup> links + list after rendering.
  const fn = prepareFootnotes(markdown)
  const parsed = dedupeHeadingIds(wrapTables(buildVideos(groupGalleries(buildFigures(buildCallouts(markTaskItems(mdToHtml(fn.markdown, PAGE))), readyOriginals, imageDims)))))
  const html = applyFootnotes(await highlightBlocks(parsed), fn.refs, fn.defs)
  writeRendered(key, html)
  return html
}
