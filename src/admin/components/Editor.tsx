// TipTap markdown editor with a compact toolbar.
// Marks/nodes: bold, italic, underline, strike, inline code, H1-H5, bullet +
// numbered + task lists, quote, code block, horizontal rule, link, image
// (align + wide + grid gallery), GFM tables, and video (paste a YouTube/Vimeo/TikTok URL).
// Drag an image file in -> auto-uploads -> inserts at the drop point. A Markdown/Review
// toggle swaps the formatted view for the raw Markdown source.
import type { KeySound } from './key-sound'
import { useEffect, useReducer, useRef, useState } from 'react'
// ⚠️ `@tiptap/core`, NOT `@tiptap/react`. `useEditor` and `EditorContent` were the last two
// runtime uses of the React adapter in the whole repository, and they are both thin: the hook
// builds an instance and forces a re-render per transaction, and the component moves the
// editor's detached DOM into the tree. Both are done by hand below, in about fifteen lines,
// and the adapter's remaining machinery — portals for React node views — has had nothing to
// carry since the three node views became plain ProseMirror (2026-09-15).
import { Editor as TiptapEditor } from '@tiptap/core'
import { editorExtensions } from './editorExtensions'
import { useEditorChrome } from './useEditorChrome'
import { useLinkAsker } from './editorLink'
import { useFocusMode } from './useFocusMode'
import { placeCaret } from './key-feedback'
import { penStrokes } from './pen-feedback'
import { writingSurface } from './editor-surface'

import { useAdminT } from './I18nProvider'
import { mountSource, type SourceView } from './editor-source'
import { useEditorFind } from './useEditorFind'
import { captionFromUrl, readMarkdown, videoUrlsToNodes } from './editorDoc'
import { useRawView } from './useRawView'
import { CARD } from './kit'

export type EditorApi = {
  // Swap between the formatted view and the raw Markdown source. On the API because the
  // control that calls it is the MD switch in the ACTION LINE, outside this component.
  toggleRaw: () => void
  insertImage: (url: string, alt?: string) => void
  // Insert several images as gallery items (#grid) in ONE transaction —
  // consecutive #grid images group into a CSS grid on the public side. Must be a
  // single insert: setImage selects the node it inserts, so calling it in a loop
  // makes each image REPLACE the previous one (only the last survived).
  insertGalleryMany: (urls: string[]) => void
  // Serialize the current document to Markdown on demand (used at save time, so
  // a save always captures the latest text even mid-debounce).
  getMarkdown: () => string
  // Replace the whole document (used by the time machine to load a revision).
  setMarkdown: (md: string) => void
}

type Props = {
  initialContent: string
  // Latest Markdown, pushed on a trailing debounce (keeps fast typing smooth).
  onChange: (markdown: string) => void
  // Fired immediately on every edit. Cheap: lets the parent flag "unsaved" without
  // serializing the whole document on each keystroke.
  onDirty: () => void
  onPickImage: () => void
  onPickGallery: () => void
  onUploadFile: (file: File) => Promise<string | null>
  apiRef: React.MutableRefObject<EditorApi | null>
  // Width of the public single-post column, so typing mirrors the live layout.
  contentWidth: number
  toolbarTop?: number
  keySound: KeySound
  /** The action line (back link · status · session buttons), rendered as the SHEET'S OWN
      top row — the mock's sheettop lives inside the sheet. As a separate floating band it
      and the toolbar read as two pieces of chrome with a crack of page between them. */
  actions?: React.ReactNode
  /** The title and its meta line, rendered INSIDE the sheet above the writing (the mock's
      paper holds the title; a title floating above the card was chrome). */
  header?: React.ReactNode
  /** Told when the raw/markdown view flips, so the MD switch in the action line shows state. */
  onRawChange?: (raw: boolean) => void
}

export function Editor({ initialContent, onChange, onDirty, onPickImage, onPickGallery, onUploadFile, apiRef, contentWidth, toolbarTop = 0, keySound, actions, header, onRawChange }: Props) {
  const t = useAdminT()
  // Mod-k opens the same box the toolbar and the bubble bar do; the extension takes it as
  // an option because it holds no React (`editorKeys.ts`).
  const askLink = useLinkAsker()
  // Read straight from the shared switch rather than as a prop: the two forms above this
  // one have no interest in it, and a prop threaded through a component that does not care
  // is how the next person ends up with two of them.
  const [focus] = useFocusMode()
  // Where the "/" menu is open, in viewport coordinates — null when it is not.
  const [slash, setSlash] = useState<{ left: number; top: number } | null>(null)
  const slashRef = useRef(slash)
  useEffect(() => { slashRef.current = slash }, [slash])
  // Refs so getMarkdown / the debounce read live values without re-subscribing.
  const onChangeRef = useRef(onChange)
  const onDirtyRef = useRef(onDirty)
  const caretRef = useRef<HTMLSpanElement>(null)
  // The editorProps closures below are created once (on the first useEditor call,
  // when `editor` is still null). Reading the live instance through a ref instead
  // of the captured `editor` const is what makes drag-drop insert reliably —
  // otherwise the dropped image only appeared when the stale closure happened to
  // hold a non-null editor, so the drop worked only sometimes.
  const editorRef = useRef<TiptapEditor | null>(null)

  /** The image files out of a DataTransfer, from a drop or from the clipboard. */
  const imageFiles = (list: FileList | null | undefined): File[] =>
    Array.from(list ?? []).filter((f) => f.type.startsWith('image/'))

  /**
   * Upload and insert, in order, from wherever they came.
   *
   * Shared by the drop handler and the paste handler because they differ in exactly one
   * thing — a drop knows the coordinates it landed on, a paste goes to the cursor — and
   * everything after that has to be identical: the same upload route, the same alt from the
   * file name, and the same walk forward so the second picture lands after the first rather
   * than on top of it.
   *
   * Sequential on purpose. In parallel the uploads finish in whatever order the network
   * decides, and a set of pictures a person chose in an order arrives in another.
   */
  const insertImageFiles = async (files: File[], at: number | undefined): Promise<void> => {
    let pos = at
    for (const file of files) {
      const url = await onUploadFile(file)
      const ed = editorRef.current
      if (!url || !ed) continue
      // A pasted screenshot's name is the browser's ("image.png"), which is no caption at
      // all; a dropped file's usually is one. Either way it stays editable under the picture.
      const alt = file.name.replace(/\.[a-z0-9]+$/i, '')
      const chain = pos == null ? ed.chain().focus() : ed.chain().focus(pos)
      chain.setImage({ src: url, alt }).run()
      pos = ed.state.selection.to
    }
  }

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onDirtyRef.current = onDirty }, [onDirty])
  // Report raw-view flips from the STATE, not from inside toggleRaw: the toggle is called
  // through `apiRef` where a captured prop would go stale, and the state is the truth.
  const onRawChangeRef = useRef(onRawChange)
  useEffect(() => { onRawChangeRef.current = onRawChange }, [onRawChange])

  /**
   * ⚠️ ONE RE-RENDER PER TRANSACTION, which is what `shouldRerenderOnTransaction: true` bought
   * and what the toolbar's live highlights are made of: 36 `isActive` calls and one read of
   * the find plugin's state, all of them recomputed from scratch after every keystroke. That
   * is a lot of work for a highlight, and it is the NEXT thing to go — but it goes on its own,
   * measured, not smuggled into the commit that drops the adapter. The adapter subscribed to
   * `transactionNumber` for exactly this; so does the line below.
   */
  const [, redraw] = useReducer((n: number) => n + 1, 0)

  // The instance is state rather than a ref because the chrome has to be drawn again once it
  // exists, and null on the first pass because it cannot be built before the effect runs. That
  // is the shape `useEditor` had, placeholder frame and all.
  const [editor, setEditor] = useState<TiptapEditor | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const made = new TiptapEditor({
      extensions: editorExtensions(t.editorPlaceholder, askLink, {
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
      }),
      content: initialContent,
      editorProps: writingSurface({
        keySound, caretRef, slashRef, setSlash, editorRef, imageFiles,
        insertImages: insertImageFiles,
      }),
      onCreate({ editor }) {
        videoUrlsToNodes(editor)
      },
      onSelectionUpdate({ editor }) {
        if (keySound.mode !== 'off') placeCaret(editor.view, caretRef.current)
      },
      // The pen answering the hand (ADR 0049): a mark just applied draws itself, and squeaks.
      onTransaction({ editor, transaction }) {
        penStrokes(editor.view, transaction, keySound)
      },
      onUpdate() {
        // ONE FLAG, AND NOTHING ELSE. This used to serialize the whole document on a 400ms
        // trailing debounce, said to be what kept typing smooth. It was the opposite: 400ms is
        // shorter than the pause between two sentences, so the stall landed in every one —
        // 126ms frozen on an 18k-word draft carrying 2,159 pen marks (2026-09-13). And nothing
        // read it: every reader asks the editor first and takes the parent's copy only when
        // there is none (`editorApi.current?.getMarkdown() ?? contentRef.current`, all three).
        onDirtyRef.current()
      },
    })
    // The drag-drop and paste closures above read the live instance through this ref rather
    // than a captured const, which is what makes a dropped image land reliably.
    editorRef.current = made
    made.on('transaction', redraw)
    setEditor(made)
    // ⚠️ NOT DESTROYED HERE. See the last effect in this component for why the order matters.
  }, [])


  /**
   * The Markdown source view (`editor-source.ts`), built once at the first render.
   *
   * Declared HERE, above `useRawView`, and that order is load-bearing: the hook below restores
   * the caret into this textarea from an effect, and React runs effects in declaration order.
   * A textarea built after that effect is a caret that lands at the end of the document.
   */
  const rawRef = useRef<ReturnType<typeof useRawView> | null>(null)
  const sourceHost = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<SourceView | null>(null)
  // The find strip searches the textarea directly, so it needs the element rather than the view.
  const sourceTaRef = useRef<HTMLTextAreaElement | null>(null)
  // ⚠️ KEYED ON `editor`, NOT ON NOTHING. This component returns a placeholder until the
  // instance exists, so on the very first pass there is no host to build into — and an effect
  // with an empty dependency list runs exactly then and never again. It ran, found null, and
  // the Markdown view never opened for the rest of the session. Caught by pressing the key.
  useEffect(() => {
    const host = sourceHost.current
    if (!host || sourceRef.current) return
    const made = mountSource(host, {
      onChange: (next) => { rawRef.current?.setText(next); onChangeRef.current(next) },
      onDirty: () => onDirtyRef.current(),
    })
    sourceRef.current = made
    sourceTaRef.current = made.area
  }, [editor])

  // The Markdown source view and the switch into it (`useRawView.ts`). Declared here rather
  // than with the other state because it needs the editor, and it reads it through the ref
  // the drag-drop and paste closures already use — the same reason they do.
  const rawView = useRawView(sourceRef, editorRef, onChange)
  rawRef.current = rawView
  const raw = rawView.on

  /**
   * The editor's DOM, moved into the paper.
   *
   * Built with no `element`, so Tiptap put the writing surface in a detached div; this hands
   * that div's children to the one React draws. It is what `EditorContent` did, minus the
   * portal machinery for React node views, which there are none of any more.
   */
  useEffect(() => {
    const host = hostRef.current
    // Wherever the writing surface is living right now: the detached div Tiptap made at
    // construction, or the host that has just been removed from the page. Reached through the
    // view rather than through `options.element`, which is a union of four shapes and only one
    // of them is a node.
    const from = editor?.view.dom.parentElement
    if (!editor || !host || !from || from === host) return
    // ⚠️ `raw` IS IN THE DEPENDENCIES, AND THAT IS THE WHOLE BUG. The paper is rendered only in
    // the rich view, so switching to the Markdown source REMOVES this host — the writing surface
    // goes with it, still attached, now detached from the page. Switching back builds a NEW
    // host, and an effect keyed on the editor alone never runs again: the sheet came back empty,
    // with the document intact in an editor nobody could see. `EditorContent` re-attached on
    // every mount; the hand-written replacement that took its place on 2026-09-15 did not, and
    // it shipped. Nothing was red — no unit test toggles a view, and the tour's Markdown flow
    // went one way. Found by pressing the key twice; pinned by a flow that presses it twice.
    host.append(...from.childNodes)
    editor.setOptions({ element: host })
  }, [editor, raw])
  useEffect(() => { onRawChangeRef.current?.(raw) }, [raw])

  // Find and replace, for whichever view is showing (`useEditorFind.ts`). It owns the chord.
  const find = useEditorFind({
    editor,
    raw,
    taRef: sourceTaRef,
    rawTextRef: rawView.textRef,
    onRawText: (next) => { rawView.setText(next); onChange(next) },
  })

  // The button strip, the floating bar and the "/" menu, all three plain TypeScript now
  // (`useEditorChrome.ts`). This component keeps only the CONDITIONS, which are React state.
  // The find strip highlights the source view too, and its hits are the hook's below.
  useEffect(() => { sourceRef.current?.setHits(find.rawHits, find.rawIndex) }, [find.rawHits, find.rawIndex])

  const { toolbarHost, findHost } = useEditorChrome({
    editor, t, askLink, onPickImage, onPickGallery,
    raw, focus, findOpen: find.open,
    findTarget: find.target, onFindHeight: find.onHeight,
    toolbarTop, findHeight: find.height, slash, setSlash,
  })
  useEffect(() => {
    if (!editor) return
    editorRef.current = editor // keep the drag-drop / paste closures on the live instance
    apiRef.current = {
      toggleRaw: rawView.toggle,
      // The described alt (media/alt-text.ts) wins when the library hands one over;
      // the filename-derived caption stays the fallback, as it always was.
      insertImage: (url: string, alt?: string) =>
        editor.chain().focus().setImage({ src: url, alt: alt || captionFromUrl(url) }).run(),
      // Gallery: empty alt for a clean mosaic; '#grid' groups consecutive ones.
      // One insertContent of an array keeps all images (a per-image loop would
      // leave only the last — each setImage replaces the selected prior node).
      insertGalleryMany: (urls: string[]) => {
        if (urls.length === 0) return
        const nodes = urls.map((url) => ({ type: 'image', attrs: { src: `${url}#grid`, alt: '' } }))
        editor.chain().focus().insertContent(nodes).run()
      },
      // In raw mode the textarea is the source of truth; otherwise serialize live.
      getMarkdown: () => (rawView.onRef.current ? rawView.textRef.current : readMarkdown(editor)),
      // Load a full document, leaving raw mode so the formatted view shows it.
      setMarkdown: (md: string) => {
        editor.commands.setContent(md)
        videoUrlsToNodes(editor)
        rawView.load(md)
      },
    }
  }, [editor, apiRef])

  // The parent's copy, refreshed once on the way out — the only moment it can be read.
  // `isDestroyed` is belt and braces: the effect below is declared after this one precisely so
  // that it cannot have run yet.
  useEffect(() => {
    if (!editor) return
    return () => {
      if (!rawView.onRef.current && !editor.isDestroyed) onChangeRef.current(readMarkdown(editor))
    }
  }, [editor])

  /**
   * ⚠️ DESTROYED LAST, AND THAT IS WHY IT IS AN EFFECT OF ITS OWN.
   *
   * React runs cleanups in the order the effects were declared, and the one above reads the
   * finished document out of the editor on the way out — the parent's only chance to catch a
   * last edit. Destroying in the effect that BUILDS the editor would put the teardown first
   * and lose it. The adapter hid this by destroying on a `setTimeout(…, 1)`, so every React
   * cleanup had already run; an explicit order is the same guarantee without the timer.
   */
  useEffect(() => {
    if (!editor) return
    return () => { editor.destroy() }
  }, [editor])

  if (!editor) return <div className="min-h-[480px] animate-pulse rounded-[10px] bg-neutral-100 dark:bg-neutral-900" />

  return (
    // The sheet runs at least the height of the window beside the write pane: a short
    // draft used to end the paper mid-screen while the list column kept going, which
    // the owner called ugly. The paper continues; the writing just hasn't reached it.
    <div className={`${CARD} lg:min-h-[calc(100dvh-1.5rem)]`}>
      {actions}
      {/* Under the action line and over the toolbar, sticky with them: this strip is part of
          the sheet's own top stack, not a band floating over the paper. */}
      {find.open && (
        <div className="sticky z-20" style={{ top: toolbarTop }}>
          <div ref={findHost} />
        </div>
      )}
      {/* At the very TOP of the sheet, the full width of it — the owner's verdicts, one
          sitting: on top, full-width, wrapping not scrolling, grouped in the middle, and
          GONE in the Markdown view. Sticky, so it stays reachable in a long piece. */}
      {/* Focus mode takes the row away; the bubble bar and "/" still carry every command
          it holds, which is the arrangement Medium made famous and the reason putting it
          away costs nothing. */}
      {!raw && !focus && <div ref={toolbarHost} />}
      {/* Center the writing column at the public single-post width so what you
          type wraps exactly like the published article.

          `pb-20` below `lg`: the action bar is FIXED to the bottom edge on a phone
          (2026-09-07, `EditorActions`), so without room under the paper the last line of a
          post sits behind Publish and cannot be scrolled clear of it. */}
      <div className="mx-auto w-full pb-20 lg:pb-0" style={{ maxWidth: contentWidth }}>
        {header}
        {/* ⚠️ MOUNTED ONCE AND HIDDEN, not mounted when the switch is thrown. `useRawView` carries
            the caret across that switch and has to reach the textarea from an effect declared
            ABOVE this one — a textarea that does not exist yet at that moment is a caret that
            lands at the end of the document instead of where the writer left it. Built at the
            first render, it is there whenever that effect looks. */}
        <div ref={sourceHost} hidden={!raw} />
        {!raw && (
          <div className="typewriter-stage relative">
            <div ref={hostRef} />
            {keySound.mode !== 'off' && <span ref={caretRef} className="typewriter-caret" aria-hidden="true" />}
          </div>
        )}
        {/* The mock's closing line: the two gestures this screen answers to, said once,
            quietly, where a first-time writer's eye ends up. */}
        {!raw && (
          <p className="px-4 pb-4 pt-6 text-xs text-neutral-500 dark:text-neutral-400">{t.slashHint}</p>
        )}
      </div>
    </div>
  )
}