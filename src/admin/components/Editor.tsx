// TipTap markdown editor with a compact toolbar.
// Marks/nodes: bold, italic, underline, strike, inline code, H1-H5, bullet +
// numbered + task lists, quote, code block, horizontal rule, link, image
// (align + wide + grid gallery), GFM tables, and video (paste a YouTube/Vimeo/TikTok URL).
// Drag an image file in -> auto-uploads -> inserts at the drop point. A Markdown/Review
// toggle swaps the formatted view for the raw Markdown source.
import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import { editorExtensions } from './editorExtensions'
import { Toolbar, BubbleBar } from './EditorMenus'

// The sticky toolbar's own height: one 32px control plus 8px of padding either side. The
// bubble bar must not be placed inside this band, because the toolbar is sticky and would
// cover it — the first line of a post is where that happens.
const TOOLBAR_HEIGHT = 48
import { isVideoUrl } from '@/render/video'
import { useAdminT } from './I18nProvider'
import { MarkdownSource } from './MarkdownSource'
import { CARD } from './kit'

export type EditorApi = {
  insertImage: (url: string) => void
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

// Typewriter feedback stays outside ProseMirror's document: a positioned overlay
// follows its selection while compositor-only pulses touch the current DOM block.
// No character wrappers, document mutations, or selection changes are involved.
const typingAnimations = new WeakMap<HTMLElement, Animation>()
const TYPEWRITER_VOLUME = 0.45
let typewriterAudio: AudioContext | null = null

function placeTypewriterCaret(view: TiptapEditor['view'], caret: HTMLElement | null): void {
  if (!caret) return
  requestAnimationFrame(() => {
    const stage = caret.parentElement
    const visible = view.hasFocus() && view.state.selection.empty
    if (!stage || !visible) {
      stage?.classList.remove('has-typewriter-caret')
      return
    }
    const cursor = view.coordsAtPos(view.state.selection.head)
    const stageRect = stage.getBoundingClientRect()
    caret.style.left = `${cursor.left - stageRect.left}px`
    caret.style.top = `${cursor.top - stageRect.top}px`
    caret.style.height = `${Math.max(16, cursor.bottom - cursor.top)}px`
    stage.classList.add('has-typewriter-caret')
  })
}

function playTypewriterSound(deleting: boolean): void {
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return
  typewriterAudio ??= new AudioContextClass()
  const context = typewriterAudio
  if (context.state === 'suspended') void context.resume()

  // A very short filtered-noise transient reads as a mechanical click instead
  // of a musical beep. 0.11 × 45% gives a restrained peak gain of 0.0495.
  const duration = deleting ? 0.032 : 0.024
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (samples.length * 0.18))
  }
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  source.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.value = deleting ? 620 : 1450
  filter.Q.value = deleting ? 0.7 : 1.1
  gain.gain.value = 0.11 * TYPEWRITER_VOLUME
  source.connect(filter).connect(gain).connect(context.destination)
  source.start()
}

function pulseTypewriterInput(view: TiptapEditor['view'], event: InputEvent, caret: HTMLElement | null): void {
  const inputType = event.inputType
  const deleting = inputType.startsWith('delete')
  if (!deleting && !inputType.startsWith('insert')) return
  if (!event.isComposing) playTypewriterSound(deleting)
  placeTypewriterCaret(view, caret)
  if (
    document.documentElement.dataset.motion === 'off' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) return

  requestAnimationFrame(() => {
    const anchor = view.dom.ownerDocument.getSelection()?.anchorNode
    const origin = anchor?.nodeType === 1 ? (anchor as Element) : anchor?.parentElement
    const block = origin?.closest<HTMLElement>('p, h1, h2, h3, h4, h5, li, blockquote, pre')
    if (!block || !view.dom.contains(block)) return

    if (caret) {
      caret.animate(
        deleting
          ? [
              { opacity: 0.35, transform: 'translateX(-3px) scaleX(0.65)' },
              { opacity: 1, transform: 'translateX(0) scaleX(1)' },
            ]
          : [
              { opacity: 1, transform: 'translateY(1px) scaleX(1.5)' },
              { opacity: 1, transform: 'translateY(0) scaleX(1)' },
            ],
        { duration: 140, easing: 'cubic-bezier(.2,.8,.2,1)' },
      )
    }
    typingAnimations.get(block)?.cancel()
    const animation = block.animate(
      deleting
        ? [
            { opacity: 0.86, transform: 'translateX(-0.7px)' },
            { opacity: 1, transform: 'translateX(0)' },
          ]
        : [
            { opacity: 0.9, transform: 'translateY(0.6px)', textShadow: '0 0 0.3px currentColor' },
            { opacity: 1, transform: 'translateY(0)', textShadow: '0 0 0 transparent' },
          ],
      { duration: 140, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
    typingAnimations.set(block, animation)
    animation.onfinish = () => {
      if (typingAnimations.get(block) === animation) typingAnimations.delete(block)
    }
  })
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
  typewriterEffects: boolean
}

export function Editor({ initialContent, onChange, onDirty, onPickImage, onPickGallery, onUploadFile, apiRef, contentWidth, toolbarTop = 0, typewriterEffects }: Props) {
  const t = useAdminT()
  // Markdown source view: edit the raw markdown directly (still saves live).
  const [raw, setRaw] = useState(false)
  const [rawText, setRawText] = useState('')
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
      handleDOMEvents: {
        beforeinput(view, event) {
          if (typewriterEffects && event instanceof InputEvent) pulseTypewriterInput(view, event, caretRef.current)
          return false
        },
        focus(view) {
          if (typewriterEffects) placeTypewriterCaret(view, caretRef.current)
          return false
        },
        blur() {
          caretRef.current?.parentElement?.classList.remove('has-typewriter-caret')
          return false
        },
        keyup(view) {
          if (typewriterEffects) placeTypewriterCaret(view, caretRef.current)
          return false
        },
        mouseup(view) {
          if (typewriterEffects) placeTypewriterCaret(view, caretRef.current)
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
      if (typewriterEffects) placeTypewriterCaret(editor.view, caretRef.current)
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
      insertImage: (url: string) =>
        editor.chain().focus().setImage({ src: url, alt: captionFromUrl(url) }).run(),
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

  if (!editor) return <div className="min-h-[480px] animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />

  // Review -> Markdown: snapshot the current markdown. Markdown -> Review:
  // re-parse the (possibly edited) markdown back into the formatted editor.
  function toggleRaw() {
    if (!editor) return
    if (raw) {
      editor.commands.setContent(rawText)
      videoUrlsToNodes(editor)
      onChange(rawText)
      setRaw(false)
    } else {
      setRawText(readMarkdown(editor))
      setRaw(true)
    }
  }

  return (
    <div className={CARD}>
      <Toolbar editor={editor} onPickImage={onPickImage} onPickGallery={onPickGallery} raw={raw} onToggleRaw={toggleRaw} stickyTop={toolbarTop} />
      {/* Floating menu on a text selection / link — not in raw source mode. */}
      {!raw && <BubbleBar editor={editor} avoidTop={toolbarTop + TOOLBAR_HEIGHT} />}
      {/* Center the writing column at the public single-post width so what you
          type wraps exactly like the published article. */}
      <div className="mx-auto w-full" style={{ maxWidth: contentWidth }}>
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
            {typewriterEffects && <span ref={caretRef} className="typewriter-caret" aria-hidden="true" />}
          </div>
        )}
      </div>
    </div>
  )
}