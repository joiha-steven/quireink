// FIND AND REPLACE, wired to whichever view is showing.
//
// THE TWO VIEWS ARE NOT THE SAME PROBLEM. The writing surface is a ProseMirror document whose
// hits are positions and whose replacement is a transaction — undoable, one step, and drawn
// without editing anything. The Markdown view is a `<textarea>` holding one string, whose hits
// are offsets and whose replacement is a new value. What they share is the strip above them and
// the chord that opens it, which is the entire point: a writer presses the key without first
// having to notice which view they are in.
//
// The strip knows nothing about documents, the extension knows nothing about textareas, and the
// matching knows nothing about either; this is where the three meet.
import type { Editor } from '@/admin/editor/editor'
import type { SheetWords } from '@/admin-shared/sheet-wire'
import { findAll, firstAfter, replaceAllIn, step, type Hit } from '@/admin/components/editorFind'
import {
  hitsIn, readFind, replaceCurrent, replaceEveryHit, revealCurrent, setFind,
} from '@/admin/components/FindExtension'
import { mountFindBar, type FindBar } from '@/admin/components/editor-find-bar'
import { matchesChord } from '@/admin/components/editorKeys'
import { say } from './media-bridge'

type RawFind = { query: string; caseSensitive: boolean; index: number; hits: Hit[] }
const NO_RAW: RawFind = { query: '', caseSensitive: false, index: 0, hits: [] }

export type FindContext = {
  t: SheetWords
  editor: Editor
  /** The Markdown view's textarea, which owns the text while that view is showing. */
  area: HTMLTextAreaElement
  raw: () => boolean
  rawText: () => string
  /** Write the Markdown back, exactly as a keystroke in the textarea would. */
  onRawText: (next: string) => void
  /** The source view's mirror draws its own highlights from these. */
  onRawHits: (hits: Hit[], current: number) => void
  /** Open or shut, so the sheet can stand the bubble bar down and re-stick the toolbar. */
  onOpen: (open: 'find' | 'replace' | null) => void
  /** How tall the strip is, so the toolbar under it sticks BELOW rather than behind. */
  onHeight: (px: number) => void
}

export type Finder = {
  readonly open: boolean
  /** The view flipped: whatever was being searched is not on screen any more. */
  reset: () => void
  destroy: () => void
}

export function wireFind(host: HTMLElement, ctx: FindContext): Finder {
  const { editor } = ctx
  let open: 'find' | 'replace' | null = null
  let bar: FindBar | null = null
  let rawFind: RawFind = NO_RAW

  /** What the strip prints beside the arrows, from whichever view is being searched. */
  const counts = (): void => {
    if (!bar) return
    if (ctx.raw()) bar.setCount(rawFind.hits.length, rawFind.index)
    else {
      const found = readFind(editor.state)
      bar.setCount(found.hits.length, found.index)
    }
  }

  /**
   * Select a hit in the textarea, which is that view's whole idea of "current", and put it on
   * screen.
   *
   * THE PAGE SCROLLS, not the box: the textarea is grown to its own `scrollHeight` so it never
   * scrolls internally, which is also why the Markdown view needs no scroll sync for its
   * mirror. The hit's line is counted and multiplied by the leading `admin.css` sets on
   * `.md-box` — read rather than assumed, because both boxes take their metrics from that one
   * rule and nothing here may become a second place they are written down.
   *
   * No `focus()`: that would take the caret out of the find field between two keystrokes.
   */
  const showRaw = (hits: Hit[], index: number): void => {
    const ta = ctx.area
    const hit = hits[index]
    ctx.onRawHits(hits, index)
    if (!hit) return
    ta.setSelectionRange(hit.from, hit.to)
    const styles = getComputedStyle(ta)
    const leading = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.6
    const linesAbove = ta.value.slice(0, hit.from).split('\n').length - 1
    const top = ta.getBoundingClientRect().top + window.scrollY + linesAbove * leading
    // A third of the way down rather than at the very top, so the words around the hit are on
    // screen too — a match pinned under the sticky strip is a match you cannot read.
    window.scrollTo({ top: Math.max(0, top - window.innerHeight / 3), behavior: 'smooth' })
  }

  const clearRaw = (): void => {
    rawFind = NO_RAW
    ctx.onRawHits([], 0)
  }

  const shut = (): void => {
    if (!open) return
    open = null
    bar?.destroy()
    bar = null
    clearRaw()
    // The highlight goes with the strip. Leaving it behind would mean a piece still marked up
    // after the writer has moved on, which the next glance would read as something the editor
    // had done to the text.
    setFind(editor, { query: '' })
    ctx.onOpen(null)
    ctx.onHeight(0)
    if (ctx.raw()) ctx.area.focus()
    else editor.commands.focus()
  }

  const show = (which: 'find' | 'replace'): void => {
    if (!bar) {
      open = which
      ctx.onOpen(which)
      bar = mountFindBar(host, {
        t: ctx.t,
        withReplace: which === 'replace',
        onHeight: ctx.onHeight,
        target: {
          onClose: shut,

          onQuery(query, caseSensitive) {
            if (ctx.raw()) {
              const hits = findAll(ctx.rawText(), query, { caseSensitive })
              const index = firstAfter(hits, ctx.area.selectionStart)
              rawFind = { query, caseSensitive, index, hits }
              showRaw(hits, index)
              counts()
              return
            }
            // The index is worked out HERE rather than left to the plugin, because "the first
            // hit after the cursor" is a question about where the writer is standing, and the
            // plugin only ever sees the document. Landing on the first hit in the piece instead
            // is what makes a find box feel like it is searching some other copy of it.
            const hits = query ? hitsIn(editor.state.doc, query, { caseSensitive }) : []
            setFind(editor, {
              query, caseSensitive, index: firstAfter(hits, editor.state.selection.from),
            })
            revealCurrent(editor)
            counts()
          },

          onStep(by) {
            if (ctx.raw()) {
              const index = step(rawFind.hits.length, rawFind.index, by)
              rawFind = { ...rawFind, index }
              showRaw(rawFind.hits, index)
              counts()
              return
            }
            const found = readFind(editor.state)
            setFind(editor, { index: step(found.hits.length, found.index, by) })
            revealCurrent(editor)
            counts()
          },

          onReplace(replacement) {
            if (!ctx.raw()) { replaceCurrent(editor, replacement); counts(); return }
            const hit = rawFind.hits[rawFind.index]
            const was = ctx.rawText()
            if (!hit) return
            const next = replaceAllIn(was, [hit], replacement)
            ctx.onRawText(next)
            // Re-scanned rather than adjusted: the replacement can be longer or shorter than
            // what it replaced, so every hit after it has moved. The index is KEPT, so the hit
            // that was next has come down into it — pressing Replace twice replaces two, which
            // an advancing index would turn into replacing every other one.
            const hits = findAll(next, rawFind.query, { caseSensitive: rawFind.caseSensitive })
            rawFind = { ...rawFind, hits, index: Math.min(rawFind.index, Math.max(0, hits.length - 1)) }
            ctx.onRawHits(hits, rawFind.index)
            counts()
          },

          /**
           * ⚠️ IT SAYS HOW MANY, because nothing else on the screen does. Replace All changes a
           * document that is mostly off screen — the writer sees the two or three hits in view
           * change and has no way to tell whether it touched three or ninety. The sentence
           * existed in eleven languages and had no caller from ADR 0054 until 2026-09-15.
           *
           * Counted BEFORE the replacement, because afterwards there is nothing left to count.
           */
          onReplaceAll(replacement) {
            const n = ctx.raw() ? rawFind.hits.length : readFind(editor.state).hits.length
            if (!ctx.raw()) replaceEveryHit(editor, replacement)
            else { ctx.onRawText(replaceAllIn(ctx.rawText(), rawFind.hits, replacement)); clearRaw() }
            counts()
            if (n > 0) say(ctx.t.findReplacedN.replace('{n}', String(n)))
          },
        },
      })
    }
    // A strip already open has to answer the chord too: pressing it again does NOT close the
    // strip, it refocuses and selects the query, which is what every find box does and what a
    // hand that has lost the field expects. Escape is the way out, and it is the only one.
    const field = host.querySelector<HTMLInputElement>('input')
    if (field) { field.focus(); field.select() }
  }

  /**
   * TWO CHORDS INTO ONE STRIP. `Mod-f` is looking for something and `Mod-Shift-f` is changing
   * it, and most of the time it is the first — so the replace field is not there until it is
   * asked for, by either the second chord or the disclosure at the head of the strip.
   *
   * `Mod-f` is taken from the browser, and it is the only chord in this editor that is. The
   * trade is the one `Mod-s` made: the browser's own find cannot search the Markdown view's
   * textarea usefully, cannot replace anything, and matches the rail and the write pane beside
   * the sheet as readily as the piece.
   */
  const onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return
    const replace = matchesChord(e, 'Mod-Shift-f')
    if (!replace && !matchesChord(e, 'Mod-f')) return
    e.preventDefault()
    show(replace ? 'replace' : 'find')
  }
  window.addEventListener('keydown', onKey)

  // The counts go stale the moment the document under them changes, and the strip is open
  // across whole sentences of typing.
  const onTransaction = (): void => { if (open && !ctx.raw()) counts() }
  editor.on('transaction', onTransaction)

  return {
    get open() { return open !== null },
    // Leaving one view with the strip open would leave it searching a string that is no longer
    // on screen, so the two find states are never both live.
    reset: () => {
      clearRaw()
      setFind(editor, { query: '' })
      counts()
    },
    destroy: () => {
      window.removeEventListener('keydown', onKey)
      editor.off('transaction', onTransaction)
      bar?.destroy()
      bar = null
    },
  }
}
