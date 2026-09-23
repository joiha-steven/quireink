// Pure helpers shared across lib and components. No side effects, no I/O.

import { INK_SYNTAX_GLOBAL, RING_SYNTAX_GLOBAL, UNDER_SYNTAX_GLOBAL } from '@/pen/grammar'
// `math-syntax`, NOT `math`: the grammar, not the renderer. Fifteen admin files import this
// module, so whatever it reaches for lands in the chunk every admin screen loads — and
// `render/math.ts` imports Temml. Three regexes cost 212 KB of LaTeX engine until this line
// pointed one file to the left. See the header of `math-syntax.ts`.
import { MATH_SYNTAX_GLOBAL, mathOf, isDisplayMatch } from '@/md/math-syntax'

/** TeX source -> the letters and numbers in it: control words, braces, `&` and `\\` go. */
const stripTex = (tex: string) =>
  tex.replace(/\\[a-zA-Z]+|\\\\|[{}&]/g, ' ').replace(/\s+/g, ' ').trim()

// HTML-escape every special char so nothing user/author-typed becomes markup. The
// escape-first half of the limited-markdown security model (Invariant 5): shared by
// comment-md + inline-md, which then inject only their own whitelisted tags.
//
// Both quote forms are escaped, which is what makes this safe inside an attribute as well as
// in text. That is not a detail: a dozen renderers had grown their OWN three-replacement
// `escapeHtml` covering `& < >` alone, and one of them was interpolating the reader's search
// query straight into `value="…"`. `/search?q=" onfocus=alert(1) autofocus x="` came back as
// a live event handler on the public page. Two functions with one name, and the weaker one
// reached for by whoever wrote the next line.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * The same escaping, named for the place it is going.
 *
 * An alias on purpose: the distinction that matters is not what the two functions DO, it is
 * that a reader of the call site can see which context the value lands in. Where they differ
 * is where the bug was, so here they cannot.
 */
export const escapeAttr = escapeHtml

// Cyrillic -> latin, one lowercase letter at a time (BGN/PCGN-style). Added with the
// Russian locale (2026-08-28): a fully-Cyrillic title used to slugify to NOTHING and
// fall back to `post-<timestamp>`, which is a URL nobody can read aloud. Cyrillic maps
// cleanly; CJK deliberately still falls through to the timestamp, because romanizing
// Chinese or Japanese is a judgment call this function has no business making.
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
}

// Convert arbitrary text to a URL-safe slug (supports Vietnamese diacritics + Cyrillic).
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritic marks
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[\u0430-\u044f\u0451]/g, (c) => CYRILLIC[c] ?? '')
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Terse date + 24h time for the admin tables. It lives in `@/admin-shared/when` now, because
// the assistant's island draws chat rows with a date on them and may not import this module:
// three regexes at the top of this file pull the pen grammar and the maths syntax in behind
// them. Re-exported, so the dozen call sites that had it here keep the import they had.
export { formatDateTimeShort } from '@/admin-shared/when'

// The clock beside the save state, for the same reason and by the same route as the line
// above: the writing sheet's island prints it and may not import this module either.
export { formatTime } from '@/admin-shared/when'

/**
 * Max characters kept from an author-provided excerpt.
 *
 * 280, and it was 200 until 2026-08-15. The old number was a META DESCRIPTION bound — a
 * search engine truncates one past ~160 anyway — applied at the point where the excerpt is
 * SAVED, so it bounded every surface that reads one. The front page's text kind then asked
 * `deck()` for 260 characters for its lead standfirst (`DECK_CHARS` in `web/front-card.ts`)
 * and could never be given more than 200: the biggest slot on the most-looked-at page was
 * starved by a cap set for a `<meta>` tag it has nothing to do with. Visible on the demo as
 * a two-line deck under a three-line headline, reported as a description cut too short.
 *
 * The pattern for fixing it was already in the file that broke it: `web/article.ts` had hit
 * the same wall for the share card and answered it with its own `OG_DESC_MAX`, not by
 * moving this one. So the rule is now — THIS bounds STORAGE, and a surface with a narrower
 * need clamps again on the way out. The `<meta name="description">` does exactly that.
 */
export const EXCERPT_MAX_CHARS = 280

/** `[label]: destination "title"` on a line of its own, up to three spaces in. Not a footnote. */
const LINK_DEFINITION = /^[ \t]{0,3}\[([^\]^\n][^\]\n]*)\]:[ \t]*\S+.*$/gm

// Strip markdown/HTML to plain text.
export function toPlainText(markdown: string): string {
  // REFERENCE LINKS, which the rules below never knew: `[the docs][d]` and its definition
  // `[d]: https://…` went into the excerpt, the meta description, the OG card and the RSS
  // summary as typed (found 2026-09-19). The labels are gathered first, so a shortcut `[word]`
  // is taken for a link only when the piece defines it — otherwise it is brackets in prose.
  const defined = new Set<string>()
  for (const m of markdown.matchAll(LINK_DEFINITION)) defined.add(m[1]!.trim().toLowerCase())
  return markdown
    .replace(LINK_DEFINITION, ' ')
    .replace(/\[([^\][\n]+)\]\[([^\][\n]*)\]/g, (all, text: string, label: string) =>
      defined.has((label || text).trim().toLowerCase()) ? text : all)
    .replace(/\[([^\][\n]+)\](?![[(:])/g, (all, text: string) => (defined.has(text.trim().toLowerCase()) ? text : all))
    .replace(/```[\s\S]*?```/g, ' ') // code blocks
    // ⚠️ BOTH BRACKETS AND BOTH PARENS NEST ONE LEVEL, because a label may hold a pair and
    // a URL may hold a pair, and the flat versions matched NEITHER — they simply did not fire,
    // and the whole of `[Theo nghiên cứu [1]](https://e.com)` went into the deck, the meta
    // description, the OG card and the RSS summary as the characters somebody typed.
    // Wikipedia's own addresses carry the second shape: `…/wiki/A_(b)`.
    // ⚠️ NEVER ACROSS A BLANK LINE. Link text ends with its paragraph, and a pattern free to
    // cross one joined `[a` in one paragraph to `b](x)` in the next and deleted the gap between.
    .replace(/!\[(?:[^\][\n]|\n(?![ \t]*\n)|\[[^\][]*\])*\]\((?:[^()\n]|\([^()]*\))*\)/g, ' ') // images
    .replace(/\[((?:[^\][\n]|\n(?![ \t]*\n)|\[[^\][]*\])*)\]\((?:[^()\n]|\([^()]*\))*\)/g, '$1') // links -> text
    // A footnote, both halves. The definition is a line of its own and belongs at the foot of
    // the piece, not in a summary of it; the reference is a number the summary cannot use.
    .replace(/^[ \t]*>?[ \t]*\[\^[^\]\s]+\]:.*$/gm, ' ')
    .replace(/\[\^[^\]\s]+\]/g, '')
    // A callout's tag, which is a marker and not a sentence: `> [!NOTE]` on its own line.
    .replace(/^[ \t]*>?[ \t]*\[![A-Za-z]+\][ \t]*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ') // html tags (e.g. video iframes)
    // Highlights -> the words inside them. BEFORE the bare-character strip below, which
    // would otherwise eat the `#` of a colour suffix and leave the colour NAME in the prose.
    .replace(INK_SYNTAX_GLOBAL, '$1')
    // The pen's other two gestures, for the same reason: an underline or a ring in the
    // opening sentence must not leak `++`, `@@` or a colour name into the deck.
    .replace(UNDER_SYNTAX_GLOBAL, '$1')
    .replace(RING_SYNTAX_GLOBAL, '$1')
    // Maths. This is the excerpt, the meta description, the OG card and the RSS summary, and
    // the failure it prevents is `\times` and `\frac` appearing in all four — the exact shape
    // of the bug the ink syntax shipped when this function did not know about `==`.
    //
    // A DISPLAY formula is dropped whole. It is a standalone equation, not part of a
    // sentence, and the alternative was read off the rendered page: a post opening with
    // `$$M \times V = P \times Q$$` produced the deck "M V = P Q Giải mã phương trình…",
    // which reads as broken prose above the title. Dropping it starts the deck at the first
    // real sentence, which is what a deck is.
    //
    // An INLINE formula keeps its operands, because it sits INSIDE a sentence: `**$M$
    // (Money Supply):**` must not summarise as " (Money Supply):". The control words go and
    // the letters stay — deliberately NOT mapped to their symbols, because a table turning
    // `\times` into × would be a second grammar to keep in step with Temml's, which is the
    // thing this file's own history argues hardest against.
    .replace(MATH_SYNTAX_GLOBAL, (...m: (string | undefined)[]) =>
      isDisplayMatch(m) ? ' ' : stripTex(mathOf(m)))
    // A LIST MARKER, and only at the head of a line. The bare-character strip below takes
    // `*` but not `-`, because a hyphen belongs inside "self-hosted" and between dates, so a
    // list written with asterisks counted nothing extra and the same list written with
    // hyphens counted one word per bullet. Found 2026-09-16 by making the editor's word count
    // and this one agree: they disagreed on `- one\n- two`, and this side was the wrong one.
    // It reaches further than the count: this is also the excerpt, the meta description, the
    // OG card and the RSS summary, so a post opening with a hyphen list had the hyphens in
    // all four. Anchored and followed by space, so nothing mid-sentence matches.
    .replace(/^[ \t]*(?:[-+]|\d+[.)])[ \t]+/gm, '')
    // A TABLE, anchored the same way and for the same reason as the list marker above. The
    // rule row is notation entire; the pipes are a grid, not words. Both were counted: a post
    // holding one four-cell table read fifteen words instead of four, so its reading time and
    // the panel beside the editor were wrong, and a post OPENING with a table put `| --- |`
    // into all four summaries.
    // The first line also takes a `---` divider, which is the same shape and counted as a word
    // of its own; `***` and `___` are taken by the bare-character strip below.
    //
    // ⚠️ `-+`, NOT `-{2,}`. GFM's delimiter row is "one or more hyphens" per cell, so `| - | - |`
    // is a table and `| --- | --- |` is the same table — and the two-or-more form read the first
    // one as CONTENT. The pipes then came off on the next line and the excerpt, the meta
    // description, the OG card and the RSS summary of any post opening with such a table all
    // began "a b - - 1 2". Found 2026-09-19 by reading an exported post rather than by a test:
    // every fixture here happened to be written with three hyphens, which is what an editor
    // produces and not what a person typing a small table by hand does.
    .replace(/^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/gm, ' ')
    .replace(/^([ \t]*>?[ \t]*)\|(.*)$/gm, (_m, head: string, rest: string) => head + rest.replace(/\|/g, ' '))
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Auto excerpt: first `maxWords` words of the body, ending with "..." if cut.
export function deriveExcerpt(markdown: string, maxWords = 50): string {
  const plain = toPlainText(markdown)
  if (!plain) return ''
  const words = plain.split(' ')
  const trimmed = words.length <= maxWords ? plain : `${words.slice(0, maxWords).join(' ')}...`
  // Also cap by chars: a single long token (e.g. a URL) can blow past the word limit.
  return clampExcerpt(trimmed)
}

// All image URLs referenced in a piece of (rendered) content: markdown
// `![](url)`, HTML `src="url"`, and bare image URLs. De-duped, in order. Used for
// image SEO (sitemap `<image:image>` + Article schema) so search engines associate
// every image with the page that embeds it. Expects absolute URLs
// (content from getPost/getPage is already expanded to absolute Blob URLs).
export function extractImageUrls(content: string): string[] {
  // Match absolute (https://…) AND root-relative (/uploads/media/…) image URLs — self-
  // hosted images are stored store-relative, so an https-only regex missed them entirely
  // (which silently disabled the Lightbox + the article-schema image fallback).
  const re = /(?:https?:\/\/|\/)[^\s"')]+\.(?:jpe?g|png|webp|avif|gif|svg)/gi
  return [...new Set(content.match(re) ?? [])]
}

// Body word count (whitespace-split, markup stripped). Reused by readingMinutes so
// the two always agree. Note: whitespace-split, so CJK (no word spaces) undercounts —
// fine for space-delimited languages; the reading estimate has always worked this way.
export function wordCount(markdown: string): number {
  return toPlainText(markdown).split(' ').filter(Boolean).length
}

/**
 * How fast a reader is assumed to be. One number, because it is printed in two places.
 *
 * The writing sheet used to carry its own copy at 220, with its own tokenizer, so the same
 * body read "14 min" on the published page and "13 min" over the editor. Measured 2026-09-16
 * on a 2,800 word piece: the two disagreed on every shape tried, prose and pictures and code
 * and pen marks alike. `admin-shared/word-count.ts` is the same arithmetic now, not a second
 * opinion about it.
 */
export const WORDS_PER_MINUTE = 200

/** Whole minutes (>= 1) for a count somebody else has already taken. */
export const minutesFor = (words: number): number =>
  Math.max(1, Math.round(words / WORDS_PER_MINUTE))

// Estimated reading time in whole minutes (>= 1).
export function readingMinutes(markdown: string): number {
  return minutesFor(wordCount(markdown))
}

export type Heading = { id: string; text: string; level: 2 | 3 }

// Pull H2/H3 headings (with slug ids) from markdown for a table of contents.
// Mirrors the ids the renderer assigns, so anchors line up.
export function extractHeadings(markdown: string): Heading[] {
  const out: Heading[] = []
  // Skip fenced code blocks so a "## x" inside code isn't treated as a heading.
  const body = markdown.replace(/```[\s\S]*?```/g, '')
  // De-dupe collisions: 2nd "foo" -> "foo-2", 3rd -> "foo-3". MUST match
  // dedupeHeadingIds in PostContent (both walk H2/H3 in order) or anchors break.
  const counts = new Map<string, number>()
  for (const line of body.split('\n')) {
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) continue
    const text = m[2].replace(/[*_`]/g, '').trim()
    if (!text) continue
    const base = slugify(text)
    // No anchorable slug (e.g. "## !!!") → not a ToC entry; matches PostContent
    // emitting no id, so the two heading walks stay in sync.
    if (!base) continue
    const n = counts.get(base) ?? 0
    counts.set(base, n + 1)
    out.push({ id: n === 0 ? base : `${base}-${n + 1}`, text, level: m[1].length as 2 | 3 })
  }
  return out
}

// Lowercase + strip diacritics, for accent-insensitive search matching. It lives in
// `@/admin-shared/fold` now, beside the admin's own `fold`: the command palette's island
// searches by the two-lane rule (`src/accent.ts`) and may not import this module, which pulls
// the pen grammar and the maths syntax in behind it. Re-exported, so every existing caller
// keeps the import it had — and there is still exactly one answer to "which letters count as
// the same letter".
export { foldAccents } from '@/admin-shared/fold'

// Clamp an author-provided excerpt to a character limit (cut on a word boundary).
export function clampExcerpt(text: string, maxChars = EXCERPT_MAX_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  const cut = clean.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}...`
}

// Human-readable file size from bytes, e.g. "1.2 MB".
// Bytes, read at a glance. It lives in `@/i18n/format` now, because the library's island draws
// a tile for a picture it has just uploaded and may not import this module: three regexes at
// the top of this file pull the pen grammar and the maths syntax in behind them. Re-exported,
// so the twenty call sites that had it here keep the import they had.
export { formatBytes } from '@/i18n/format'

// Is this post visible on the public blog right now? Published + date reached.
export function isPublicallyVisible(status: string, isoDate: string): boolean {
  if (status !== 'published') return false
  const d = new Date(isoDate).getTime()
  if (Number.isNaN(d)) return true
  return d <= Date.now()
}

// Scheduled = published but its date is still in the future, so the read layer
// (isPublicallyVisible) hides it until that time. A malformed date is never scheduled.
export function isScheduled(status: string, isoDate: string): boolean {
  if (status !== 'published') return false
  const d = new Date(isoDate).getTime()
  if (Number.isNaN(d)) return false
  return d > Date.now()
}

/**
 * Untitled drafts, numbered oldest-first, keyed `kind:slug`. The one home for this rule, so
 * the writing sidebar and the dashboard's pick-up band hand the SAME draft the SAME number
 * rather than two copies drifting apart. `created` is the post's own date and the page's
 * `updatedAt`, the same keys both callers already sort by; ties break on slug so the answer
 * is deterministic. Anything with a title is left out.
 */
export function untitledNumbers(
  items: { kind: string; slug: string; title: string; created: number }[],
): Map<string, number> {
  const untitled = items
    .filter((i) => !i.title.trim())
    .sort((a, b) => a.created - b.created || a.slug.localeCompare(b.slug))
  return new Map(untitled.map((i, idx) => [`${i.kind}:${i.slug}`, idx + 1]))
}

/**
 * Fill `{name}` placeholders in a locale string.
 *
 * A plain `String.replace(pattern, replacement)` reads `$&`, `$'`, `` $` `` and `$1` in the
 * REPLACEMENT as instructions, and every one of these substitutions puts text somebody
 * typed on that side: a search query, a term name, a token's label. Searching for `$'` on a
 * site printed the tail of its own template back at the reader. A function replacer is the
 * only form that treats the value as a value.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole)
}

/**
 * How far a zone is from UTC at a given instant, in milliseconds.
 *
 * `Intl` is the only thing in the platform that knows a zone's rules, and it will only
 * FORMAT. So the instant is formatted in the zone, read back as if those numbers were UTC,
 * and the difference between that and the real instant is the offset. Unknown zone or bad
 * date: 0, because a wrong setting must not be able to throw inside a form.
 */
function zoneOffsetMs(at: Date, tz: string): number {
  if (!tz.trim()) return 0
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at)
    const get = (type: string) => Number(f.find((x) => x.type === type)?.value ?? '0')
    // `hour12: false` still reports midnight as 24 in some engines.
    const hour = get('hour') % 24
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'))
    return asUtc - at.getTime()
  } catch {
    return 0
  }
}

/** An instant as the wall clock reads in `tz`, shaped for `<input type="datetime-local">`. */
export function isoToZonedInput(iso: string, tz: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return new Date(at.getTime() + zoneOffsetMs(at, tz)).toISOString().slice(0, 16)
}

/**
 * The reverse: a wall-clock `YYYY-MM-DDTHH:mm` in `tz`, as the instant it names.
 *
 * TWO PASSES, and the second one is not padding. The offset depends on the instant, and the
 * instant is what is being solved for, so the first pass uses the offset at the naive
 * reading and the second uses the offset at the answer that produced. They differ only
 * across a daylight-saving boundary, which is exactly where a scheduled post would otherwise
 * go out an hour wrong.
 */
export function zonedInputToIso(local: string, tz: string): string {
  const naive = new Date(`${local}:00.000Z`)
  if (Number.isNaN(naive.getTime())) return new Date().toISOString()
  const once = new Date(naive.getTime() - zoneOffsetMs(naive, tz))
  return new Date(naive.getTime() - zoneOffsetMs(once, tz)).toISOString()
}
