// TipTap markdown editor with a compact toolbar.
// Marks/nodes: bold, italic, underline, strike, inline code, H1-H5, bullet +
// numbered + task lists, quote, code block, horizontal rule, link, image
// (align + wide + grid gallery), GFM tables, and video (paste a YouTube/Vimeo/TikTok URL).
// Drag an image file in -> auto-uploads -> inserts at the drop point. A Markdown/Review
// toggle swaps the formatted view for the raw Markdown source.
import type { KeySound } from './key-sound'
import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import { editorExtensions } from './editorExtensions'
import { BubbleBar, SlashMenu, Toolbar } from './EditorMenus'
import { useFocusMode } from './useFocusMode'
import { placeCaret, pulseInput } from './key-feedback'

// The sticky band above the writing: the action line (~56px) plus the toolbar strip that
// sticks under it (~60px with its margins). The bubble bar must not be placed inside this
// band, because both are sticky and would cover it — the first line is where that happens.
const ACTIONBAR_HEIGHT = 116
import { isVideoUrl } from '@/render/video'
import { useAdminT } from './I18nProvider'
import { MarkdownSource } from './MarkdownSource'
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

// tiptap-markdown augments storage at runtime but ships no type for it.
type MarkdownStorage = { markdown: { getMarkdown: () => string } }
function readMarkdown(editor: TiptapEditor): string {
  return (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown()
}

// Default caption from a media URL: the file name without its upload-timestamp
// prefix or extension (e.g. ".../1781-my-photo.jpg" -> "my-photo").
function captionFromUrl(url: string): string {
  const base = decodeURIComponent(url.split('/').pop() ?? '').replace(/[#?].*$/, '')
  return base.replace(/^\d+-/, '').replace(/\.[a-z0-9]+$/i, '')
}

// After loading/parsing markdown, promote any paragraph that is just a video URL
// into a video node, so reloaded posts show the embed (not a bare link).
function videoUrlsToNodes(editor: TiptapEditor): void {
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
  // Markdown source view: edit the raw markdown directly (still saves live).
  const [raw, setRaw] = useState(false)
  // Read straight from the shared switch rather than as a prop: the two forms above this
  // one have no interest in it, and a prop threaded through a component that does not care
  // is how the next person ends up with two of them.
  const [focus] = useFocusMode()
  const [rawText, setRawText] = useState('')
  // Where the "/" menu is open, in viewport coordinates — null when it is not.
  const [slash, setSlash] = useState<{ left: number; top: number } | null>(null)
  const slashRef = useRef(slash)
  useEffect(() => { slashRef.current = slash }, [slash])
  // Refs so getMarkdown / the debounce read live values without re-subscribing.
  const onChangeRef = useRef(onChange)
  const onDirtyRef = useRef(onDirty)
  const rawRef = useRef(raw)
  const rawTextRef = useRef(rawText)
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const caretRef = useRef<HTMLSpanElement>(null)
  // The editorProps closures below are created once (on the first useEditor call,
  // when `editor` is still null). Reading the live instance through a ref instead
  // of the captured `editor` const is what makes drag-drop insert reliably —
  // otherwise the dropped image only appeared when the stale closure happened to
  // hold a non-null editor ("lúc ăn lúc không").
  const editorRef = useRef<TiptapEditor | null>(null)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onDirtyRef.current = onDirty }, [onDirty])
  useEffect(() => { rawRef.current = raw }, [raw])
  useEffect(() => { rawTextRef.current = rawText }, [rawText])
  // Report raw-view flips from the STATE, not from inside toggleRaw: the toggle is called
  // through `apiRef` where a captured prop would go stale, and the state is the truth.
  const onRawChangeRef = useRef(onRawChange)
  useEffect(() => { onRawChangeRef.current = onRawChange }, [onRawChange])
  useEffect(() => { onRawChangeRef.current?.(raw) }, [raw])

  const editor = useEditor({
    immediatelyRender: false,
    // Re-render the React tree on every transaction so the toolbar's isActive()
    // states stay live — TipTap 3 disables this by default, which left the
    // active highlights stale and the contextual table-tools row never showing.
    shouldRerenderOnTransaction: true,
    extensions: editorExtensions(t.editorPlaceholder),
    content: initialContent,
    editorProps: {
      attributes: { class: 'prose max-w-none min-h-[420px] px-4 py-4' },
      // "/" on an empty line CALLS the insert menu rather than typing a character (the
      // Writing Desk mock's gesture). Anywhere else "/" is just a slash — dates, paths and
      // fractions keep working.
      //
      // `handleTextInput`, not `handleKeyDown`: the text hook sees every way a "/" can
      // arrive — a keypress, an IME commit, an `insertText` — where the key hook sees only
      // the first, and it hands over the exact insert position instead of leaving it to be
      // re-read from a selection that may not have synced yet.
      handleTextInput(view, from, _to, text) {
        if (text !== '/') return false
        const { $from, empty } = view.state.selection
        if (!empty || $from.parent.type.name !== 'paragraph' || $from.parent.content.size !== 0) return false
        const caret = view.coordsAtPos(from)
        setSlash({ left: caret.left, top: caret.top })
        return true
      },
      // Escape closes the menu before it does anything else.
      handleKeyDown(_view, event) {
        if (event.key === 'Escape' && slashRef.current) {
          setSlash(null)
          return true
        }
        return false
      },
      handleDOMEvents: {
        beforeinput(view, event) {
          if (event instanceof InputEvent) pulseInput(view, event, caretRef.current, keySound)
          return false
        },
        focus(view) {
          if (keySound.mode !== 'off') placeCaret(view, caretRef.current)
          return false
        },
        blur() {
          caretRef.current?.parentElement?.classList.remove('has-typewriter-caret')
          return false
        },
        keyup(view) {
          if (keySound.mode !== 'off') placeCaret(view, caretRef.current)
          return false
        },
        mouseup(view) {
          if (keySound.mode !== 'off') placeCaret(view, caretRef.current)
          return false
        },
      },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))
        if (files.length === 0) return false
        event.preventDefault()
        // Capture WHERE the image was dropped now — uploads are async, so by the
        // time they resolve the text cursor has wandered (the image used to land
        // at the stale cursor, i.e. the end of the post). Insert at the drop point.
        let pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        // Upload sequentially so multiple dropped images insert in order.
        ;(async () => {
          for (const file of files) {
            const url = await onUploadFile(file)
            const ed = editorRef.current
            if (!url || !ed) continue
            const alt = file.name.replace(/\.[a-z0-9]+$/i, '')
            const chain = pos == null ? ed.chain().focus() : ed.chain().focus(pos)
            chain.setImage({ src: url, alt }).run()
            // Advance past the just-inserted image so the next one lands after it.
            pos = ed.state.selection.to
          }
        })()
        return true
      },
      // Paste a lone video URL (YouTube/Vimeo/TikTok) -> insert a video embed.
      handlePaste(_view, event) {
        const text = event.clipboardData?.getData('text/plain')?.trim() ?? ''
        if (text && !/\s/.test(text) && isVideoUrl(text)) {
          editorRef.current?.chain().focus().setVideo(text).run()
          return true
        }
        return false
      },
    },
    onCreate({ editor }) {
      videoUrlsToNodes(editor)
    },
    onSelectionUpdate({ editor }) {
      if (keySound.mode !== 'off') placeCaret(editor.view, caretRef.current)
    },
    onUpdate({ editor }) {
      // Per-keystroke work is kept tiny: flag dirty now, serialize the whole
      // document to Markdown on a trailing debounce so typing never stutters.
      onDirtyRef.current()
      if (flushTimer.current) clearTimeout(flushTimer.current)
      flushTimer.current = setTimeout(() => onChangeRef.current(readMarkdown(editor)), 400)
    },
  })

  const taRef = useRef<HTMLTextAreaElement>(null)
  // Grow the Markdown source box to fit its content (no tiny inner scrollbox).
  useEffect(() => {
    const ta = taRef.current
    if (raw && ta) {
      ta.style.height = 'auto'
      ta.style.height = `${ta.scrollHeight}px`
    }
  }, [raw, rawText])

  useEffect(() => {
    if (!editor) return
    editorRef.current = editor // keep the drag-drop / paste closures on the live instance
    apiRef.current = {
      toggleRaw,
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
      getMarkdown: () => (rawRef.current ? rawTextRef.current : readMarkdown(editor)),
      // Load a full document, leaving raw mode so the formatted view shows it.
      setMarkdown: (md: string) => {
        editor.commands.setContent(md)
        videoUrlsToNodes(editor)
        setRawText(md)
        setRaw(false)
      },
    }
  }, [editor, apiRef])

  // Drop any pending debounce when the editor unmounts.
  useEffect(() => () => { if (flushTimer.current) clearTimeout(flushTimer.current) }, [])

  if (!editor) return <div className="min-h-[480px] animate-pulse rounded-[10px] bg-neutral-100 dark:bg-neutral-900" />

  // Review -> Markdown: snapshot the current markdown. Markdown -> Review:
  // re-parse the (possibly edited) markdown back into the formatted editor.
  // Reads through the REFS so repeated toggles never hand the editor a stale snapshot.
  function toggleRaw() {
    if (!editor) return
    if (rawRef.current) {
      const text = rawTextRef.current
      editor.commands.setContent(text)
      videoUrlsToNodes(editor)
      onChangeRef.current(text)
      setRaw(false)
    } else {
      setRawText(readMarkdown(editor))
      setRaw(true)
    }
  }

  return (
    // The sheet runs at least the height of the window beside the write pane: a short
    // draft used to end the paper mid-screen while the list column kept going, which
    // the owner called ugly. The paper continues; the writing just hasn't reached it.
    <div className={`${CARD} lg:min-h-[calc(100vh-1.5rem)]`}>
      {actions}
      {/* Floating menu on a text selection / link — not in raw source mode. */}
      {!raw && <BubbleBar editor={editor} avoidTop={toolbarTop + ACTIONBAR_HEIGHT} />}
      {!raw && slash && (
        <SlashMenu
          editor={editor}
          at={slash}
          onClose={() => setSlash(null)}
          onPickImage={() => { setSlash(null); onPickImage() }}
          onPickGallery={() => { setSlash(null); onPickGallery() }}
        />
      )}
      {/* At the very TOP of the sheet, the full width of it — the owner's verdicts, one
          sitting: on top, full-width, wrapping not scrolling, grouped in the middle, and
          GONE in the Markdown view. Sticky, so it stays reachable in a long piece. */}
      {/* Focus mode takes the row away; the bubble bar and "/" still carry every command
          it holds, which is the arrangement Medium made famous and the reason putting it
          away costs nothing. */}
      {!raw && !focus && <Toolbar editor={editor} onPickImage={onPickImage} onPickGallery={onPickGallery} stickyTop={toolbarTop} />}
      {/* Center the writing column at the public single-post width so what you
          type wraps exactly like the published article. */}
      <div className="mx-auto w-full" style={{ maxWidth: contentWidth }}>
        {header}
        {raw ? (
          <MarkdownSource
            taRef={taRef}
            value={rawText}
            onDirty={onDirty}
            onChange={(next) => {
              setRawText(next)
              onChange(next)
            }}
          />
        ) : (
          <div className="typewriter-stage relative">
            <EditorContent editor={editor} />
            {keySound.mode !== 'off' && <span ref={caretRef} className="typewriter-caret" aria-hidden="true" />}
          </div>
        )}
        {/* The mock's closing line: the two gestures this screen answers to, said once,
            quietly, where a first-time writer's eye ends up. */}
        {!raw && (
          <p className="px-4 pb-4 pt-6 text-xs text-neutral-400 dark:text-neutral-500">{t.slashHint}</p>
        )}
      </div>
    </div>
  )
}