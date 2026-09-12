// The two menus that open AT THE WRITING rather than standing over it:
//  - SlashMenu: the inserts, opened at the caret by typing "/" on an empty line.
//  - BubbleBar: a floating menu on a text selection or with the cursor inside a link.
// The fixed button strip is next door in `EditorToolbar.tsx`, which is where this file's
// first half went when it reached the size cap.
// Both need the editor to re-render on selection change; Editor.tsx enables
// `shouldRerenderOnTransaction` so isActive() stays live (off by default in TipTap 3).
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { type Editor as TiptapEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { NodeSelection, type EditorState } from '@tiptap/pm/state'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { useAdminT } from './I18nProvider'
import { editLink, useLinkAsker } from './editorLink'
import { DEFAULT_INK, INKS } from '@/pen/grammar'
import { PEN_LIGHT } from '@/pen/pigments'
import { tip } from './editorKeys'

function Row({ label, hint, active = false, onClick }: { label: string; hint?: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active || undefined}
      data-slash-row
      className={`flex w-full items-baseline justify-between gap-4 rounded-md px-3 py-1.5 text-left text-sm ${
        active ? 'bg-neutral-200 text-neutral-950 dark:bg-neutral-700 dark:text-white' : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700'
      }`}
    >
      <span>{label}</span>
      {hint && <span className="shrink-0 font-mono text-xs text-neutral-500 dark:text-neutral-400">{hint}</span>}
    </button>
  )
}

/**
 * The "/" menu: everything that puts something NEW on the page, opened at the caret by
 * typing "/" on an empty line (the Writing Desk mock's gesture — kept alongside the
 * toolbar; two doors, same rooms). Each block's Markdown shortcut is printed beside its
 * row, so the menu teaches the gesture that makes itself unnecessary.
 *
 * `onMouseDown` is prevented THROUGHOUT: a mousedown in here would blur the editor and move
 * the caret before the command ran — the same trap the bubble bar documents.
 */
export function SlashMenu({
  editor,
  at,
  onClose,
  onPickImage,
  onPickGallery,
}: {
  editor: TiptapEditor
  /** Viewport coordinates of the caret the "/" was typed at. */
  at: { left: number; top: number }
  onClose: () => void
  onPickImage: () => void
  onPickGallery: () => void
}) {
  const t = useAdminT()
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) onClose() }
    // One scroll closes it: the menu is pinned to where the caret WAS, and a menu that
    // stays behind while the page moves reads as broken.
    const scroll = () => onClose()
    document.addEventListener('mousedown', away)
    document.addEventListener('scroll', scroll, true)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('scroll', scroll, true) }
  }, [onClose])
  const run = (fn: () => void) => { onClose(); fn() }
  // Keep the menu on screen when "/" is typed near the bottom edge.
  const style = {
    left: Math.min(at.left, window.innerWidth - 280),
    top: Math.min(at.top + 24, window.innerHeight - 380),
  }
  return (
    <div
      ref={box}
      role="menu"
      aria-label={t.tbInsert}
      onMouseDown={(e) => e.preventDefault()}
      className="scroll-fade fixed z-40 max-h-[360px] w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
      style={style}
    >
      <Row label={t.tbImage} onClick={() => run(onPickImage)} />
      <Row label={t.tbGallery} onClick={() => run(onPickGallery)} />
      <Row label={t.tbTable} onClick={() => run(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())} />
      <Row label={tip(t.tbCodeBlock, 'codeBlock')} hint="```" onClick={() => run(() => editor.chain().focus().toggleCodeBlock().run())} />
      <Row label={t.tbMath} onClick={() => run(() => editor.chain().focus().setMath(true).run())} />
      <Row label={t.tbMathInline} onClick={() => run(() => editor.chain().focus().setMath(false).run())} />
      <Row label={t.tbDivider} hint="---" onClick={() => run(() => editor.chain().focus().setHorizontalRule().run())} />
      <span className="my-1 block h-px w-full bg-neutral-100 dark:bg-neutral-700" aria-hidden />
      <Row label={tip(t.tbQuote, 'blockquote')} hint=">" onClick={() => run(() => editor.chain().focus().toggleBlockquote().run())} />
      <Row label={tip(t.tbList, 'bulletList')} hint="-" onClick={() => run(() => editor.chain().focus().toggleBulletList().run())} />
      <Row label={tip(t.tbListNumbered, 'orderedList')} hint="1." onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())} />
      <Row label={tip(t.tbTask, 'taskList')} hint="[ ]" onClick={() => run(() => editor.chain().focus().toggleTaskList().run())} />
      {([2, 3] as const).map((level) => (
        <Row key={level} label={`${t.tbHeading} ${level}`} hint={'#'.repeat(level)} onClick={() => run(() => editor.chain().focus().toggleHeading({ level }).run())} />
      ))}
    </div>
  )
}

// The five pens, as five swatches rather than one button behind a dropdown.
//
// A dropdown would be one glyph instead of five, and it would be the wrong trade: choosing
// the ink IS the gesture here, the way choosing bold is not. The swatches carry the real
// pigments, so the bar shows you the pen you are about to pick up rather than a word for it.
//
// READ from `pen/pigments.ts`, not typed out. All five were written out here a second time,
// and a swatch that is a near-miss of the ink it applies is the worst kind of wrong: it
// looks deliberate. The `#` is added here because CSS wants it and the stroke wants the
// bare hex.
//
// Clicking the ink already on the selection lifts the pen; clicking a different one
// recolours in place instead of clearing and re-marking — see `toggleInk`.
const PEN: Record<string, string> = Object.fromEntries(
  Object.entries(PEN_LIGHT).map(([ink, hex]) => [ink, `#${hex}`]),
)

/** `yellow` -> the owner's word for yellow. Same lookup `InkFields` uses on the settings screen. */
function inkName(t: AdminStrings, ink: string): string {
  return t[`ink${ink[0]!.toUpperCase()}${ink.slice(1)}` as 'inkYellow']
}

function InkButtons({ editor, hold }: { editor: TiptapEditor; hold: (e: React.MouseEvent) => void }) {
  const t = useAdminT()
  const current = editor.isActive('ink') ? (editor.getAttributes('ink').ink as string) : ''
  return (
    <>
      {INKS.map((ink) => (
        <button
          key={ink}
          type="button"
          // NAMED, and each one differently. All five carried `t.tbHighlight` and nothing
          // else: no text, no `aria-label`, five buttons with one identical name, told apart
          // only by an inline background on the span inside. Anything not looking at colour
          // -- a screen reader, and anyone who cannot separate those five -- got five
          // controls it could not choose between. The names already existed in all eleven
          // languages for the settings screen, which looks them up exactly this way.
          // The chord on the DEFAULT ink only; on all five it would promise four lies.
          title={ink === DEFAULT_INK ? tip(`${t.tbHighlight}: ${inkName(t, ink)}`, 'ink') : `${t.tbHighlight}: ${inkName(t, ink)}`}
          aria-label={`${t.tbHighlight}: ${inkName(t, ink)}`}
          aria-pressed={current === ink}
          onMouseDown={hold}
          onClick={() => editor.chain().focus().toggleInk(ink).run()}
          className={`grid h-6 w-6 place-items-center rounded-md ${
            current === ink ? 'ring-2 ring-neutral-400 dark:ring-neutral-300' : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
          }`}
        >
          <span className="block h-3.5 w-3.5 rounded-[2px]" style={{ background: PEN[ink] }} />
        </button>
      ))}
    </>
  )
}

// Every button here names itself with `aria-label` as well as `title`, and the two must stay
// together. The glyph inside is the accessible name otherwise -- content beats `title` when a
// browser computes one -- so this bar announced "B", "I", "O" instead of Bold, Italic and Ring
// a word, while the tooltip a mouse could see said the right thing all along.
//
// Floating menu over a text selection (or with the cursor in a link). An
// elevated chip that follows light/dark like the toolbar (a fixed dark chip was
// too harsh on light, and vanished into the dark editor background).
export function BubbleBar({ editor, avoidTop }: { editor: TiptapEditor; avoidTop: number }) {
  const t = useAdminT()
  const cls = (active: boolean) =>
    `rounded-md px-2 py-1 text-sm ${active ? 'bg-neutral-200 text-neutral-900 shadow-[inset_0_1.5px_2px_rgba(0,0,0,.16)] dark:bg-neutral-700 dark:text-white dark:shadow-[inset_0_1.5px_2px_rgba(0,0,0,.5)]' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700'}`
  // Keep the selection while clicking (mousedown would otherwise blur the editor
  // and collapse it before the command runs).
  const hold = (e: React.MouseEvent) => e.preventDefault()
  const askLink = useLinkAsker()
  const editLinkHere = () => { void editLink(editor, askLink) }
  // These two MUST be referentially stable. BubbleMenu re-dispatches an
  // "updateOptions" transaction whenever `options`/`shouldShow` change identity;
  // with shouldRerenderOnTransaction on, a fresh inline object each render would
  // loop (dispatch -> re-render -> new object -> dispatch -> ...) and crash.
  //
  // `flip` is not decoration: the bar sits ABOVE the selection, and the toolbar above the
  // writing surface is sticky — so selecting the FIRST line put the bar underneath it, where
  // it was both covered and unclickable. Reported by the owner, who could not format his own
  // opening sentence. `padding` is the height of the zone the toolbar occupies, measured and
  // passed in; inside it, Floating UI flips the bar below the selection instead.
  const options = useMemo(
    () => ({ placement: 'top' as const, offset: 8, flip: { padding: avoidTop } }),
    [avoidTop],
  )
  const shouldShow = useCallback(
    ({ editor: ed, state, from, to }: { editor: TiptapEditor; state: EditorState; from: number; to: number }) => {
      if (ed.isActive('link')) return true // cursor in a link -> offer edit/remove
      if (from === to) return false // nothing selected
      // A node selection (image / video) carries its own controls — don't cover it.
      if (state.selection instanceof NodeSelection) return false
      return true
    },
    [],
  )
  return (
    <BubbleMenu
      editor={editor}
      options={options}
      shouldShow={shouldShow}
      // z-40, ABOVE the sticky toolbar's z-10: flipping keeps them apart in most cases, and
      // when a selection spans the seam anyway, the bar the writer is reaching for wins.
      // `flex-wrap` and a viewport-bounded width. The bar had neither: 411px of buttons on a
      // 375px phone, `nowrap`, with the Link button off the right edge and unreachable —
      // measured. 32rem because the row MEASURES 487px with the headings on it; 30rem was
      // tried and folded a desktop that had the room. A phone takes the `100vw` half.
      className="z-40 flex max-w-[min(32rem,calc(100vw-1.5rem))] flex-wrap items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
    >
      {/* Every button carries its name. The bar is five glyphs and "mark this as code" was
          asked for as a missing feature, while it was the fifth one all along: a bare backtick,
          the width of a comma, next to letters. `</>` says code the way B says bold, and a
          title says it in words for the four that are only initials. */}
      <button type="button" title={t.tbBold} aria-label={tip(t.tbBold, 'bold')} onMouseDown={hold} onClick={() => editor.chain().focus().toggleBold().run()} className={cls(editor.isActive('bold'))}><strong>B</strong></button>
      <button type="button" title={t.tbItalic} aria-label={tip(t.tbItalic, 'italic')} onMouseDown={hold} onClick={() => editor.chain().focus().toggleItalic().run()} className={cls(editor.isActive('italic'))}><em>I</em></button>
      {/* THREE LEVELS, not one. A single `H` was hard-wired to H2 because the deeper levels
          "live behind / and their `#` shortcuts" — and neither reaches the case this bar is
          FOR: the slash menu opens only on an EMPTY paragraph (`handleTextInput` in
          Editor.tsx), and a selection has content. `### ` does work at the start of an
          existing line, measured, but nobody discovers it from a toolbar. H2/H3/H4 and not
          H1, because the post title is the H1; H5 stays with the toolbar. */}
      {([2, 3, 4] as const).map((level) => (
        <button
          key={level}
          type="button"
          title={`${t.tbHeading} ${level}`}
          aria-label={`${t.tbHeading} ${level}`}
          aria-pressed={editor.isActive('heading', { level })}
          onMouseDown={hold}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          className={cls(editor.isActive('heading', { level }))}
        >
          <span className="text-xs font-semibold">H{level}</span>
        </button>
      ))}
      <button type="button" title={t.tbUnderline} aria-label={tip(t.tbUnderline, 'underline')} onMouseDown={hold} onClick={() => editor.chain().focus().toggleUnderline().run()} className={cls(editor.isActive('underline'))}><u>U</u></button>
      <button type="button" title={t.tbRing} aria-label={tip(t.tbRing, 'ring')} onMouseDown={hold} onClick={() => editor.chain().focus().toggleRing().run()} className={cls(editor.isActive('ring'))}><span className="inline-block rounded-full border border-current px-1 leading-tight">O</span></button>
      <button type="button" title={t.tbStrike} aria-label={t.tbStrike} onMouseDown={hold} onClick={() => editor.chain().focus().toggleStrike().run()} className={cls(editor.isActive('strike'))}><s>S</s></button>
      <button type="button" title={t.tbCodeInline} aria-label={t.tbCodeInline} onMouseDown={hold} onClick={() => editor.chain().focus().toggleCode().run()} className={`${cls(editor.isActive('code'))} font-mono`}>{'</>'}</button>
      <span className="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
      <InkButtons editor={editor} hold={hold} />
      <span className="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
      <button type="button" title={t.tbLink} onMouseDown={hold} onClick={editLinkHere} className={cls(editor.isActive('link'))}>{t.tbLink}</button>
      {editor.isActive('link') && (
        <button type="button" onMouseDown={hold} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()} className={cls(false)}>{t.tbLinkRemove}</button>
      )}
    </BubbleMenu>
  )
}
