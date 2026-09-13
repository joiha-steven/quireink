// What a HOST asks of the renderer, as against what the spec asks.
//
// `html.ts` answers to CommonMark and GFM: every rule in it is one a spec example measures,
// and it may not hold an opinion the spec does not. This file holds the opinions — the five
// things THIS blog needs that no Markdown spec mentions, each carried today by a `marked`
// option or renderer override in `render/post-content.ts`, and each a rule a different host
// would reasonably set differently.
//
// Keeping them here rather than in the renderer is what makes the engine portable: the
// default below is the spec and nothing else, so a second site — or this engine published on
// its own — starts from CommonMark and adds what it wants. `PAGE` is what this blog wants.
//
// ⚠️ ONE OF THE FIVE IS A SECURITY CONTROL, not a preference. `safeLinks` is what stops
// `[js](javascript:alert(1))` from publishing as a working link, and the engine had the hole
// open until the golden suite printed it beside the page v1 produces:
//
//     v1      <a href="#">js</a>
//     engine  <a href="javascript:alert(1)">js</a>
//
// It was found by wiring the engine up as a MEASUREMENT rather than as a switch, which is the
// only reason it turned up on the bench instead of on the site.

import { slugify } from '@/utils'

/** The rules a host sets. Every default is the spec's answer, so omitting them all is CommonMark. */
export type PageRules = {
  /**
   * What becomes of raw HTML in the source.
   *
   *   `pass`    — through, untouched. CommonMark, and six of its examples check it.
   *   `filter`  — GFM's list of tags that rewrite or run the page is escaped; the rest passes.
   *   `escape`  — none of it is HTML. It arrives as the characters somebody typed.
   *
   * This blog is `escape`: it renders Markdown that came from a WordPress import and from its
   * own MCP server, and "100% Markdown, raw HTML shown verbatim" is the promise it made.
   */
  rawHtml: 'pass' | 'filter' | 'escape'
  /**
   * What a single newline inside a paragraph means.
   *
   * ⚠️ THE ONLY RULE HERE THAT CHANGES WHAT A READER SEES. CommonMark says a lone newline is
   * a `newline` — the words reflow into one wrapped line — and `marked` has run with
   * `breaks: true` since Quire 1.x, which makes it a `br` and holds the line where the author
   * pressed Enter. Every post on this blog was written under the second rule, so switching to
   * the first would silently reflow every paragraph somebody typed across two lines without a
   * blank line between them.
   *
   * Found by `golden/corpus/lazy-continuation.md`, the one fixture that spells the difference
   * out: `> a quote` / `that continues lazily` is two lines on the page today, and under the
   * spec's rule it would have become one.
   */
  softBreak: 'newline' | 'br'
  /** Rewrite a `javascript:`, `data:` or `vbscript:` destination to `#`. */
  safeLinks: boolean
  /** Demote a body `#` to `<h2>`: the page's own title is the only `<h1>` on it. */
  demoteHeadings: boolean
  /** An anchor id for a heading, from its words — or `null` for no ids at all. */
  headingId: ((text: string, level: number) => string | null) | null
  /** `scope="col"` on a table's header cells. WCAG 1.3.1 asks for it by name. */
  tableScope: boolean
}

/** CommonMark and nothing more. What the engine is when nobody has an opinion. */
export const SPEC: PageRules = {
  rawHtml: 'pass',
  softBreak: 'newline',
  safeLinks: false,
  demoteHeadings: false,
  headingId: null,
  tableScope: false,
}

/** GFM: the spec, plus its list of tags that never pass through. */
export const GFM: PageRules = { ...SPEC, rawHtml: 'filter' }

/**
 * What this blog asks for. The five overrides `render/post-content.ts` carries today.
 *
 * ⚠️ THE ONE IMPORT THAT IS NOT PORTABLE lives here on purpose. `slugify` knows about
 * Vietnamese diacritics and Cyrillic because this blog's headings are written in both, and a
 * host with different alphabets wants a different function — so it arrives as one, and
 * cutting this file's single `@/` line is what turns the engine loose.
 */
export const PAGE: PageRules = {
  rawHtml: 'escape',
  softBreak: 'br',
  safeLinks: true,
  demoteHeadings: true,
  // H2 and H3 only: those are the two levels the table of contents lists, and an id on a
  // heading nothing links to is a promise to keep for no reader. A heading that slugifies to
  // nothing — `## !!!` — gets none, which is what keeps the ToC and the page in step.
  headingId: (text, level) => (level === 2 || level === 3 ? slugify(text) || null : null),
  tableScope: true,
}

/** Below this code point, and DEL, a character is a control character and never part of a URL. */
const LOWEST_PRINTABLE = 0x20
const DEL = 0x7f

/**
 * A destination, with the schemes that execute taken away.
 *
 * CONTROL CHARACTERS COME OUT FIRST, and that is the whole difficulty: a browser ignores a
 * tab or a newline inside a scheme, so a `javascript:` broken by one runs while a test for
 * `/^javascript:/` says the URL is clean. Strip, then match.
 *
 * ⚠️ THE STRIP IS WRITTEN AS A COMPARISON, not as a character class, and that is deliberate.
 * The obvious spelling is a range escape, and writing one by hand put an actual NUL byte into
 * this file — which `check:nul` caught, and which then made the file un-editable by matching
 * text, exactly as that check's message warns. Comparing code points says the same thing with
 * nothing left for an editor or a pipe to reinterpret.
 */
export function safeHref(href: string): string {
  let cleaned = ''
  for (const ch of href.trim()) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= LOWEST_PRINTABLE && code !== DEL) cleaned += ch
  }
  return /^(?:javascript|data|vbscript):/i.test(cleaned) ? '#' : cleaned
}
