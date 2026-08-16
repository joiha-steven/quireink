// Editor menus, split out of Editor.tsx to keep it under the size cap:
//  - Toolbar: the sticky top bar (formatting + a contextual table-tools row).
//  - BubbleBar: a floating menu that pops up on a text selection or with the
//    cursor inside a link — formatting + quick link edit/remove, like other
//    modern editors.
// Both need the editor to re-render on selection change; Editor.tsx enables
// `shouldRerenderOnTransaction` so isActive() stays live (off by default in
// TipTap 3, which is why the table row / active highlights weren't updating).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

export function Toolbar({
  editor,
  onPickImage,
  onPickGallery,
  raw,
  onToggleRaw,
  stickyTop,
}: {
  editor: TiptapEditor
  onPickImage: () => void
  onPickGallery: () => void
  raw: boolean
  onToggleRaw: () => void
  stickyTop: number
}) {
  const t = useAdminT()
  const toggle = (
    <ToolButton label={raw ? t.tbReview : t.tbMarkdown} onClick={onToggleRaw}>
      {raw ? (
        <Glyph><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></Glyph>
      ) : <span className="text-[10px] font-bold tracking-tight">MD</span>}
    </ToolButton>
  )
  if (raw) {
    return (
      <div className="sticky z-10 flex items-center rounded-t-2xl border-b border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900" style={{ top: stickyTop }}>
        {toggle}
      </div>
    )
  }
  return (
    <div className="sticky z-10 rounded-t-2xl border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" style={{ top: stickyTop }}>
      <div className="flex items-center justify-center gap-1 p-2">
        <BlockMenu editor={editor} />
        <InsertMenu editor={editor} onPickImage={onPickImage} onPickGallery={onPickGallery} />
        {toggle}
        {/* Contextual, and the only row that ever grows: table tools exist while the cursor
            is in a table and nowhere else, which is the rule the whole bar now follows. */}
        {editor.isActive('table') && (
          <>
            <span className="mx-1 h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />
            <ToolButton label={t.tbColAdd} onClick={() => editor.chain().focus().addColumnAfter().run()}><span className="text-[10px] font-bold">C+</span></ToolButton>
            <ToolButton label={t.tbColDel} onClick={() => editor.chain().focus().deleteColumn().run()}><span className="text-[10px] font-bold">C−</span></ToolButton>
            <ToolButton label={t.tbRowAdd} onClick={() => editor.chain().focus().addRowAfter().run()}><span className="text-[10px] font-bold">R+</span></ToolButton>
            <ToolButton label={t.tbRowDel} onClick={() => editor.chain().focus().deleteRow().run()}><span className="text-[10px] font-bold">R−</span></ToolButton>
            <ToolButton label={t.tbTableDelete} onClick={() => editor.chain().focus().deleteTable().run()}><Glyph><path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" /></Glyph></ToolButton>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * A menu that opens under its button, closes on Escape, on an outside press, and on picking
 * something. `onMouseDown` is prevented THROUGHOUT: a mousedown anywhere in here would blur
 * the editor and collapse the selection before the command ran, which is the same trap the
 * bubble bar documents.
 */
function Popover({ label, current, children }: { label: string; current: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key) }
  }, [open])
  return (
    <div className="relative" ref={box} onMouseDown={(e) => e.preventDefault()}>
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        {current}
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 min-w-44 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

function Row({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active || undefined}
      className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm ${
        active ? 'bg-neutral-200 text-neutral-950 dark:bg-neutral-700 dark:text-white' : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700'
      }`}
    >
      {label}
    </button>
  )
}

/**
 * What a block IS: body text, one of five headings, a quote, a list, a code block.
 *
 * Twelve buttons before, all of them permanently on screen so that the six the owner never
 * uses were as loud as the two he does. They are one control now, and it SAYS what the block
 * under the cursor is — which the row of twelve could only show by highlighting one of them.
 */
function BlockMenu({ editor }: { editor: TiptapEditor }) {
  const t = useAdminT()
  const levels = [1, 2, 3, 4, 5] as const
  const heading = levels.find((l) => editor.isActive('heading', { level: l }))
  const current =
    heading ? `H${heading}`
    : editor.isActive('blockquote') ? '❝'
    : editor.isActive('codeBlock') ? '</>'
    : editor.isActive('bulletList') ? '••'
    : editor.isActive('orderedList') ? '1.'
    : editor.isActive('taskList') ? '☑'
    : t.tbParagraph
  const run = (close: () => void, fn: () => void) => { fn(); close() }
  return (
    <Popover label={t.tbBlock} current={current}>
      {(close) => (
        <>
          <Row label={t.tbParagraph} active={editor.isActive('paragraph')} onClick={() => run(close, () => editor.chain().focus().setParagraph().run())} />
          {levels.map((level) => (
            <Row key={level} label={`H${level}`} active={editor.isActive('heading', { level })} onClick={() => run(close, () => editor.chain().focus().toggleHeading({ level }).run())} />
          ))}
          <Row label={t.tbList} active={editor.isActive('bulletList')} onClick={() => run(close, () => editor.chain().focus().toggleBulletList().run())} />
          <Row label={t.tbListNumbered} active={editor.isActive('orderedList')} onClick={() => run(close, () => editor.chain().focus().toggleOrderedList().run())} />
          <Row label={t.tbTask} active={editor.isActive('taskList')} onClick={() => run(close, () => editor.chain().focus().toggleTaskList().run())} />
          <Row label={t.tbQuote} active={editor.isActive('blockquote')} onClick={() => run(close, () => editor.chain().focus().toggleBlockquote().run())} />
          <Row label={t.tbCodeBlock} active={editor.isActive('codeBlock')} onClick={() => run(close, () => editor.chain().focus().toggleCodeBlock().run())} />
        </>
      )}
    </Popover>
  )
}

/**
 * Everything that puts something NEW on the page. Six buttons before; one now, because
 * inserting a table is a thing done twice a month and it was sitting at the same volume as
 * the writing.
 *
 * The two formula entries stay two entries, for the reason the five pens stay five swatches:
 * a formula on its own line and a symbol inside a sentence are different gestures, not two
 * settings of one.
 */
function InsertMenu({ editor, onPickImage, onPickGallery }: { editor: TiptapEditor; onPickImage: () => void; onPickGallery: () => void }) {
  const t = useAdminT()
  const run = (close: () => void, fn: () => void) => { fn(); close() }
  return (
    <Popover label={t.tbInsert} current="+">
      {(close) => (
        <>
          <Row label={t.tbImage} onClick={() => run(close, onPickImage)} />
          <Row label={t.tbGallery} onClick={() => run(close, onPickGallery)} />
          <Row label={t.tbTable} onClick={() => run(close, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())} />
          <Row label={t.tbDivider} onClick={() => run(close, () => editor.chain().focus().setHorizontalRule().run())} />
          <Row label={t.tbMath} onClick={() => run(close, () => editor.chain().focus().setMath(true).run())} />
          <Row label={t.tbMathInline} onClick={() => run(close, () => editor.chain().focus().setMath(false).run())} />
        </>
      )}
    </Popover>
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
