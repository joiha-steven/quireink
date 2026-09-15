// THE EDITOR'S FURNITURE, MOUNTED AND TAKEN DOWN.
//
// Three pieces of chrome that are no longer React's — the button strip, the floating bar on a
// selection, and the "/" menu at the caret — and one hook that decides when each is on screen.
// ADR 0054 keeps the editor a client-side APPLICATION rather than a page, so its furniture is
// built in TypeScript; what is still React's is the CONDITION, because the raw view, focus mode
// and the find strip are still React state.
//
// A seam with a life expectancy: when the sheet around the paper converts, this hook and the
// component that calls it both go, and the same three mounts move into the island.
import { useEffect, useRef } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { mountToolbar, toolbarWords, type Toolbar } from './editor-toolbar'
import { mountBubbleBar, openSlashMenu, type BubbleBar } from './editor-menus'

// The sticky band above the writing: the action line (~56px) plus the toolbar strip that sticks
// under it (~60px with its margins). The bubble bar must not be placed inside this band, because
// both are sticky and would cover it — the first line is where that happens.
const ACTIONBAR_HEIGHT = 116

export type ChromeState = {
  editor: TiptapEditor | null
  t: AdminStrings
  askLink: (previous: string) => Promise<string | null>
  onPickImage: () => void
  onPickGallery: () => void
  /** The Markdown source view is showing, so none of this belongs on screen. */
  raw: boolean
  /** Focus mode takes the button strip away; "/" and the bubble still carry every command. */
  focus: boolean
  findOpen: boolean
  toolbarTop: number
  findHeight: number
  slash: { left: number; top: number } | null
  setSlash: (at: { left: number; top: number } | null) => void
}

/** Returns where to draw the button strip. The other two position themselves. */
export function useEditorChrome(state: ChromeState): React.RefObject<HTMLDivElement | null> {
  const {
    editor, t, askLink, onPickImage, onPickGallery,
    raw, focus, findOpen, toolbarTop, findHeight, slash, setSlash,
  } = state

  /**
   * THE BAR IS PLAIN TYPESCRIPT (`editor-toolbar.ts`), mounted into a div React owns.
   *
   * It was a React component asking twenty-one `isActive` questions per render, and the editor
   * was told to re-render on every transaction so those answers stayed live — so every keystroke
   * rebuilt the tree of the whole sheet to decide whether Bold looks pressed. It subscribes to
   * the editor itself now and writes twenty-one attributes.
   *
   * Mounted and unmounted rather than hidden, because that is what the conditional above did:
   * the bar is sticky and takes space, and the Markdown view and focus mode both want it gone
   * rather than invisible.
   */
  const toolbarHost = useRef<HTMLDivElement>(null)
  const barRef = useRef<Toolbar | null>(null)
  const showBar = !raw && !focus
  useEffect(() => {
    const host = toolbarHost.current
    if (!editor || !host || !showBar) return
    const bar = mountToolbar(host, {
      editor,
      askLink,
      onPickImage,
      onPickGallery,
      words: toolbarWords(t),
    })
    barRef.current = bar
    return () => { bar.destroy(); barRef.current = null }
  }, [editor, showBar])

  // The sticky band above the bar is measured at runtime and moves when the find strip opens,
  // so the offset arrives after the mount and is pushed in rather than re-mounting the bar.
  useEffect(() => { barRef.current?.setTop(toolbarTop + findHeight) }, [toolbarTop, findHeight, showBar, editor])

  /**
   * The floating bar on a selection, and the "/" menu at the caret (`editor-menus.ts`).
   *
   * Neither is in the sheet's markup, because neither belongs to it: the bubble bar is positioned
   * by a ProseMirror plugin, and the "/" menu is `position: fixed` at coordinates the editor
   * measured when the key was pressed.
   *
   * ⚠️ NO BUBBLE WHILE THE FIND STRIP IS OPEN. The strip SELECTS each hit as it steps onto it, so
   * without this the formatting bubble rose over every match and covered the line above the very
   * word the writer had gone looking for. While the strip is open the selection is the find's
   * rather than the writer's, and the bubble has nothing to offer about it.
   */
  const bubbleRef = useRef<BubbleBar | null>(null)
  const showBubble = !raw && !findOpen
  useEffect(() => {
    if (!editor || !showBubble) return
    const made = mountBubbleBar(editor, t, askLink)
    bubbleRef.current = made
    return () => { made.destroy(); bubbleRef.current = null }
  }, [editor, showBubble])
  useEffect(() => {
    bubbleRef.current?.setAvoidTop(toolbarTop + ACTIONBAR_HEIGHT)
  }, [toolbarTop, showBubble, editor])

  useEffect(() => {
    if (!editor || raw || !slash) return
    return openSlashMenu({
      editor,
      t,
      at: slash,
      onClose: () => setSlash(null),
      onPickImage: () => { setSlash(null); onPickImage() },
      onPickGallery: () => { setSlash(null); onPickGallery() },
    })
  }, [editor, raw, slash])

  return toolbarHost
}
