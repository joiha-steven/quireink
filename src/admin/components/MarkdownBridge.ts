// The editor's Markdown, both directions, through our own engine.
//
// This replaces `tiptap-markdown`, and with it `markdown-it` and `prosemirror-markdown` — the
// last three of the four libraries ADR 0052 set out to retire. The reader's page changed over
// on 2026-09-13; this is the other half, and it is the dangerous half: the reader only reads,
// and a save WRITES OVER THE AUTHOR'S WORDS. A bug here does not look like a bug. It looks like
// a sentence that is no longer in a post published months ago.
//
// WHAT IT IS NOT: a port. The old bridge went the long way — markdown-it produced HTML, and
// `setContent` parsed that HTML back into nodes through every extension's `parseHTML` — and
// whatever the HTML could not say was lost at the join. `md/to-editor.ts` builds the
// ProseMirror JSON directly, so there is no HTML in the middle and nothing to spell twice.
//
// ⚠️ WHAT IS LEFT HERE IS TWO FUNCTIONS. This was a Tiptap `Extension` that overrode two of the
// library's commands and hung a `getMarkdown` on the editor's storage, because an extension had
// no other way to reach either. ADR 0054's step 7 removed the extension system: parsing on the
// way in is `editor/commands-doc.ts`, the clipboard's own reader is `editor/plugins.ts`, and
// `getMarkdown()` is a method. The function below is what all three call.
//
// ⚠️ `MarkdownTightLists` IS DELIBERATELY NOT REPLACED. The old bridge carried a Tiptap
// extension that put a `tight` attribute on every list so its serializer could read the
// tightness back. Ours infers it from what the item holds (`md/from-editor.ts`), and that is
// not a shortcut — the attribute was WRONG. `golden/corpus/task-lists.md` is tight in the
// source, and the old bridge published it loose. Nothing reads the `tight` class it added.

import type { Node as PMNode } from 'prosemirror-model'
import { toMarkdown } from '@/md/to-markdown'
import { fromEditor, type PMNode as TreeNode } from '@/md/from-editor'

/**
 * A ProseMirror node as Markdown. THE ONE implementation, called from three places.
 *
 * It takes any node, not just a whole document: `editorDoc.ts` hands it `doc.cut(0, pos)` to
 * ask where the caret is in the source, and the clipboard hands it a slice's content. All of
 * them want the same answer, and a second copy of "how a document becomes a file" is how the
 * repository ended up with four Markdown engines in the first place.
 */
export function documentToMarkdown(node: PMNode): string {
  return toMarkdown(fromEditor(node as unknown as TreeNode))
}
