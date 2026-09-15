// WHAT THE WRITING SURFACE DOES WITH A POINTER, A KEY, A DROP AND A PASTE.
//
// Its own file because it is the half of the editor that answers the HAND, and because
// `Editor.tsx` reached the 400-line cap the day the React adapter left it. Everything here is
// a ProseMirror `editorProps` handler: it runs inside the view, sees raw DOM events, and knows
// nothing about React.
//
// ⚠️ EVERY DEPENDENCY ARRIVES AS A REF OR A SETTER, never as a captured value. These closures
// are built ONCE, when the editor is constructed and before the instance exists; reading the
// live editor through `editorRef` instead of a captured const is what makes a dropped image
// land reliably, rather than only when the stale closure happened to hold a non-null editor.
//
// A `Holder` and not `React.RefObject`: the shape is the same one-property box, and naming
// React here would be the last thing in this file that knows the caller's framework.
import type { EditorProps } from 'prosemirror-view'
import type { Editor as TiptapEditor } from '@/admin/editor/editor'
import type { KeySound } from './key-sound'
import { placeCaret, pulseInput } from './key-feedback'
import { isVideoUrl } from '@/render/video'

/** A box with one slot in it, read at call time rather than captured at build time. */
export type Holder<T> = { current: T }

export type SurfaceHooks = {
  keySound: KeySound
  caretRef: Holder<HTMLSpanElement | null>
  /** Where the "/" menu is open, read inside a handler registered once. */
  slashRef: Holder<{ left: number; top: number } | null>
  setSlash: (at: { left: number; top: number } | null) => void
  editorRef: Holder<TiptapEditor | null>
  /** Upload and insert, in order, from wherever they came. */
  insertImages: (files: File[], at: number | undefined) => Promise<void>
  /** The image files out of a DataTransfer, from a drop or from the clipboard. */
  imageFiles: (list: FileList | null | undefined) => File[]
}

export function writingSurface(
  { keySound, caretRef, slashRef, setSlash, editorRef, insertImages, imageFiles }: SurfaceHooks,
): EditorProps {
  return {
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
        const files = imageFiles(event.dataTransfer?.files)
        if (files.length === 0) return false
        event.preventDefault()
        // Capture WHERE the image was dropped now — uploads are async, so by the
        // time they resolve the text cursor has wandered (the image used to land
        // at the stale cursor, i.e. the end of the post). Insert at the drop point.
        void insertImages(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos)
        return true
      },
      handlePaste(_view, event) {
        // AN IMAGE ON THE CLIPBOARD. Until 2026-08-28 this did nothing at all: the handler
        // read `text/plain`, found no URL, and handed back to ProseMirror — which has no
        // parse rule for a file, so a pasted screenshot vanished without a message. Taking
        // a screenshot and pressing paste is how most people put a picture in a post, and
        // the product answered it with silence. Same upload path as a drop, so alt text,
        // ordering and the caption default are the ones the rest of the editor already uses.
        const pasted = imageFiles(event.clipboardData?.files)
        if (pasted.length > 0) {
          event.preventDefault()
          // No coordinates on a paste: it goes where the cursor is, which is where the
          // person is looking. `undefined` means "wherever the selection is now".
          void insertImages(pasted, undefined)
          return true
        }
        // Paste a lone video URL (YouTube/Vimeo/TikTok) -> insert a video embed.
        const text = event.clipboardData?.getData('text/plain')?.trim() ?? ''
        if (text && !/\s/.test(text) && isVideoUrl(text)) {
          editorRef.current?.chain().focus().setVideo(text).run()
          return true
        }
        return false
      },
  }
}
