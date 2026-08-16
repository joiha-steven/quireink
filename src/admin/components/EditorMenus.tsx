// Editor menus, split out of Editor.tsx to keep it under the size cap:
//  - SlashMenu: everything that inserts, opened by typing "/" on an empty line.
//  - TableBar: the table tools, on screen ONLY while the cursor is in a table.
//  - BubbleBar: a floating menu that pops up on a text selection or with the
//    cursor inside a link — formatting + quick link edit/remove.
// All need the editor to re-render on selection change; Editor.tsx enables
// `shouldRerenderOnTransaction` so isActive() stays live (off by default in
// TipTap 3, which is why the table row / active highlights weren't updating).
//
// ⚠️ There is NO permanent toolbar any more, and that is the design, not a gap
// (ADR 0024 step 4, tightened to the Writing Desk mock on 2026-08-17). The resting
// state of the screen is a sheet of paper: the controls exist the moment they are
// called — a selection, a "/", a table — and not otherwise. Before reaching for a
// bar, read the mock (`quireink-private/reports/2026-08-16-writing-desk.md`).
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { type Editor as TiptapEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { NodeSelection, type EditorState } from '@tiptap/pm/state'
import { useAdminT } from './I18nProvider'
import { INKS } from '@/render/ink'
import { PEN_LIGHT } from '@/render/pen'

const BTN = 'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800'

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

function ToolButton({ label, active = false, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
      className={`${BTN} ${active ? 'bg-neutral-200 text-neutral-950 dark:bg-neutral-700 dark:text-white' : 'text-neutral-600 dark:text-neutral-300'}`}
    >
      {children}
    </button>
  )
}

/**
 * The table tools, present only while the cursor is IN a table.
 *
 * The last survivor of the old permanent toolbar: a table genuinely cannot be worked on
 * with a bubble (its operations act on rows and columns, not on a selection) and "/" cannot
 * reach it either (a cell's paragraph is rarely empty). So the bar the mock removed comes
 * back for exactly as long as a table is under the cursor, which is the rule the whole
 * editor now follows: controls arrive when called.
 */
export function TableBar({ editor, stickyTop }: { editor: TiptapEditor; stickyTop: number }) {
  const t = useAdminT()
  if (!editor.isActive('table')) return null
  return (
    <div className="sticky z-10 flex items-center justify-center gap-1 rounded-t-2xl border-b border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900" style={{ top: stickyTop }}>
      <ToolButton label={t.tbColAdd} onClick={() => editor.chain().focus().addColumnAfter().run()}><span className="text-[10px] font-bold">C+</span></ToolButton>
      <ToolButton label={t.tbColDel} onClick={() => editor.chain().focus().deleteColumn().run()}><span className="text-[10px] font-bold">C−</span></ToolButton>
      <ToolButton label={t.tbRowAdd} onClick={() => editor.chain().focus().addRowAfter().run()}><span className="text-[10px] font-bold">R+</span></ToolButton>
      <ToolButton label={t.tbRowDel} onClick={() => editor.chain().focus().deleteRow().run()}><span className="text-[10px] font-bold">R−</span></ToolButton>
      <ToolButton label={t.tbTableDelete} onClick={() => editor.chain().focus().deleteTable().run()}><Glyph><path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" /></Glyph></ToolButton>
    </div>
  )
}

function Row({ label, hint, active = false, onClick }: { label: string; hint?: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active || undefined}
      data-slash-row
      className={`flex w-full items-baseline justify-between gap-4 rounded-lg px-3 py-1.5 text-left text-sm ${
        active ? 'bg-neutral-200 text-neutral-950 dark:bg-neutral-700 dark:text-white' : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700'
      }`}
    >
      <span>{label}</span>
      {hint && <span className="shrink-0 font-mono text-[11px] text-neutral-400 dark:text-neutral-500">{hint}</span>}
    </button>
  )
}

/**
 * The "/" menu: everything that puts something NEW on the page, opened at the caret by
 * typing "/" on an empty line (the Writing Desk mock's one gesture for inserting).
 *
 * It replaces the toolbar's two permanent dropdowns. What those also carried — block types,
 * lists, quotes — is NOT lost: every one of them has a Markdown shortcut the editor already
 * honours (`#`, `-`, `1.`, `>`, ``` ```, `[ ]`), the shortcut is printed beside its row
 * here, and a heading is one press on the selection bar. The menu teaches the shortcuts
 * rather than replacing them.
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
      className="fixed z-40 max-h-[360px] w-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
      style={style}
    >
      <Row label={t.tbImage} onClick={() => run(onPickImage)} />
      <Row label={t.tbGallery} onClick={() => run(onPickGallery)} />
      <Row label={t.tbTable} onClick={() => run(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())} />
      <Row label={t.tbCodeBlock} hint="```" onClick={() => run(() => editor.chain().focus().toggleCodeBlock().run())} />
      {/* The two formula entries stay two entries, for the reason the five pens stay five
          swatches: a block formula and a symbol inside a sentence are different gestures. */}
      <Row label={t.tbMath} onClick={() => run(() => editor.chain().focus().setMath(true).run())} />
      <Row label={t.tbMathInline} onClick={() => run(() => editor.chain().focus().setMath(false).run())} />
      <Row label={t.tbDivider} hint="---" onClick={() => run(() => editor.chain().focus().setHorizontalRule().run())} />
      <span className="my-1 block h-px w-full bg-neutral-100 dark:bg-neutral-700" aria-hidden />
      <Row label={t.tbQuote} hint=">" onClick={() => run(() => editor.chain().focus().toggleBlockquote().run())} />
      <Row label={t.tbList} hint="-" onClick={() => run(() => editor.chain().focus().toggleBulletList().run())} />
      <Row label={t.tbListNumbered} hint="1." onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())} />
      <Row label={t.tbTask} hint="[ ]" onClick={() => run(() => editor.chain().focus().toggleTaskList().run())} />
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
// READ from `render/pen.ts`, not typed out. All five were written out here a second time,
// and a swatch that is a near-miss of the ink it applies is the worst kind of wrong: it
// looks deliberate. The `#` is added here because CSS wants it and the stroke wants the
// bare hex.
//
// Clicking the ink already on the selection lifts the pen; clicking a different one
// recolours in place instead of clearing and re-marking — see `toggleInk`.
const PEN: Record<string, string> = Object.fromEntries(
  Object.entries(PEN_LIGHT).map(([ink, hex]) => [ink, `#${hex}`]),
)

function InkButtons({ editor, hold }: { editor: TiptapEditor; hold: (e: React.MouseEvent) => void }) {
  const t = useAdminT()
  const current = editor.isActive('ink') ? (editor.getAttributes('ink').ink as string) : ''
  return (
    <>
      {INKS.map((ink) => (
        <button
          key={ink}
          type="button"
          title={t.tbHighlight}
          aria-pressed={current === ink}
          onMouseDown={hold}
          onClick={() => editor.chain().focus().toggleInk(ink).run()}
          className={`grid h-6 w-6 place-items-center rounded ${
            current === ink ? 'ring-2 ring-neutral-400 dark:ring-neutral-300' : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
          }`}
        >
          <span className="block h-3.5 w-3.5 rounded-[2px]" style={{ background: PEN[ink] }} />
        </button>
      ))}
    </>
  )
}

// Floating menu over a text selection (or with the cursor in a link). An
// elevated chip that follows light/dark like the toolbar (a fixed dark chip was
// too harsh on light, and vanished into the dark editor background).
export function BubbleBar({ editor, avoidTop }: { editor: TiptapEditor; avoidTop: number }) {
  const t = useAdminT()
  const cls = (active: boolean) =>
    `rounded px-2 py-1 text-sm ${active ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-white' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700'}`
  // Keep the selection while clicking (mousedown would otherwise blur the editor
  // and collapse it before the command runs).
  const hold = (e: React.MouseEvent) => e.preventDefault()
  const editLink = () => {
    const prev = (editor.getAttributes('link').href as string | undefined) ?? ''
    const url = window.prompt(t.promptLink, prev)
    if (url === null) return
    const range = editor.chain().focus().extendMarkRange('link')
    if (url === '') range.unsetLink().run()
    else range.setLink({ href: url }).run()
  }
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
      className="z-40 flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
    >
      {/* Every button carries its name. The bar is five glyphs and the owner asked for a way
          to mark a selection as code, which was the fifth one all along: a bare backtick,
          the width of a comma, next to letters. `</>` says code the way B says bold, and a
          title says it in words for the four that are only initials. */}
      <button type="button" title={t.tbBold} onMouseDown={hold} onClick={() => editor.chain().focus().toggleBold().run()} className={cls(editor.isActive('bold'))}><strong>B</strong></button>
      <button type="button" title={t.tbItalic} onMouseDown={hold} onClick={() => editor.chain().focus().toggleItalic().run()} className={cls(editor.isActive('italic'))}><em>I</em></button>
      {/* The mock's fourth glyph: turn the selected line into a section heading. H2 — the
          post title is the H1 and the deeper levels live behind "/" and their `#` shortcuts. */}
      <button type="button" title={t.tbHeading} onMouseDown={hold} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cls(editor.isActive('heading', { level: 2 }))}><span className="font-semibold">H</span></button>
      <button type="button" title={t.tbUnderline} onMouseDown={hold} onClick={() => editor.chain().focus().toggleUnderline().run()} className={cls(editor.isActive('underline'))}><u>U</u></button>
      <button type="button" title={t.tbStrike} onMouseDown={hold} onClick={() => editor.chain().focus().toggleStrike().run()} className={cls(editor.isActive('strike'))}><s>S</s></button>
      <button type="button" title={t.tbCodeInline} onMouseDown={hold} onClick={() => editor.chain().focus().toggleCode().run()} className={`${cls(editor.isActive('code'))} font-mono`}>{'</>'}</button>
      <span className="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
      <InkButtons editor={editor} hold={hold} />
      <span className="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
      <button type="button" title={t.tbLink} onMouseDown={hold} onClick={editLink} className={cls(editor.isActive('link'))}>{t.tbLink}</button>
      {editor.isActive('link') && (
        <button type="button" onMouseDown={hold} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()} className={cls(false)}>{t.tbLinkRemove}</button>
      )}
    </BubbleMenu>
  )
}
