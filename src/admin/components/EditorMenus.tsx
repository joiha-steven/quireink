// Editor menus, split out of Editor.tsx to keep it under the size cap:
//  - Toolbar: the sticky top bar (formatting + a contextual table-tools row).
//  - BubbleBar: a floating menu that pops up on a text selection or with the
//    cursor inside a link — formatting + quick link edit/remove, like other
//    modern editors.
// Both need the editor to re-render on selection change; Editor.tsx enables
// `shouldRerenderOnTransaction` so isActive() stays live (off by default in
// TipTap 3, which is why the table row / active highlights weren't updating).
import React, { useCallback, useMemo } from 'react'
import { type Editor as TiptapEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { NodeSelection, type EditorState } from '@tiptap/pm/state'
import { useAdminT } from './I18nProvider'
import { INKS } from '@/render/ink'

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
  const sep = <span className="mx-1 h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />
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
      <div className="overflow-x-auto overscroll-x-contain p-2 [scrollbar-width:thin]">
        <div className="flex w-max min-w-full flex-nowrap items-center justify-center gap-0.5">
      <ToolButton label={t.tbBold} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></ToolButton>
      <ToolButton label={t.tbItalic} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></ToolButton>
      <ToolButton label={t.tbUnderline} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolButton>
      <ToolButton label="S" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolButton>
      <ToolButton label="`" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><code>{'`'}</code></ToolButton>
      {sep}
      <ToolButton label="P" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>P</ToolButton>
      {([1, 2, 3, 4, 5] as const).map((level) => (
        <ToolButton key={level} label={`H${level}`} active={editor.isActive('heading', { level })} onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>
          <span className="text-xs font-medium">H{level}</span>
        </ToolButton>
      ))}
      {sep}
      <ToolButton label={t.tbList} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <Glyph><circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" /><path d="M9 7h10M9 12h10M9 17h10" /></Glyph>
      </ToolButton>
      <ToolButton label={t.tbListNumbered} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <Glyph><path d="M4 6h2v4M4 14h2l-2 4h2M10 7h10M10 12h10M10 17h10" /></Glyph>
      </ToolButton>
      <ToolButton label={t.tbTask} active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <Glyph><rect x="3.5" y="4.5" width="6" height="6" rx="1" /><path d="m5 7 1.5 1.5L9 5.5M13 7h7M4 16h5M13 16h7" /></Glyph>
      </ToolButton>
      <ToolButton label={t.tbQuote} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Glyph><path d="M7 8H4v4h4v4H4M17 8h-3v4h4v4h-4" /></Glyph>
      </ToolButton>
      <ToolButton label={t.tbCodeBlock} active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Glyph><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></Glyph>
      </ToolButton>
      <ToolButton label={t.tbDivider} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Glyph><path d="M4 12h16" /></Glyph>
      </ToolButton>
      {sep}
      <ToolButton
        label={t.tbLink}
        active={editor.isActive('link')}
        onClick={() => {
          // Prefill the existing href so an old link can be edited (not just
          // created). extendMarkRange covers the whole link when the cursor is
          // merely inside it — no need to first select the linked text.
          const prev = (editor.getAttributes('link').href as string | undefined) ?? ''
          const url = window.prompt(t.promptLink, prev)
          if (url === null) return // cancelled — leave the link untouched
          const range = editor.chain().focus().extendMarkRange('link')
          if (url === '') range.unsetLink().run() // cleared the URL -> remove the link
          else range.setLink({ href: url }).run()
        }}
      >
        <Glyph><path d="M10 13a4.5 4.5 0 0 0 6.4.1l2-2a4.5 4.5 0 0 0-6.4-6.4l-1.1 1.1M14 11a4.5 4.5 0 0 0-6.4-.1l-2 2a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1" /></Glyph>
      </ToolButton>
      <ToolButton label={t.tbImage} onClick={onPickImage}><Glyph><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><circle cx="8" cy="9" r="1.5" /><path d="m4 17 5-5 4 4 3-3 4 4" /></Glyph></ToolButton>
      <ToolButton label={t.tbGallery} onClick={onPickGallery}><Glyph><rect x="5" y="5" width="14" height="14" rx="1.5" /><path d="M8 5V3h13v13h-2M6 16l4-4 3 3 2-2 4 4" /></Glyph></ToolButton>
      <ToolButton label={t.tbTable} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Glyph><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><path d="M3.5 10h17M9 4.5v15M15 4.5v15" /></Glyph></ToolButton>
      {sep}{toggle}
      {editor.isActive('table') && (
        <>
          {sep}
          <ToolButton label={t.tbColAdd} onClick={() => editor.chain().focus().addColumnAfter().run()}><span className="text-[10px] font-bold">C+</span></ToolButton>
          <ToolButton label={t.tbColDel} onClick={() => editor.chain().focus().deleteColumn().run()}><span className="text-[10px] font-bold">C−</span></ToolButton>
          <ToolButton label={t.tbRowAdd} onClick={() => editor.chain().focus().addRowAfter().run()}><span className="text-[10px] font-bold">R+</span></ToolButton>
          <ToolButton label={t.tbRowDel} onClick={() => editor.chain().focus().deleteRow().run()}><span className="text-[10px] font-bold">R−</span></ToolButton>
          <ToolButton label={t.tbTableDelete} onClick={() => editor.chain().focus().deleteTable().run()}><Glyph><path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" /></Glyph></ToolButton>
        </>
      )}
        </div>
      </div>
    </div>
  )
}

// The five pens, as five swatches rather than one button behind a dropdown.
//
// A dropdown would be one glyph instead of five, and it would be the wrong trade: choosing
// the ink IS the gesture here, the way choosing bold is not. The swatches carry the real
// pigments (the light-mode values from `web/ink.css.ts`), so the bar shows you the pen you
// are about to pick up rather than a word for it.
//
// Clicking the ink already on the selection lifts the pen; clicking a different one
// recolours in place instead of clearing and re-marking — see `toggleInk`.
const PEN: Record<string, string> = {
  yellow: '#d5f856', green: '#aaef83', pink: '#faaad9', blue: '#8ed6f9', orange: '#fac881',
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
export function BubbleBar({ editor }: { editor: TiptapEditor }) {
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
  const options = useMemo(() => ({ placement: 'top' as const, offset: 8 }), [])
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
      className="flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
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
