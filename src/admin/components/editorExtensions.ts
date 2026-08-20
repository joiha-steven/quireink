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
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { CaptionedImage } from './CaptionedImage'
import { Video } from './VideoNode'
import { Ink } from './InkMark'
import { PenRing, PenUnderline } from './PenMarks'
import { MathInline, MathBlock } from './MathNode'

/**
 * @param placeholder The per-block placeholder text, which is the one thing here that has to
 * come from the caller: it is a translated UI string and this module holds no i18n.
 */
export function editorExtensions(placeholder: string): Extensions {
  return [
    // StarterKit already ships `link` and `underline` in Tiptap 3. Registering them again
    // beside it made Tiptap log "Duplicate extension names found: ['link','underline']"
    // on every editor mount, which is its way of saying two schema entries are fighting
    // over the same mark. `link` is configured through StarterKit rather than added —
    // and `underline` is now switched OFF, because StarterKit's underline cannot reach
    // Markdown: pressing U applied a mark the serializer then dropped on save, silently.
    // `PenMarks.ts` supplies the replacement under the same name and command.
    StarterKit.configure({ link: { openOnClick: false }, underline: false }),
    CaptionedImage,
    Video,
    Ink, // the pen: `==text==` inks as you type, and saves back as `==text==` (InkMark.ts)
    PenUnderline, // `++text++`, and the U button that used to lose its work (PenMarks.ts)
    PenRing, // `@@word@@`, the ballpoint ring (PenMarks.ts)
    // Maths. NOT optional decoration: without these two the serializer doubles every
    // backslash in a formula and deletes `\(…\)` outright on save (MathNode.tsx).
    MathInline,
    MathBlock,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    // GFM task lists (- [ ] / - [x]); marked renders them on the public side.
    TaskList,
    TaskItem.configure({ nested: true }),
    // Per-block placeholder (adds the is-editor-empty class + data-placeholder
    // the CSS reads). The old root data-placeholder attribute rendered nothing.
    Placeholder.configure({ placeholder }),
    // html:false -> raw HTML in the source is treated as plain text, never
    // parsed into nodes. Keeps the blog 100% Markdown.
    Markdown.configure({ html: false }),
  ]
}
