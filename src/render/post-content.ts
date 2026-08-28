// Markdown -> HTML. 100% Markdown: raw HTML/CSS is escaped and shown verbatim,
// never rendered. Only Markdown-generated elements (incl. GFM tables) are produced.
//
// Ported from the frozen tree's `components/blog/PostContent.tsx`. Every transform below
// is byte-for-byte the same; the ONLY change is the return value. It was a React server
// component ending in `dangerouslySetInnerHTML`, and it is now a function that returns
// the HTML string, because the M2 gate is that article bodies come out identical.
import { marked, type Tokens } from 'marked'
import { videoEmbed, videoFileUrl } from '@/render/video'
import { collapseBlob } from '@/media/blob'
import { highlightCode } from '@/render/highlight'
import { readRendered, renderKey, writeRendered } from '@/render/render-cache'
import { prepareFootnotes, applyFootnotes } from '@/render/footnotes'
import { buildSha } from '@/server/build-info'
import { inkExtension, ringExtension, underExtension } from '@/render/ink'
import { mathBlockExtension, mathInlineExtension } from '@/render/math'
import { escapeAttr, slugify } from '@/utils'

/**
 * Body TEXT escaping, and it is frozen at three replacements by the golden gate.
 *
 * `docs/spec/03-golden.md` makes the rendered article body a hard equality check against
 * Quire 1.x: "if an article body differs by one byte, a template was ported wrong. There is
 * nothing to review and nothing to accept." The frozen tree escaped `& < >` here, so an
 * escaped-for-display raw HTML block renders `class="danger"` and not `class=&quot;danger&quot;`.
 * Both are safe and both LOOK identical to a reader; only one of them is the same bytes.
 *
 * So this is NOT the canonical `escapeHtml` and must not be "upgraded" into it. It carries its
 * own name for exactly that reason: the hazard this codebase already shipped was two functions
 * called `escapeHtml` with different strengths, one of which reflected a search query into an
 * attribute. Attributes in this file go through the canonical `escapeAttr`, which does escape
 * quotes, so nothing here depends on this being weak.
 */
const escapeBodyText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Drop dangerous schemes (javascript:/data:/vbscript:) — marked v5+ no longer
// sanitizes URLs. Strip control chars first so `java\tscript:` can't slip through.
const safeHref = (href: string): string => {
  const cleaned = href.trim().replace(/[\u0000-\u001F\u007F]/g, '')
  return /^(?:javascript|data|vbscript):/i.test(cleaned) ? '#' : cleaned
}

/**
 * The same guard for an image's `src`, minus the part that would break a real image.
 *
 * The LINK path has been scheme-checked since the port and the IMAGE path never was, so
 * `![x](javascript:alert(1))` came out as `<img src="javascript:alert(1)">`. No browser
 * executes that — a `javascript:` URL in `src` is dead — so this closes an inconsistency
 * rather than a hole, and it is worth closing precisely because the next person to move
 * this URL somewhere executable would inherit the gap rather than the guard.
 *
 * `data:` is deliberately NOT blocked here, unlike in `safeHref`: `data:image/png;base64,…`
 * is a legitimate inline image and blocking it would break real posts to prevent nothing.
 * Script inside an SVG does not run when the SVG is loaded as an `<img>`; the case where it
 * DOES run — the SVG opened as its own document — is handled where that is served
 * (`web/uploads.ts`).
 */
const safeImageSrc = (src: string): string => {
  const cleaned = src.trim().replace(/[\u0000-\u001F\u007F]/g, '')
  return /^(?:javascript|vbscript):/i.test(cleaned) ? '' : cleaned
}

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

marked.setOptions({ gfm: true, breaks: true })
// The highlighter pen. The FIRST syntax this codebase adds that Quire 1.x did not have, so
// it is the first place the golden gate can only say "nothing that already rendered changed"
// rather than "the port is exact" — see `render/ink.ts` for why no corpus fixture moves.
marked.use({ extensions: [inkExtension, underExtension, ringExtension] })
// Maths. Same standing as the pen above: syntax Quire 1.x did not have, so the golden gate
// can only say "nothing that already rendered changed". It can say that honestly here —
// no corpus fixture contains a `$`, a `\(` or a `\[`, which was checked before the grammar
// was written rather than discovered by a red run afterwards.
marked.use({ extensions: [mathBlockExtension, mathInlineExtension] })
marked.use({
  renderer: {
    // Raw HTML tokens (block + inline) -> shown as visible text, never executed.
    html(token: Tokens.HTML | Tokens.Tag) {
      return escapeBodyText(token.raw)
    },
    // H2/H3 slug ids for ToC anchors; duplicates de-duped in dedupeHeadingIds
    // (kept in sync with extractHeadings).
    heading(token: Tokens.Heading) {
      const inner = this.parser.parseInline(token.tokens)
      // The page already renders the post TITLE as the single <h1>; a body `#` would
      // make a second h1 and break the outline, so demote body H1 to H2 (cap depth at
      // 2..6). Only H2/H3 get ToC anchors; a heading that slugifies to "" gets no id.
      const level = Math.min(6, Math.max(2, token.depth === 1 ? 2 : token.depth))
      const slug = level === 2 || level === 3 ? slugify(token.text) : ''
      const id = slug ? ` id="${slug}"` : ''
      return `<h${level}${id}>${inner}</h${level}>\n`
    },
    // A column header that SAYS it is one. marked prints a bare `<th>`, which a screen
    // reader can still associate by position in a simple table — `scope="col"` is the thing
    // WCAG 1.3.1 asks for by name, and it is the only association a complex table gets at
    // all. Everything else about the cell is marked's own output, attribute order included,
    // so the golden diff is exactly this one attribute and nothing else.
    tablecell(token: Tokens.TableCell) {
      const inner = this.parser.parseInline(token.tokens)
      const tag = token.header ? 'th' : 'td'
      const scope = token.header ? ' scope="col"' : ''
      const align = token.align ? ` align="${token.align}"` : ''
      return `<${tag}${scope}${align}>${inner}</${tag}>\n`
    },
    // Sanitize link hrefs (drop javascript:/data:/vbscript:); marked no longer does.
    link(token: Tokens.Link) {
      const inner = this.parser.parseInline(token.tokens)
      const title = token.title ? ` title="${escapeAttr(token.title)}"` : ''
      return `<a href="${escapeAttr(safeHref(token.href))}"${title}>${inner}</a>`
    },
  },
})

// GFM-style callouts: a blockquote whose first line is `[!NOTE]` (TIP/WARNING/
// IMPORTANT/CAUTION) becomes a labelled callout box. Monochrome by design (an accent
// left-border + a bold label — the label carries the meaning), matching the calm
// palette. The non-greedy blockquote match doesn't handle a nested blockquote inside a
// callout (rare); such a case is left as a plain blockquote.
const CALLOUT_LABELS: Record<string, string> = {
  note: 'Note', tip: 'Tip', warning: 'Warning', important: 'Important', caution: 'Caution',
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
function dedupeHeadingIds(html: string): string {
  const counts = new Map<string, number>()
  return html.replace(/(<h[23] id=")([^"]*)(")/g, (whole, pre, id, post) => {
    const n = counts.get(id) ?? 0
    counts.set(id, n + 1)
    return n === 0 ? whole : `${pre}${id}-${n + 1}${post}`
  })
}

// Intrinsic dims of uploaded originals, keyed by collapsed pathname. width/height
// on the <img> reserves the box from the aspect ratio → no CLS.
export type ImageDims = Map<string, { width: number; height: number }>

// The shapes a gallery tile can be cropped to. Written `1x1` rather than `1:1` because
// this travels in a URL fragment, where a colon is legal but reads as a scheme separator
// to every human who looks at it. `asis` is not the absence of a ratio: it is "keep the
// proportions", which a gallery has to be able to say out loud once a SITE default exists
// to disagree with.
const GRID_RATIOS = new Set(['asis', '1x1', '3x2', '4x3'])

// Figure placement from the src fragment: #left|#right (align, default center),
// #wide (noses right into the gutter on wide screens; every image is full-bleed on phones),
// #third (30% of the column; with an align it floats and the text runs around it,
// magazine-fashion — the one fragment that changes how TEXT lays out, not just the figure).
// Caption = alt.
// The frame a picture wears, independent of where the picture sits: a mat of paper (or of
// ink) with a line around it. `frame` alone is the middle weight; `thin` and `thick` mean
// nothing on their own, which is why they are read only from beside it.
//
// THREE-VALUED, like the gallery options above it, and the third value is SILENCE: no token
// means "whatever the site setting says". So `noframe` has to exist and has to be written
// down — on a site whose default is a frame, "this one, plain" is a thing an author needs to
// be able to say, and saying nothing already means something else.
function frameClasses(tokens: string[]): string {
  if (tokens.includes('noframe')) return 'img-noframe'
  if (!tokens.includes('frame')) return ''
  const weight = tokens.includes('thin') ? 'img-frame-thin' : tokens.includes('thick') ? 'img-frame-thick' : ''
  const ink = tokens.includes('ink') ? 'img-frame-ink' : ''
  return ['img-frame', weight, ink].filter(Boolean).join(' ')
}

function imgClasses(frag: string): string {
  // Exact hyphen tokens so `#bright` can't match `right`: left|right|wide|third|left-third|….
  const tokens = frag.split('-')
  // `#grid` marks a gallery item; groupGalleries() wraps consecutive ones. The
  // grid owns layout, so align/wide are ignored for a grid item.
  //
  // A gallery may also name its own shape and caption state. Each is three-valued and the
  // third value is SILENCE: no token means "whatever the site setting says", which is what
  // lets one screen fix a whole imported archive. The classes only carry an override.
  if (tokens.includes('grid')) {
    const ratio = tokens.find((t) => GRID_RATIOS.has(t))
    const cap = tokens.includes('nocap') ? 'g-nocap' : tokens.includes('cap') ? 'g-cap' : ''
    const opts = [ratio ? `g-${ratio}` : '', cap, frameClasses(tokens)].filter(Boolean)
    return opts.length ? `img-grid ${opts.join(' ')}` : 'img-grid'
  }
  const align = tokens.includes('left') ? 'img-left' : tokens.includes('right') ? 'img-right' : 'img-center'
  // The frame is ORTHOGONAL to all of this: it is drawn on the picture, while align and
  // size decide where the picture goes. So it rides along with whichever answer wins below.
  const frame = frameClasses(tokens)
  const with_ = (base: string): string => (frame ? `${base} ${frame}` : base)
  // `wide` and `third` are both sizes, so they cannot compose; wide wins because a fragment
  // carrying both was almost certainly widened last.
  if (tokens.includes('wide')) return with_(`${align} img-wide`)
  return with_(tokens.includes('third') ? `${align} img-third` : align)
}

// Column count for a gallery of N images — Jetpack-like: small sets get one row,
// 4 squares to a 2×2, larger sets settle at 3 then 4 columns.
function galleryCols(n: number): number {
  if (n <= 3) return n // 2 -> 2, 3 -> 3
  if (n === 4) return 2 // 2×2
  if (n <= 9) return 3 // 5–9 -> 3 across
  return 4 // 10+ -> 4 across
}

// Wrap a run of 2+ consecutive `#grid` figures (separated only by whitespace)
// into one `.gallery` grid container, with a column count chosen from how many
// images are in the run. A lone grid image stays a normal figure.
// `img-grid[^"]*` rather than `img-grid"`, because a tile now carries its ratio and
// caption classes alongside. Matching the exact old string silently stopped grouping the
// moment an option was set, and a gallery that quietly falls apart into a column of
// full-width photos is the kind of break nobody reports as a bug.
function groupGalleries(html: string): string {
  return html.replace(/(?:<figure class="img-grid[^"]*">[\s\S]*?<\/figure>\s*){2,}/g, (run) => {
    const count = (run.match(/<figure class="img-grid[^"]*">/g) ?? []).length
    return `<div class="gallery gallery-cols-${galleryCols(count)}">${run.trim()}</div>`
  })
}

// <picture> (AVIF/WebP @1024/1600) ONLY for raster originals with confirmed
// variants (`ready`). A <picture> has no fallback on a 404 source, so anything
// unconfirmed renders as a plain <img> of the original (always loads).
const SIZES_ATTR = '(max-width: 768px) 100vw, 768px'
function responsiveSources(cleanSrc: string, ready: Set<string>): string | null {
  const m = cleanSrc.match(/^(.*\/media\/.+)\.(?:jpe?g|png)$/i)
  if (!m) return null
  if (!ready.has(collapseBlob(cleanSrc))) return null // variants not generated -> plain <img>
  const set = (fmt: string) => `${m[1]}-1024.${fmt} 1024w, ${m[1]}-1600.${fmt} 1600w`
  return (
    `<source type="image/avif" srcset="${set('avif')}" sizes="${SIZES_ATTR}">` +
    `<source type="image/webp" srcset="${set('webp')}" sizes="${SIZES_ATTR}">`
  )
}
function buildFigures(html: string, ready: Set<string>, dims: ImageDims): string {
  let seen = 0 // index of the image within the body, in source order
  return html
    .replace(/<p>\s*(<img\b[^>]*>)\s*<\/p>/g, '$1')
    .replace(/<img\b[^>]*>/g, (tag) => {
      const src = tag.match(/\bsrc="([^"]*)"/)?.[1]
      if (!src) return tag
      const alt = tag.match(/\balt="([^"]*)"/)?.[1] ?? ''
      const [rawSrc, frag = ''] = src.split('#')
      const cleanSrc = safeImageSrc(rawSrc ?? '')
      const caption = alt ? `<figcaption>${alt}</figcaption>` : ''
      // Intrinsic size (when known) reserves the box -> no CLS as it loads.
      const d = dims.get(collapseBlob(cleanSrc))
      const sizeAttrs = d ? ` width="${d.width}" height="${d.height}"` : ''
      // First image = likely LCP → eager + high priority; later images stay lazy.
      const priority = seen === 0 ? ' fetchpriority="high"' : ' loading="lazy"'
      seen++
      const img = `<img src="${cleanSrc}" alt="${alt}"${sizeAttrs}${priority}>`
      const sources = responsiveSources(cleanSrc, ready)
      const media = sources ? `<picture>${sources}${img}</picture>` : img
      return `<figure class="${imgClasses(frag)}">${media}${caption}</figure>`
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
function bodyKey(markdown: string, ready: Set<string>, dims: ImageDims): string {
  const media = [...dims].map(([k, v]) => `${k}:${v.width}x${v.height}`).sort().join(',')
  return renderKey('body', buildSha() ?? 'dev', [...ready].sort().join(','), media, markdown)
}

export async function renderPostContent({
  markdown,
  readyOriginals = new Set(),
  imageDims = new Map(),
}: {
  markdown: string
  // Collapsed pathnames (media/x.jpg) whose AVIF/WebP variants exist. Images not
  // in this set render as a plain <img> of the original (no broken <picture>).
  readyOriginals?: Set<string>
  // Intrinsic width/height per collapsed pathname (for CLS-free rendering).
  imageDims?: ImageDims
}): Promise<string> {
  const key = bodyKey(markdown, readyOriginals, imageDims)
  const hit = readRendered(key)
  if (hit !== null) return hit
  // Pull footnote refs/defs out of the markdown FIRST (references become placeholders
  // that survive marked), then re-insert the <sup> links + list after rendering.
  const fn = prepareFootnotes(markdown)
  const parsed = dedupeHeadingIds(buildVideos(groupGalleries(buildFigures(buildCallouts(await marked.parse(fn.markdown)), readyOriginals, imageDims))))
  const html = applyFootnotes(await highlightBlocks(parsed), fn.refs, fn.defs)
  writeRendered(key, html)
  return html
}
