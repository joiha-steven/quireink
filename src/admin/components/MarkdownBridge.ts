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
// THE SEAM IS COPIED ON PURPOSE. `tiptap-markdown` swaps `editor.options.content` for parsed
// content in `onBeforeCreate` and puts the string back in `onCreate`, so that an editor built
// with `content: '# hi'` still works and `editor.options.content` still reads as what the
// caller passed. Eleven test files and three forms construct editors that way. Matching the
// seam exactly is what let this change be measured against the old bridge instead of being
// merged with a rewrite of everything that calls it.
//
// ⚠️ `MarkdownTightLists` IS DELIBERATELY NOT REPLACED. The old bridge carried a Tiptap
// extension that put a `tight` attribute on every list so its serializer could read the
// tightness back. Ours infers it from what the item holds (`md/from-editor.ts`), and that is
// not a shortcut — the attribute was WRONG. `golden/corpus/task-lists.md` is tight in the
// source, and the old bridge published it loose. Nothing reads the `tight` class it added.

import { Extension, extensions } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Slice } from 'prosemirror-model'
import type { Node as PMNode } from 'prosemirror-model'
import { parse } from '@/md/index'
import { toEditor } from '@/md/to-editor'
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

/** Markdown as a ProseMirror document, in the JSON shape `setContent` takes. */
function markdownToDocument(content: unknown): unknown {
  return typeof content === 'string' ? toEditor(parse(content)) : content
}

type BridgeStorage = {
  getMarkdown: () => string
  /** Kept for the shape `editorDoc.ts` and the suites already read. */
  serializer: { serialize: (node: PMNode) => string }
}

export const MarkdownBridge = Extension.create({
  name: 'markdown',
  // The priority `tiptap-markdown` ran at. It decides where this extension's command
  // overrides sit relative to everything else's, and changing it while changing the engine
  // would have made a difference in either impossible to attribute.
  priority: 50,

  addCommands() {
    // Tiptap's own `Commands` extension, called for its default implementations so this one can
    // wrap two of them. Its `addCommands` is `() => ({ ...commands })` and touches no `this`,
    // which is why calling it detached is safe and why the cast is the honest way to say so —
    // `tiptap-markdown` reached for the same field for the same reason.
    const commands = (extensions.Commands.config.addCommands as unknown as
      () => Record<string, (...args: never[]) => unknown>)()
    return {
      // `setContent` and `insertContentAt` take Markdown here, not HTML — which is the whole
      // reason the editor can be handed a post and show it. A caller passing JSON still works:
      // only a string is parsed.
      setContent:
        (content: unknown, options?: unknown) =>
          (props: never) =>
            (commands.setContent as never as (c: unknown, o?: unknown) => (p: never) => boolean)(
              markdownToDocument(content), options,
            )(props),
      insertContentAt:
        (range: unknown, content: unknown, options?: unknown) =>
          (props: never) =>
            (commands.insertContentAt as never as (r: unknown, c: unknown, o?: unknown) => (p: never) => boolean)(
              range, markdownToDocument(content), options,
            )(props),
    } as never
  },

  onBeforeCreate() {
    const storage: BridgeStorage = {
      getMarkdown: () => documentToMarkdown(this.editor.state.doc),
      serializer: { serialize: (node: PMNode) => documentToMarkdown(node) },
    }
    ;(this.editor.storage as unknown as Record<string, unknown>).markdown = storage
    // The string goes back in `onCreate`. Anything reading `editor.options.content` — a test,
    // a dirty check — must see what the caller passed, not the JSON it became.
    const options = this.editor.options as unknown as { content: unknown; initialContent?: unknown }
    options.initialContent = options.content
    options.content = markdownToDocument(options.content)
  },

  onCreate() {
    const options = this.editor.options as unknown as { content: unknown; initialContent?: unknown }
    options.content = options.initialContent
    delete options.initialContent
  },

  addStorage() {
    // Filled in `onBeforeCreate`, which is the only hook that runs before the document is
    // built. Returning the real object here would be overwritten by Tiptap's own merge.
    return {}
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markdownBridgeClipboard'),
        props: {
          /**
           * PASTING AN ARTICLE, and the one flag that decides whether it works.
           *
           * Without this, `# Heading` pasted into the writing surface lands as two characters
           * and a word — and then the serializer escapes what it was handed, so the SAVE
           * writes `\# Heading` into the database and the post publishes as its own source.
           * That shipped once and the owner found it, not a test.
           *
           * `plainText` is prosemirror-view saying the writer held Shift. Declining then is
           * contractual: that is the gesture for "paste this as characters".
           */
          clipboardTextParser: (text: string, _context: unknown, plainText: boolean) => {
            if (plainText) return null as never
            const doc = this.editor.schema.nodeFromJSON(toEditor(parse(text)))
            // `maxOpen` is what makes a pasted sentence join the paragraph it lands in while a
            // pasted article still arrives as blocks: the first and last nodes open, the ones
            // between them stay whole.
            return Slice.maxOpen(doc.content) as never
          },
        },
      }),
    ]
  },
})
