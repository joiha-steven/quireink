// THE PLUGIN STACK (ADR 0054 step 7).
//
// ⚠️ TWELVE PLUGINS, WHERE THERE WERE 102. Each package's extension contributed its own keymap
// plugin and its own input-rules plugin, and every keystroke walked the lot. What they were
// doing is here, in the order the view consults them.
//
// The order is not arbitrary: the keymap comes before the input rules so a chord is never eaten
// by a typing rule, the table's own plugin sits above the base keymap so Tab means "next cell"
// inside one, and the history is last so that everything above it has already turned a keystroke
// into the transaction it will be asked to remember.
import { history } from 'prosemirror-history'
import { inputRules as inputRulesPlugin } from 'prosemirror-inputrules'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { tableEditing } from 'prosemirror-tables'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Slice } from 'prosemirror-model'
import { parse } from '@/md/index'
import { toEditor } from '@/md/to-editor'
import { schema } from './schema'
import { inputRules } from './input-rules'
import { editorKeymap, type KeyHooks } from './keymap'
import { findPlugin } from '@/admin/components/FindExtension'
import { penDealPlugin } from '@/admin/components/pen-deal'
import { galleryColsPlugin } from '@/admin/components/image-gallery'

/**
 * THE PER-BLOCK PLACEHOLDER.
 *
 * A class and an attribute on every empty text block; `admin.css` decides which of them is
 * actually printed (`p.is-editor-empty:first-child::before`). Done as a decoration and not as an
 * attribute on the node, because it is not part of the document — a placeholder that reached the
 * serializer would be written into somebody's post.
 */
function placeholder(text: string): Plugin {
  return new Plugin({
    key: new PluginKey('quirePlaceholder'),
    props: {
      decorations(state) {
        const out: Decoration[] = []
        // ⚠️ TOP-LEVEL BLOCKS ONLY, and descending was a regression worth measuring. The rule
        // that prints this is `.ProseMirror p.is-editor-empty:first-child::before`, and
        // `:first-child` is relative to the PARENT element — so an empty paragraph inside a
        // `<td>` or an `<li>` matches it exactly as well as one at the top of the sheet.
        // Walking the whole tree put "Start writing…" inside every empty table cell and every
        // empty list item. Measured against the outgoing build on one table and one list: it
        // decorated 0 blocks, this decorated 3.
        let at = 0
        state.doc.forEach((node) => {
          if (node.isTextblock && node.content.size === 0) {
            out.push(Decoration.node(at, at + node.nodeSize, {
              class: 'is-editor-empty',
              'data-placeholder': text,
            }))
          }
          at += node.nodeSize
        })
        return DecorationSet.create(state.doc, out)
      },
    },
  })
}

/**
 * PASTING AN ARTICLE, and the one flag that decides whether it works.
 *
 * Without this, `# Heading` pasted into the writing surface lands as two characters and a word —
 * and then the serializer escapes what it was handed, so the SAVE writes `\# Heading` into the
 * database and the post publishes as its own source. That shipped once and the owner found it,
 * not a test.
 *
 * `plainText` is prosemirror-view saying the writer held Shift. Declining then is contractual:
 * that is the gesture for "paste this as characters".
 */
function markdownClipboard(): Plugin {
  return new Plugin({
    key: new PluginKey('quireMarkdownClipboard'),
    props: {
      clipboardTextParser: (text: string, _context: unknown, plainText: boolean) => {
        if (plainText) return null as never
        const doc = schema.nodeFromJSON(toEditor(parse(text)))
        // `maxOpen` is what makes a pasted sentence join the paragraph it lands in while a
        // pasted article still arrives as blocks: the first and last nodes open, the ones
        // between them stay whole.
        return Slice.maxOpen(doc.content)
      },
    },
  })
}

/**
 * AN EMPTY PARAGRAPH AT THE END, ALWAYS.
 *
 * ⚠️ WITHOUT IT A PIECE THAT ENDS IN A TABLE OR A PICTURE HAS NOWHERE TO CLICK. There is no
 * position after the last block for a caret to land on, so the only way to keep writing is to
 * put the caret in the last cell and press the right keys — which a writer will not do, and
 * will read as the editor refusing to let them continue.
 *
 * ⚠️ AND IT MUST NOT REACH THE FILE. `md/from-editor.ts` drops an empty paragraph, so the
 * trailing one is invisible to a save; `editor-corpus.test.ts`'s first law — serialize twice,
 * compare — is what holds that, because a paragraph that DID serialize would make every
 * document grow by a blank line on every open.
 */
function trailingParagraph(): Plugin {
  return new Plugin({
    key: new PluginKey('quireTrailingParagraph'),
    appendTransaction(_trs, _old, state) {
      const last = state.doc.lastChild
      if (last && last.type === schema.nodes.paragraph) return null
      // Not part of the undo history: it is the editor keeping a place to stand, not an edit
      // somebody made, and Mod-Z should not have to step over it.
      return state.tr.insert(state.doc.content.size, schema.nodes.paragraph!.create())
        .setMeta('addToHistory', false)
    },
  })
}

export type StackHooks = KeyHooks & {
  /** The per-block placeholder, which is a translated UI string this module holds none of. */
  placeholder: string
  /** Anything a caller mounts on top. The bubble bar arrives this way, after the fact. */
  extra?: Plugin[]
}

export function editorPlugins(hooks: StackHooks): Plugin[] {
  return [
    ...editorKeymap(hooks),
    inputRulesPlugin({ rules: inputRules() }),
    // ⚠️ NO `columnResizing`, AND THAT IS PARITY. The previous editor did not mount it either —
    // `Table` was added with no `resizable` — and it would be a feature with nowhere to keep
    // its answer: a Markdown table has no column widths, so a column dragged wider would be
    // back where it was on the next open.
    tableEditing(),
    dropCursor({ color: 'currentColor', width: 2 }),
    gapCursor(),
    placeholder(hooks.placeholder),
    markdownClipboard(),
    trailingParagraph(),
    // ⚠️ THE PRODUCT'S OWN THREE ARE NOT OPTIONAL, and making them optional was a mistake this
    // repository has already made once. `editorExtensions.ts` existed because two test files
    // held a HAND-COPIED list of extensions prefaced by "the set the editor actually mounts" —
    // a claim nothing enforced — and a fault in one the copies had forgotten would have been
    // invisible to exactly the tests written to catch it. An editor built anywhere in this
    // repository is the editor the writer uses.
    findPlugin(),
    penDealPlugin(),
    galleryColsPlugin(),
    ...(hooks.extra ?? []),
    history(),
  ]
}
