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
import { parseBlocks } from './block'
import { toAst } from './to-ast'
import { setHtmlFiltering, toHtml as renderHtml } from './html'

export type { Block, Document, Inline, ListItem } from './ast'

/** Markdown to the syntax tree. The expensive half; every renderer below is cheap. */
export function parse(source: string): Document {
  return toAst(parseBlocks(source))
}

export type HtmlOptions = {
  /**
   * Escape the tags GFM disallows — `<script>`, `<style>`, `<title>`, `<iframe>` and the rest.
   * On by default: this blog renders Markdown that arrived from a WordPress import and from
   * its own MCP server, and those tags rewrite or run the page around them.
   *
   * Off only where CommonMark's own answer is being measured.
   */
  disallowRawHtml?: boolean
}

/** The reader's page. Measured against the specs' own examples in `spec.test.ts`. */
export function toHtml(source: string, options: HtmlOptions = {}): string {
  setHtmlFiltering(options.disallowRawHtml !== false)
  try {
    return renderHtml(parse(source))
  } finally {
    setHtmlFiltering(true)
  }
}
