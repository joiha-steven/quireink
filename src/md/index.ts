// The Markdown engine's front door (ADR 0052).
//
// Everything this blog does with Markdown comes through here, and the shape is the point:
// ONE parse, then a choice of renderer. Four engines used to answer this question separately
// — `marked` for the reader, `markdown-it` for opening a post, `prosemirror-markdown` for
// saving it, a run of regular expressions for the excerpt — and they drifted, which is what
// four answers to one question do.
//
// Nothing else in `src/` may parse Markdown.

import type { Document } from './ast'
import { BlockParser } from './block'
import { resetLinkScanBudget } from './link-ref'
import { toAst } from './to-ast'
import { getPageRules, setPageRules, toHtml as renderHtml } from './html'
import { GFM, type PageRules } from './html-rules'

export type { Block, Document, Inline, ListItem } from './ast'
export { GFM, PAGE, SPEC, type PageRules } from './html-rules'

/** Markdown to the syntax tree. The expensive half; every renderer below is cheap. */
export function parse(source: string): Document {
  // The document's allowance for scanning link destinations, spent down by `link-ref.ts` and
  // reset here so two parses of one string always answer the same. See that file for why.
  resetLinkScanBudget(source.length)
  const blocks = new BlockParser()
  const root = blocks.parse(source)
  return toAst(root, blocks.defs)
}

/**
 * The reader's page. Measured against the specs' own examples in `spec.test.ts`.
 *
 * The rules default to GFM — the spec plus its list of tags that never pass through — and NOT
 * to this blog's `PAGE`. A renderer whose default is one site's opinion is a renderer nobody
 * else can use, and the four things `PAGE` adds are all things a host should have to ask for.
 * `render/post-content.ts` asks for them by name.
 */
export function toHtml(source: string, rules: Partial<PageRules> = {}): string {
  // Save and restore rather than reset: a render that happens inside another render must give
  // the outer one back its own rules, not the default. See `html.ts`.
  const held = getPageRules()
  setPageRules({ ...GFM, ...rules })
  try {
    return renderHtml(parse(source))
  } finally {
    setPageRules(held)
  }
}
