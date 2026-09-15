// THE PAPER: a ProseMirror application, built into a page the server already drew.
//
// ADR 0054's third decision is the seam this file sits on. Everything around the writing — the
// action line, the title, the attributes panel — arrives as finished HTML, because it is a
// PAGE. The writing surface is not: it is an editor with a schema, a plugin stack, an undo
// history and three node views, and no amount of markup describes it. So the sheet hands this
// two empty slots and gets back an editor.
//
// ⚠️ THE TWO VIEWS ARE BOTH IN THE MARKUP, and this only flips `hidden`. See `sheet-raw.ts`.
import { Editor } from '@/admin/editor/editor'
import type { KeySound } from '@/admin/components/key-sound'
import type { SheetWords } from '@/admin-shared/sheet-wire'
import type { Hit } from '@/admin/components/editorFind'
import { writingSurface } from '@/admin/components/editor-surface'
import { mountSource } from '@/admin/components/editor-source'
import { captionFromUrl, readMarkdown, videoUrlsToNodes } from '@/admin/components/editorDoc'
import { placeCaret } from '@/admin/components/key-feedback'
import { penStrokes } from '@/admin/components/pen-feedback'
import { el } from '@/admin/components/node-dom'
import { focusOn, onFocusChange } from './focus-mode'
import { mountChrome } from './sheet-chrome'
import { wireFind } from './sheet-find'
import { wireRaw } from './sheet-raw'

export type PaperParts = {
  /** The action line, which the chrome measures to know where to stick the toolbar. */
  bar: HTMLElement
  toolbarSlot: HTMLElement
  findSlot: HTMLElement
  sourceSlot: HTMLElement
  paperSlot: HTMLElement
  /** The closing line under the writing, which the Markdown view has nothing to say about. */
  hint: HTMLElement | null
}

export type PaperHooks = {
  t: SheetWords
  /** The body, straight out of the page rather than a second round trip. */
  content: string
  keySound: KeySound
  askLink: (previous: string) => Promise<string | null>
  /** Fired on every edit. Cheap: the sheet flags "unsaved" without serializing the document. */
  onDirty: () => void
  /** The Markdown, when something other than typing has changed it. */
  onText: (markdown: string) => void
  pickImage: () => void
  pickGallery: () => void
  uploadFile: (file: File) => Promise<string | null>
}

export type Paper = {
  /** The document as Markdown, read on demand so a save always catches the latest text. */
  getMarkdown: () => string
  /** Replace the whole document — a revision loaded, a snapshot restored. */
  setMarkdown: (markdown: string) => void
  insertImage: (url: string, alt?: string) => void
  insertGalleryMany: (urls: string[]) => void
  /** Swap between the writing and the raw Markdown source. */
  toggleRaw: () => void
  readonly raw: boolean
  destroy: () => void
}

export function mountPaper(parts: PaperParts, hooks: PaperHooks): Paper {
  const { t, keySound } = hooks
  const editorRef: { current: Editor | null } = { current: null }
  const slashRef: { current: { left: number; top: number } | null } = { current: null }
  // The typewriter's caret: a span the key feedback moves to where the writing is. Drawn only
  // when there is a sound to go with it, because it is that feature's own sight of itself.
  const caret = keySound.mode === 'off'
    ? null
    : el('span', { className: 'typewriter-caret', 'aria-hidden': 'true' })
  const caretRef = { current: caret }

  /** The image files out of a DataTransfer, from a drop or from the clipboard. */
  const imageFiles = (list: FileList | null | undefined): File[] =>
    Array.from(list ?? []).filter((f) => f.type.startsWith('image/'))

  /**
   * Upload and insert, in order, from wherever they came.
   *
   * Shared by the drop handler and the paste handler because they differ in exactly one thing —
   * a drop knows the coordinates it landed on, a paste goes to the cursor — and everything
   * after that has to be identical: the same upload route, the same alt from the file name, and
   * the same walk forward so the second picture lands after the first rather than on top of it.
   *
   * Sequential on purpose. In parallel the uploads finish in whatever order the network
   * decides, and a set of pictures a person chose in an order arrives in another.
   */
  const insertImages = async (files: File[], at: number | undefined): Promise<void> => {
    let pos = at
    for (const file of files) {
      const url = await hooks.uploadFile(file)
      const ed = editorRef.current
      if (!url || !ed) continue
      // A pasted screenshot's name is the browser's ("image.png"), which is no caption at all;
      // a dropped file's usually is one. Either way it stays editable under the picture.
      const alt = file.name.replace(/\.[a-z0-9]+$/i, '')
      const chain = pos == null ? ed.chain().focus() : ed.chain().focus(pos)
      chain.setImage({ src: url, alt }).run()
      pos = ed.state.selection.to
    }
  }

  const editor = new Editor({
    element: parts.paperSlot,
    content: hooks.content,
    placeholder: t.editorPlaceholder,
    askLink: hooks.askLink,
    words: {
      video: { column: t.imgSizeColumn, wide: t.imgSizeWide },
      math: { placeholder: t.mathPlaceholder },
      image: {
        alignLeft: t.imgAlignLeft, alignCenter: t.imgAlignCenter, alignRight: t.imgAlignRight,
        sizeColumn: t.imgSizeColumn, sizeWide: t.imgSizeWide,
        grid: t.imgGrid,
        siteDefault: t.imgDefault, ratioNatural: t.imgRatioNatural,
        captions: t.imgCaptions, noCaptions: t.imgNoCaptions,
        frameNone: t.imgFrameNone, frameThin: t.imgFrameThin,
        frameMedium: t.imgFrameMedium, frameThick: t.imgFrameThick,
        framePaper: t.imgFramePaper, frameInk: t.imgFrameInk,
        caption: t.captionPlaceholder,
      },
    },
    editorProps: writingSurface({
      keySound,
      caretRef,
      slashRef,
      setSlash: (at) => { slashRef.current = at; chrome.openSlash(at) },
      editorRef,
      insertImages,
      imageFiles,
    }),
  })
  editorRef.current = editor
  videoUrlsToNodes(editor)
  editor.on('selectionUpdate', () => {
    if (keySound.mode !== 'off') placeCaret(editor.view, caretRef.current)
  })
  // The pen answering the hand (ADR 0049): a mark just applied draws itself, and squeaks.
  editor.on<{ transaction: import('prosemirror-state').Transaction }>('transaction', ({ transaction }) => {
    penStrokes(editor.view, transaction, keySound)
  })
  // ONE FLAG, AND NOTHING ELSE. This used to serialize the whole document on a 400ms trailing
  // debounce, said to be what kept typing smooth. It was the opposite: 400ms is shorter than the
  // pause between two sentences, so the stall landed in every one — 126ms frozen on an 18k-word
  // draft carrying 2,159 pen marks (2026-09-13). Every reader asks the editor for the text at
  // the moment it needs it instead.
  editor.on('update', () => hooks.onDirty())
  if (caret) parts.paperSlot.appendChild(caret)

  // The source view is built ONCE, now, and never rebuilt: the switch into it carries a caret
  // offset, and a textarea that does not exist at the moment the switch is thrown is a caret
  // that lands at the end of the document.
  const source = mountSource(parts.sourceSlot, {
    onChange: (next) => { raw.setText(next); hooks.onText(next) },
    onDirty: hooks.onDirty,
  })

  const raw = wireRaw(source, editor, {
    onText: hooks.onText,
    onShow: (on) => {
      parts.sourceSlot.hidden = !on
      parts.paperSlot.hidden = on
      if (parts.hint) parts.hint.hidden = on
      find.reset()
      chrome.sync()
    },
  })

  const find = wireFind(parts.findSlot, {
    t,
    editor,
    area: source.area,
    raw: () => raw.on,
    rawText: () => raw.text,
    onRawText: (next) => { raw.setText(next); source.setValue(next); hooks.onText(next); hooks.onDirty() },
    onRawHits: (hits: Hit[], current: number) => source.setHits(hits, current),
    onOpen: () => chrome.sync(),
    onHeight: (px) => chrome.setFindHeight(px),
  })

  const chrome = mountChrome(parts, {
    editor,
    t,
    askLink: hooks.askLink,
    onPickImage: hooks.pickImage,
    onPickGallery: hooks.pickGallery,
    raw: () => raw.on,
    focus: focusOn,
    finding: () => find.open,
    onSlashShut: () => { slashRef.current = null },
  })

  // Focus mode is a switch in the action line and a fact in storage, and the write column
  // beside this listens to the same event. The button strip goes; "/" and the bubble bar keep
  // every command it held.
  const stopFocus = onFocusChange(() => chrome.sync())

  return {
    getMarkdown: () => (raw.on ? raw.text : readMarkdown(editor)),
    setMarkdown: (markdown: string) => {
      editor.commands.setContent(markdown)
      videoUrlsToNodes(editor)
      raw.load(markdown)
    },
    // The described alt (media/alt-text.ts) wins when the library hands one over; the
    // filename-derived caption stays the fallback, as it always was.
    insertImage: (url: string, alt?: string) =>
      editor.chain().focus().setImage({ src: url, alt: alt || captionFromUrl(url) }).run(),
    // Gallery: empty alt for a clean mosaic; `#grid` groups consecutive ones. ONE
    // `insertContent` of an array keeps all the images — a per-image loop would leave only the
    // last, because each `setImage` replaces the selected prior node.
    insertGalleryMany: (urls: string[]) => {
      if (urls.length === 0) return
      const nodes = urls.map((url) => ({ type: 'image', attrs: { src: `${url}#grid`, alt: '' } }))
      editor.chain().focus().insertContent(nodes).run()
    },
    toggleRaw: () => raw.toggle(),
    get raw() { return raw.on },
    destroy: () => {
      stopFocus()
      find.destroy()
      chrome.destroy()
      source.destroy()
      editor.destroy()
    },
  }
}
