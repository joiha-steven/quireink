// The editor's extension set, as ONE list that both the editor and its tests read.
//
// It lived inline in `Editor.tsx` until the maths nodes pushed that file past its 400-line
// cap. Moving it is the better half of that trade rather than the cheap way out of a red
// check: `ink-mark.test.ts` and `math-node.test.ts` each held a HAND-COPIED version of this
// array, prefaced by the comment "the extension set Editor.tsx actually mounts" — a claim
// nothing enforced. A serializer bug in an extension the tests forgot to copy would have
// been invisible to exactly the tests written to catch serializer bugs.
//
// Now there is one list. A node added here is a node the round-trip suites are already
// running against.
import type { Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { Table } from '@tiptap/extension-table'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Placeholder } from '@tiptap/extension-placeholder'
import { MarkdownBridge } from './MarkdownBridge'
import { Video, type VideoWords } from './VideoNode'
import { Ink } from './InkMark'
import { CaptionedImage, type ImageWords } from './CaptionedImage'
import { LinkKey } from './editorLinkKey'
import { PenRing, PenUnderline } from './PenMarks'
import { PenDeal } from './pen-deal'
import { MathInline, MathBlock, type MathWords } from './MathNode'
import { Find } from './FindExtension'

/**
 * @param placeholder The per-block placeholder text, which is the one thing here that has to
 * come from the caller: it is a translated UI string and this module holds no i18n.
 * @param askLink Opens the product's link box for `Mod-k` and resolves to the URL, '' to
 *   unlink, or null if the reader backed out. A callback rather than a translated string
 * reason, and defaulted so the seven round-trip suites can keep calling this with one argument.
 */
/**
 * The WORDS the node views print, which they cannot look up for themselves.
 *
 * A node view runs inside the document rather than inside the application, so it has no context
 * and no dictionary. Passing them in keeps every string in `locales/` where the eleven
 * languages are — the alternative is a node view importing all eleven to print two labels.
 * Defaulted, so the fourteen round-trip suites keep calling this with one argument.
 */
export type NodeWords = { video: VideoWords; math: MathWords; image: ImageWords }

const ENGLISH: NodeWords = {
  video: { column: 'Column', wide: 'Large' },
  math: { placeholder: 'LaTeX formula' },
  image: {
    alignLeft: 'Left', alignCenter: 'Center', alignRight: 'Right',
    sizeColumn: 'Column', sizeWide: 'Large',
    grid: 'Grid',
    siteDefault: 'Default', ratioNatural: 'As shot',
    captions: 'Captions', noCaptions: 'No captions',
    frameNone: 'No frame', frameThin: 'Thin', frameMedium: 'Medium', frameThick: 'Thick',
    framePaper: 'Paper', frameInk: 'Ink',
    caption: 'Image caption',
  },
}

export function editorExtensions(
  placeholder: string,
  askLink: (previous: string) => Promise<string | null> = async () => null,
  words: NodeWords = ENGLISH,
): Extensions {
  return [
    // StarterKit already ships `link` and `underline` in Tiptap 3. Registering them again
    // beside it made Tiptap log "Duplicate extension names found: ['link','underline']"
    // on every editor mount, which is its way of saying two schema entries are fighting
    // over the same mark. `link` is configured through StarterKit rather than added —
    // and `underline` is now switched OFF, because StarterKit's underline cannot reach
    // Markdown: pressing U applied a mark the serializer then dropped on save, silently.
    // `PenMarks.ts` supplies the replacement under the same name and command.
    //
    // StarterKit's own TEXT node is back since 2026-09-13. `ReaderSyntax.ts` replaced it for
    // one reason — `prosemirror-markdown` escaped `[` and `]` on every text node, so every
    // footnote reference and every callout tag was destroyed on save — and that serializer is
    // gone. `md/to-markdown.ts` escapes the opening bracket only, in the engine, for every
    // caller at once.
    StarterKit.configure({ link: { openOnClick: false }, underline: false }),
    CaptionedImage.configure({ words: words.image }),
    Video.configure({ words: words.video }),
    Ink, // the pen: `==text==` inks as you type, and saves back as `==text==` (InkMark.ts)
    PenUnderline, // `++text++`, and the U button that used to lose its work (PenMarks.ts)
    PenRing, // `@@word@@`, the ballpoint ring (PenMarks.ts)
    // Which of the forty pens each of those three is drawn with. The page hashes every
    // gesture into a `data-pen` variant and the editor never did, so one fallback grip
    // stood in for all forty (pen-deal.ts).
    PenDeal,
    // Maths. NOT optional decoration: without these two the serializer doubles every
    // backslash in a formula and deletes `\(…\)` outright on save (MathNode.tsx).
    MathInline.configure({ words: words.math }),
    MathBlock.configure({ words: words.math }),
    // `Table` from the package again since 2026-09-13. `TableMarkdown.ts` existed to replace
    // the library's serializer — it deleted a cell holding only a formula or an image, wrote a
    // flat `| --- |` that lost every column's alignment, and let an escaped pipe re-cut the row
    // on the next save. `md/from-editor.ts` reads all three off the document instead.
    Table,
    TableRow,
    TableHeader,
    TableCell,
    // GFM task lists (- [ ] / - [x]); marked renders them on the public side.
    TaskList,
    TaskItem.configure({ nested: true }),
    // One list that is part bullets and part checkboxes arrives tagged as all checkboxes, and
    // the repair ProseMirror makes for that adds an empty `- [ ]` to the post on every save

    // Mod-k. The rest of this product's keyboard is in `editorKeys.ts`; only the link needs
    // to run inside the editor, holding the selection it is about to mark.
    LinkKey.configure({ askLink }),
    // Find and replace. It adds no keys and no commands: it holds the query and DRAWS the
    // hits, and the strip above the sheet drives it. Mounted here rather than conditionally
    // so the seven round-trip suites run against the same document the writer sees — a
    // decoration changes nothing the serializer can see, which is the property being relied
    // on and therefore the one worth exercising.
    Find,
    // Per-block placeholder (adds the is-editor-empty class + data-placeholder
    // the CSS reads). The old root data-placeholder attribute rendered nothing.
    Placeholder.configure({ placeholder }),
    // html:false -> raw HTML in the source is treated as plain text, never
    // parsed into nodes. Keeps the blog 100% Markdown.
    //
    // `transformPastedText` IS NOT A PREFERENCE. Off — its default — a Markdown article
    // pasted into the writing surface lands as literal text: the headings keep their `#`,
    // the table stays a wall of pipes, the fence stays three backticks. Worse than looking
    // wrong, it SAVES wrong: the serializer escapes what it has been handed, so the post
    // that reaches the database reads `\# Heading` and `&gt; quote`, and it publishes that
    // way. Measured 2026-08-21 on a draft pasted in whole.
    //
    // On, the pasted text goes through the same parser the editor uses to open a post — same
    // rules, same notation, so `$…$`, `==ink==` and the tables arrive as the nodes they are.
    // Two things it deliberately does not touch: a paste inside a code block (ProseMirror
    // hands `code` context plain text before any parser is consulted), and a paste made with
    // Shift held, which is the browser's own "as plain text" gesture.
    //
    // No `html: false` to configure any more, because there is no option: `md/to-editor.ts`
    // puts raw HTML in the document as the characters somebody typed, always. That was the
    // promise this blog made — 100% Markdown — and it is now a property rather than a setting.
    MarkdownBridge,
  ]
}
