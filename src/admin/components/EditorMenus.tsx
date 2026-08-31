// Editor menus, split out of Editor.tsx to keep it under the size cap:
//  - Toolbar: the full button row under the title (formatted view only) — the owner's
//    explicit pick, see its header for the round trip it survived.
//  - SlashMenu: the same inserts, opened at the caret by typing "/" on an empty line.
//  - BubbleBar: a floating menu that pops up on a text selection or with the
//    cursor inside a link — formatting + quick link edit/remove.
// All need the editor to re-render on selection change; Editor.tsx enables
// `shouldRerenderOnTransaction` so isActive() stays live (off by default in
// TipTap 3, which is why the table row / active highlights weren't updating).
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { type Editor as TiptapEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { NodeSelection, type EditorState } from '@tiptap/pm/state'
import type { AdminStrings } from '@/i18n/admin-i18n'
import { useAdminT } from './I18nProvider'
import { DEFAULT_INK, INKS } from '@/render/ink'
import { PEN_LIGHT } from '@/render/pen'
import { tip } from './editorKeys'

const BTN = 'grid h-9 min-w-9 shrink-0 place-items-center rounded-md px-1 text-[15px] hover:bg-white dark:hover:bg-neutral-700'

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
      className={`${BTN} ${active ? 'bg-white text-neutral-950 shadow-[inset_0_1.5px_2px_rgba(0,0,0,.14)] ring-1 ring-neutral-200 dark:bg-neutral-700 dark:text-white dark:shadow-[inset_0_1.5px_2px_rgba(0,0,0,.5)] dark:ring-neutral-600' : 'text-neutral-600 dark:text-neutral-300'}`}
    >
      {children}
    </button>
  )
}

/**
 * The full toolbar over the writing surface, in the FORMATTED view only.
 *
 * Its history is a round trip worth recording. Step 4 collapsed these buttons into two
 * menus; the Writing Desk mock then removed the bar entirely, and the first mock-faithful
 * cut shipped that. After writing in both (2026-08-17) the verdict was that "/" alone is
 * fine in the Markdown view but the normal view wants a toolbar — and THIS bar, the
 * original row of plain buttons, is the shape asked for — then asked for it at the TOP
 * of the sheet, full-width, wrapping instead of scrolling. The Markdown view stays bare. "/" and the selection
 * bubble remain: the bar is a second door to the same rooms, not the only one.
 */
export function Toolbar({
  editor,
  onPickImage,
  onPickGallery,
  stickyTop,
}: {
  editor: TiptapEditor
  onPickImage: () => void
  onPickGallery: () => void
  stickyTop: number
}) {
  const t = useAdminT()
  const sep = <span className="mx-1 h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />
  // The sheet's own top strip, tuned by the owner's notes in order: on TOP, full-width,
  // wrapping instead of scrolling, buttons grouped in the middle, FORMATTED view only (the
  // MD switch sits in the action line, and the Markdown view shows no bar at all) — and
  // drawn in the SAME language as that action line: the same ground, the same hairline,
  // edges flush with the card. The first cut floated it as an inset rounded chip, and the
  // two chrome pieces in two styles a hand apart read as careless.
  return (
    <div className="sticky z-10 border-b border-neutral-200/70 bg-neutral-50/80 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/60" style={{ top: stickyTop }}>
      <div className="flex flex-wrap items-center justify-center gap-0.5 px-2.5 py-1.5">
      <ToolButton label={tip(t.tbBold, 'bold')} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></ToolButton>
      <ToolButton label={tip(t.tbItalic, 'italic')} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></ToolButton>
      <ToolButton label={tip(t.tbUnderline, 'underline')} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolButton>
      <ToolButton label={tip(t.tbRing, 'ring')} active={editor.isActive('ring')} onClick={() => editor.chain().focus().toggleRing().run()}><span className="inline-block rounded-full border border-current px-1 leading-tight">O</span></ToolButton>
      <ToolButton label={tip('S', 'strike')} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolButton>
      <ToolButton label={tip('`', 'code')} active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><code>{'`'}</code></ToolButton>
      {sep}
      <ToolButton label="P" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>P</ToolButton>
      {([1, 2, 3, 4, 5] as const).map((level) => (
        <ToolButton key={level} label={`H${level}`} active={editor.isActive('heading', { level })} onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>
          <span className="text-xs font-medium">H{level}</span>
        </ToolButton>
      ))}
      {sep}
      <ToolButton label={tip(t.tbList, 'bulletList')} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <Glyph><circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" /><path d="M9 7h10M9 12h10M9 17h10" /></Glyph>
      </ToolButton>
      <ToolButton label={tip(t.tbListNumbered, 'orderedList')} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <Glyph><path d="M4 6h2v4M4 14h2l-2 4h2M10 7h10M10 12h10M10 17h10" /></Glyph>
      </ToolButton>
      <ToolButton label={tip(t.tbTask, 'taskList')} active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <Glyph><rect x="3.5" y="4.5" width="6" height="6" rx="1" /><path d="m5 7 1.5 1.5L9 5.5M13 7h7M4 16h5M13 16h7" /></Glyph>
      </ToolButton>
      <ToolButton label={tip(t.tbQuote, 'blockquote')} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Glyph><path d="M7 8H4v4h4v4H4M17 8h-3v4h4v4h-4" /></Glyph>
      </ToolButton>
      <ToolButton label={tip(t.tbCodeBlock, 'codeBlock')} active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Glyph><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></Glyph>
      </ToolButton>
      <ToolButton label={t.tbDivider} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Glyph><path d="M4 12h16" /></Glyph>
      </ToolButton>
      {sep}
      <ToolButton
        label={tip(t.tbLink, 'link')}
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
      {/* Two buttons, not one behind a menu. Display and inline are not two settings of one
          thing: a standalone equation and a symbol inside a sentence are different gestures,
          the same argument the five pens make against a colour dropdown. Both drop an EMPTY
          formula with the caret in its box, so the next thing typed is the TeX. */}
      {/* The glyph is a pi, and the LINES AROUND IT carry the block/inline distinction: full
          rules above and below for a formula on its own line, a dash either side for one
          sitting in a sentence. Chosen by rendering the candidates at 24px and looking —
          the first pair drawn here read as "I×" and "×≠", and a sigma at this size comes out
          as the digit 3. */}
      <ToolButton label={t.tbMath} active={editor.isActive('mathBlock')} onClick={() => editor.chain().focus().setMath(true).run()}>
        <Glyph><path d="M4 4.5h16M4 19.5h16" /><path d="M7.5 9.5h9M10 9.5v5M14 9.5v5" /></Glyph>
      </ToolButton>
      <ToolButton label={t.tbMathInline} active={editor.isActive('mathInline')} onClick={() => editor.chain().focus().setMath(false).run()}>
        <Glyph><path d="M3 12h3M18 12h3" /><path d="M8 9h8M10.5 9v6M14.5 9v6" /></Glyph>
      </ToolButton>
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
  )
}

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
      {hint && <span className="shrink-0 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">{hint}</span>}
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
      // `flex-wrap` and a viewport-bounded width. The bar had neither: 411px of buttons on a
      // 375px phone, `nowrap`, with the Link button off the right edge and unreachable —
      // measured. 32rem because the row MEASURES 487px with the headings on it; 30rem was
      // tried and folded a desktop that had the room. A phone takes the `100vw` half.
      className="z-40 flex max-w-[min(32rem,calc(100vw-1.5rem))] flex-wrap items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
    >
      {/* Every button carries its name. The bar is five glyphs and the owner asked for a way
          to mark a selection as code, which was the fifth one all along: a bare backtick,
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
      <button type="button" title={t.tbLink} onMouseDown={hold} onClick={editLink} className={cls(editor.isActive('link'))}>{t.tbLink}</button>
      {editor.isActive('link') && (
        <button type="button" onMouseDown={hold} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()} className={cls(false)}>{t.tbLinkRemove}</button>
      )}
    </BubbleMenu>
  )
}
