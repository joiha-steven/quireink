// Serializer repairs whose symptom is the READER'S page changing.
//
// Two of them, found the same way on 2026-08-30 — by rendering `golden/corpus` before and
// after one pass through the editor and diffing the HTML, which nothing had ever done.
//
// ── 1. The brackets ───────────────────────────────────────────────────────────────────
//
// Two features of this blog are written as square brackets in a paragraph — a footnote
// reference `[^1]` (with its definition `[^1]: …` written the same way) and a callout's
// `[!NOTE]` line. Neither has a node in this editor, so both live in the document as plain
// text, which is fine: the editor shows them, the writer edits them, they save back.
//
// They did NOT save back. `prosemirror-markdown` escapes `[` and `]` on every text node,
// because a bracket can open a link, and it has no way to know that these two shapes are
// already syntax. So typing one word into an existing post and pressing Save rewrote
// `[^1]` as `\[^1\]` and `> [!NOTE]` as `> \[!NOTE\]`, and both features were gone from the
// published page. Measured 2026-08-30 against `golden/corpus`: 19 of 45 fixtures came out
// of one save rendering differently.
//
// AND IT WAS WORSE THAN LITERAL TEXT. `\[…\]` is LaTeX display maths, which this renderer
// does support — so the reader did not get a stray `[^1]`, they got a line break and an
// EMPTY FORMULA in the middle of the sentence, and `[!NOTE]` came out as MathML spelling
// out the letters N-O-T-E.
//
// The repair is the smallest one that is true: serialize the text exactly as before, then
// un-escape the two COMPLETE shapes the renderer treats as syntax. A lone `\[`, a `\]`, a
// half-written `\[^` — all still escaped. It reaches into `state.out` to do it, which is
// the same technique `TableMarkdown.ts` uses to escape pipes, and for the same reason: the
// escaping happens inside the library's writer and the only seam is the buffer it wrote to.
//
// ⚠️ ONE THING IS GIVEN UP, knowingly. A writer who wants the characters `[^1]` to appear
// as text writes `\[^1\]` in the source; that arrives here as the text `[^1]`, and it now
// leaves as `[^1]` — a real footnote reference. Showing footnote syntax as an example is
// rarer than using footnotes, and the alternative is destroying every real one.
//
// ── 2. The blank line after a picture ─────────────────────────────────────────────────
//
// `@tiptap/extension-image` is a BLOCK node here (`inline: false`, its default), but the
// serializer the library hands it is `prosemirror-markdown`'s, where an image is INLINE — so
// it writes `![alt](src)` and never closes the block. Three pictures in a row came back as
// one line, which markdown-it then reads as ONE PARAGRAPH, and the reader's page put three
// `<figure>` elements inside a `<p>`. A figure may not sit in a paragraph: the browser closes
// the `<p>` early, leaves an empty one behind, and every rule written for `article > figure`
// stops matching. `BlockImage` below closes the block, as every other block node does.
import { Text } from '@tiptap/extension-text'
import { defaultMarkdownSerializer } from 'prosemirror-markdown'
import type { Node as PMNode } from '@tiptap/pm/model'
import { CaptionedImage } from './CaptionedImage'

/**
 * The slice of `prosemirror-markdown`'s serializer state used here. `out` is not in the
 * package's published types, so a structural type says exactly what is relied on — the same
 * declaration, for the same reason, as `TableMarkdown.ts`.
 */
type SerializerState = {
  out: string
  text: (text: string, escape?: boolean) => void
  closeBlock: (node: PMNode) => void
}

// A COMPLETE reference, both brackets escaped: `\[^label\]`. The label may not be empty and
// may not itself contain a bracket or a backslash, so a run of escaped brackets across a
// paragraph cannot be read as one enormous label.
const FOOTNOTE = /\\\[\^([^\]\\\s][^\]\\]*)\\\]/g

// A callout's opening tag. Letters only: `buildCallouts` in `render/post-content.ts` matches
// `[!(\w+)]` and then looks the word up in a table of five, so anything else is a blockquote
// either way and does not need protecting.
const CALLOUT = /\\\[!([A-Za-z]+)\\\]/g

/**
 * `<` and `>` written back as entities, which is what `tiptap-markdown`'s own text node does
 * and is NOT decoration: with `html: false` the editor treats raw HTML in a post as plain
 * text, and this is the half of that promise that runs on the way OUT. Dropped by accident
 * while writing this file, it turned `golden/corpus/raw-html-block.md` from a paragraph
 * reading `<script>alert(1)</script>` back into a live script tag in the saved post.
 * Re-implemented here rather than imported because the package does not export it.
 */
const escapeHTML = (value: string): string => value.replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * `text`, with the two shapes above put back.
 *
 * Registered INSTEAD of StarterKit's text node (`text: false` beside it), not alongside it:
 * two schema entries under one name is what made Tiptap log "Duplicate extension names" for
 * `link` and `underline`, and the fix there was the same one.
 */
export const ReaderSyntax = Text.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: PMNode) {
          const before = state.out.length
          state.text(escapeHTML(node.text ?? ''))
          const written = state.out.slice(before)
          const kept = written.replace(FOOTNOTE, '[^$1]').replace(CALLOUT, '[!$1]')
          if (kept !== written) state.out = state.out.slice(0, before) + kept
        },
        parse: {},
      },
    }
  },
})

/**
 * The picture, with the blank line after it that a block node owes its neighbours.
 *
 * Built on `CaptionedImage` rather than added beside it — one name, one schema entry — so the
 * node view, the attributes and the toolbar are all unchanged and only the way out differs.
 * Inside a table cell this still behaves: `TableMarkdown.ts` renders a leaf block through its
 * own serializer and then flattens the newlines, which is what keeps a row a row.
 */
export const BlockImage = CaptionedImage.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: PMNode, parent: PMNode, index: number) {
          defaultMarkdownSerializer.nodes.image(
            state as unknown as Parameters<typeof defaultMarkdownSerializer.nodes.image>[0],
            node,
            parent,
            index,
          )
          if (node.isBlock) state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
