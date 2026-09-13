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
import { toHtml as renderHtml } from './html'

export type { Block, Document, Inline, ListItem } from './ast'

/** Markdown to the syntax tree. The expensive half; every renderer below is cheap. */
export function parse(source: string): Document {
  return toAst(parseBlocks(source))
}

/** The reader's page. Measured against the specs' own examples in `spec.test.ts`. */
export function toHtml(source: string): string {
  return renderHtml(parse(source))
}
