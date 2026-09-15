// Three things done TO a Tiptap document, with no React anywhere near them.
//
// Lifted out of `Editor.tsx` on 2026-09-13, when the find strip needed five lines in a file
// already sitting one line under its ceiling. The seam is not arithmetic: each of these takes
// an editor and answers a question about the document, and none of them has ever needed a
// hook, a prop or a piece of state. `editorExtensions.ts` came out of the same file for the
// same reason and the split held.
import type { Editor as TiptapEditor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { isVideoUrl } from '@/render/video'
import { documentToMarkdown } from './MarkdownBridge'

export function readMarkdown(editor: TiptapEditor): string {
  return documentToMarkdown(editor.state.doc)
}

/**
 * WHERE THE CARET IS, said in the other view's units — so switching between the writing and
 * the Markdown source lands on the line the writer was in the middle of.
 *
 * Both directions rest on ONE property, checked rather than assumed: serializing the
 * document CUT at a position produces exactly the prefix that serializing the whole document
 * produces. It holds because the serializer walks the tree in order and never looks ahead,
 * and it means a length is an offset — no mapping table, no matching on the text.
 *
 * Without this the switch lost the place twice over. The scroll box kept its PIXEL offset
 * while the two views have different heights, so 85% of the way down the writing became 66%
 * of the way down the source; and the textarea opened with its caret at 0, so the moment it
 * was clicked to carry on typing the browser scrolled to the caret and the whole piece
 * jumped to the top. Measured 2026-09-13 on an 18k-word draft: from every one of three
 * starting points, the first click in the source view went to offset 0.
 */
export function markdownOffsetAt(editor: TiptapEditor, pos: number): number {
  return documentToMarkdown(editor.state.doc.cut(0, pos)).length
}

/**
 * The reverse, by NEWTON'S METHOD rather than a binary search, because the two lengths are
 * very nearly proportional — Markdown is the text plus its notation — so one step of
 * interpolation lands close and the next two land on it. A binary search over the same range
 * would be a dozen serializes of half a document; this is three of them, and it stops early
 * when a step changes nothing.
 *
 * `THRESHOLD` is in Markdown characters: closer than a short word is closer than a reader can
 * see, and chasing the last few characters costs a whole serialize each.
 */
export function posAtMarkdownOffset(editor: TiptapEditor, offset: number, markdown: string): number {
  const size = editor.state.doc.content.size
  if (markdown.length === 0 || size === 0) return 0
  const THRESHOLD = 8
  const perChar = size / markdown.length
  let pos = Math.min(size, Math.max(0, Math.round(offset * perChar)))
  for (let step = 0; step < 3; step++) {
    const here = markdownOffsetAt(editor, pos)
    const off = offset - here
    if (Math.abs(off) <= THRESHOLD) break
    const next = Math.min(size, Math.max(0, pos + Math.round(off * perChar)))
    if (next === pos) break
    pos = next
  }
  // A caret must sit in text, and `cut` counts positions the schema may not allow one at —
  // the gap between two paragraphs, for instance. The nearest legal one is what gets used.
  return editor.state.doc.resolve(pos).parent.isTextblock
    ? pos
    : TextSelection.near(editor.state.doc.resolve(pos)).from
}

// Default caption from a media URL: the file name without its upload-timestamp
// prefix or extension (e.g. ".../1781-my-photo.jpg" -> "my-photo").
export function captionFromUrl(url: string): string {
  const base = decodeURIComponent(url.split('/').pop() ?? '').replace(/[#?].*$/, '')
  return base.replace(/^\d+-/, '').replace(/\.[a-z0-9]+$/i, '')
}

// After loading/parsing markdown, promote any paragraph that is just a video URL
// into a video node, so reloaded posts show the embed (not a bare link).
export function videoUrlsToNodes(editor: TiptapEditor): void {
  const { state } = editor
  const videoType = state.schema.nodes.video
  if (!videoType) return
  const hits: { from: number; to: number; src: string }[] = []
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return
    const text = node.textContent.trim()
    if (text && !/\s/.test(text) && isVideoUrl(text)) hits.push({ from: pos, to: pos + node.nodeSize, src: text })
  })
  if (!hits.length) return
  let tr = state.tr
  hits.reverse().forEach(({ from, to, src }) => {
    tr = tr.replaceWith(from, to, videoType.create({ src }))
  })
  editor.view.dispatch(tr)
}
