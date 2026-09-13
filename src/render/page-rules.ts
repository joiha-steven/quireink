// WHAT THIS BLOG ASKS OF THE MARKDOWN ENGINE — and the line the engine may not cross.
//
// `md/html-rules.ts` holds the rules and their SPEC defaults; this holds the answers. They
// are on this side of the line because two of them are things the engine must not own:
//
//   headingId  a slug function that knows Vietnamese diacritics and Cyrillic, because this
//              blog's headings are written in both. A host with other alphabets wants a
//              different one.
//   math       Temml — 212 KB unpacked, a LaTeX engine. An engine that imports it cannot be
//              lifted out, and a host that wants no formulas should not download one.
//
// Everything in `src/md` now imports from `src/md` and from `pen/grammar.ts`, which is
// notation rather than machinery (ADR 0052, and `md/boundary.test.ts` holds the line).
import { GFM, type PageRules } from '@/md/index'
import { renderMath } from '@/render/math'
import { slugify } from '@/utils'

/**
 * GFM plus the six things this blog wants, each one a decision `docs/` records.
 *
 * ⚠️ `softBreak: 'br'` IS THE ONE THAT CHANGES WHAT A READER SEES. Every post here was
 * written under `marked`'s `breaks: true`, so the spec's answer would silently reflow every
 * paragraph somebody typed across two lines. `golden/corpus/lazy-continuation.md` spells it
 * out.
 */
export const PAGE: PageRules = {
  ...GFM,
  // 100% Markdown: raw HTML arrives as the characters somebody typed. The source is a
  // WordPress import and this blog's own MCP server, and that was the promise made about both.
  rawHtml: 'escape',
  softBreak: 'br',
  safeLinks: true,
  // The page's own title is the only `<h1>` on it.
  demoteHeadings: true,
  // H2 and H3 only: those are the two levels the table of contents lists, and an id on a
  // heading nothing links to is a promise to keep for no reader. A heading that slugifies to
  // nothing — `## !!!` — gets none, which is what keeps the ToC and the page in step.
  headingId: (text, level) => (level === 2 || level === 3 ? slugify(text) || null : null),
  tableScope: true,
  math: renderMath,
}
