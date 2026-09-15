// Wiring the find strip to whichever view is showing.
//
// ITS OWN FILE because `Editor.tsx` is at its line ceiling and because this is the only part
// of the feature that has to know there are two views. The strip knows nothing about
// documents, the extension knows nothing about textareas, and the matching knows nothing
// about either; this is where the three meet.
//
// THE TWO VIEWS ARE NOT THE SAME PROBLEM. The writing surface is a ProseMirror document whose
// hits are positions and whose replacement is a transaction — undoable, one step, and drawn
// without editing anything. The Markdown view is a `<textarea>` holding one string, whose hits
// are offsets and whose replacement is a new value. What they share is the strip above them
// and the chord that opens it, which is the entire point: a writer presses the key without
// first having to notice which view they are in.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { findAll, firstAfter, replaceAllIn, step, type Hit } from './editorFind'
import {
  hitsIn, readFind, replaceCurrent, replaceEveryHit, revealCurrent, setFind,
} from './FindExtension'
import type { FindTarget } from './editor-find-bar'
import { matchesChord } from './editorKeys'

type RawFind = { query: string; caseSensitive: boolean; index: number; hits: Hit[] }
const NO_RAW: RawFind = { query: '', caseSensitive: false, index: 0, hits: [] }

export function useEditorFind(args: {
  editor: TiptapEditor | null
  raw: boolean
  taRef: RefObject<HTMLTextAreaElement | null>
  /** The live Markdown, which the textarea owns while the raw view is showing. */
  rawTextRef: RefObject<string>
  /** Write the Markdown back, exactly as a keystroke in the textarea would. */
  onRawText: (next: string) => void
}): {
  /** Null when the strip is away; otherwise which of the two chords opened it. */
  open: 'find' | 'replace' | null
  target: FindTarget
  height: number
  onHeight: (px: number) => void
  /** The Markdown view's hits, for its mirror to draw — the rich view draws its own. */
  rawHits: Hit[]
  rawIndex: number
} {
  const { editor, raw, taRef, rawTextRef, onRawText } = args
  const [open, setOpen] = useState<'find' | 'replace' | null>(null)
  const [rawFind, setRawFind] = useState<RawFind>(NO_RAW)
  // How far down the toolbar has to stick while the strip is open. Reported by the strip
  // itself, which is the only thing that knows how many rows it wrapped to.
  const [height, setHeight] = useState(0)
  const onHeight = useCallback((px: number) => setHeight(px), [])

  // The chord listener is registered once, so everything the close path reads goes through a
  // ref rather than through the closure it was created in.
  const live = useRef({ raw, editor, taRef })
  live.current = { raw, editor, taRef }

  const close = useCallback(() => {
    setOpen(null)
    setRawFind(NO_RAW)
    const now = live.current
    if (now.raw) now.taRef.current?.focus()
    else now.editor?.commands.focus()
    // The highlight goes with the strip. Leaving it behind would mean a piece still marked up
    // after the writer has moved on, which the next glance would read as something the editor
    // had done to the text.
    if (!now.raw && now.editor) setFind(now.editor, { query: '' })
  }, [])

  // TWO CHORDS INTO ONE STRIP. `Mod-f` is looking for something and `Mod-Shift-f` is changing
  // it, and most of the time it is the first — so the replace field is not there until it is
  // asked for, by either the second chord or the disclosure at the head of the strip.
  //
  // `Mod-f` is taken from the browser, and it is the only chord in this editor that is. The
  // trade is the one `Mod-s` made: the browser's own find cannot search the Markdown view's
  // textarea usefully, cannot replace anything, and matches the rail and the write pane
  // beside the sheet as readily as the piece. What it does better is search the whole page,
  // which is not what a writer presses it for here.
  //
  // Pressing the chord again while the strip is open does NOT close it — it refocuses and
  // selects the query, which is what every find box does and what a hand that has lost the
  // field expects. Escape is the way out, and it is the only one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const replace = matchesChord(e, 'Mod-Shift-f')
      if (!replace && !matchesChord(e, 'Mod-f')) return
      e.preventDefault()
      setOpen(replace ? 'replace' : 'find')
      // A strip already open has to answer the chord too, and the strip's own mount effect
      // has already run by then.
      const field = document.querySelector<HTMLInputElement>('[data-find-bar] input')
      if (field) { field.focus(); field.select() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Leaving the Markdown view with the strip open would leave it searching a string that is
  // no longer on screen, so the two find states are never both live.
  useEffect(() => { setRawFind(NO_RAW); if (editor) setFind(editor, { query: '' }) }, [raw, editor])

  /**
   * Select a hit in the textarea, which is that view's whole idea of "current", and put it on
   * screen.
   *
   * THE PAGE SCROLLS, not the box: `Editor.tsx` grows the textarea to its own `scrollHeight`
   * so it never scrolls internally, which is also why the Markdown view needs no scroll sync
   * for its mirror. The hit's line is counted and multiplied by the leading `admin.css` sets
   * on `.md-box` — read rather than assumed, because both boxes take their metrics from that
   * one rule and nothing here may become a second place they are written down.
   *
   * No `focus()`: that would take the caret out of the find field between two keystrokes.
   */
  const showRaw = (hits: Hit[], index: number): void => {
    const ta = taRef.current
    const hit = hits[index]
    if (!ta || !hit) return
    ta.setSelectionRange(hit.from, hit.to)
    const styles = getComputedStyle(ta)
    const leading = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.6
    const linesAbove = ta.value.slice(0, hit.from).split('\n').length - 1
    const top = ta.getBoundingClientRect().top + window.scrollY + linesAbove * leading
    // A third of the way down rather than at the very top, so the words around the hit are
    // on screen too — a match pinned under the sticky strip is a match you cannot read.
    window.scrollTo({ top: Math.max(0, top - window.innerHeight / 3), behavior: 'smooth' })
  }

  const rich = readFind(editor?.state)
  const target: FindTarget = {
    count: raw ? rawFind.hits.length : rich.hits.length,
    index: raw ? rawFind.index : rich.index,
    onClose: close,

    onQuery(query, caseSensitive) {
      if (raw) {
        const hits = findAll(rawTextRef.current ?? '', query, { caseSensitive })
        const index = firstAfter(hits, taRef.current?.selectionStart ?? 0)
        setRawFind({ query, caseSensitive, index, hits })
        showRaw(hits, index)
        return
      }
      if (!editor) return
      // The index is worked out HERE rather than left to the plugin, because "the first hit
      // after the cursor" is a question about where the writer is standing, and the plugin
      // only ever sees the document. Landing on the first hit in the piece instead is what
      // makes a find box feel like it is searching some other copy of it.
      const hits = query ? hitsIn(editor.state.doc, query, { caseSensitive }) : []
      setFind(editor, { query, caseSensitive, index: firstAfter(hits, editor.state.selection.from) })
      revealCurrent(editor)
    },

    onStep(by) {
      if (raw) {
        const index = step(rawFind.hits.length, rawFind.index, by)
        setRawFind({ ...rawFind, index })
        showRaw(rawFind.hits, index)
        return
      }
      if (!editor) return
      const found = readFind(editor.state)
      setFind(editor, { index: step(found.hits.length, found.index, by) })
      revealCurrent(editor)
    },

    onReplace(replacement) {
      if (raw) {
        const hit = rawFind.hits[rawFind.index]
        const text = rawTextRef.current ?? ''
        if (!hit) return
        onRawText(replaceAllIn(text, [hit], replacement))
        // Re-scanned rather than adjusted: the replacement can be longer or shorter than what
        // it replaced, so every hit after it has moved. The index is KEPT, so the hit that
        // was next has come down into it — pressing Replace twice replaces two, which an
        // advancing index would turn into replacing every other one.
        const next = findAll(replaceAllIn(text, [hit], replacement), rawFind.query, { caseSensitive: rawFind.caseSensitive })
        const index = Math.min(rawFind.index, Math.max(0, next.length - 1))
        setRawFind({ ...rawFind, hits: next, index })
        return
      }
      if (editor) replaceCurrent(editor, replacement)
    },

    onReplaceAll(replacement) {
      if (raw) {
        const text = rawTextRef.current ?? ''
        onRawText(replaceAllIn(text, rawFind.hits, replacement))
        setRawFind({ ...rawFind, hits: [], index: 0 })
        return
      }
      if (editor) replaceEveryHit(editor, replacement)
    },
  }

  return { open, target, height: open ? height : 0, onHeight, rawHits: rawFind.hits, rawIndex: rawFind.index }
}
