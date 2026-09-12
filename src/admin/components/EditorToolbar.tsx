// The button row over the writing surface, split out of `EditorMenus.tsx` when that file
// reached the size cap. The seam is the one the subject draws: this is the BAR, a fixed strip
// of chrome attached to the sheet; that file keeps the menus that open at the caret or on a
// selection ("/" and the bubble), which are a different thing wearing a different shape.
//
// The editor re-renders on every selection change (`Editor.tsx` sets
// `shouldRerenderOnTransaction`), so `isActive()` here is live.
import React from 'react'
import { type Editor as TiptapEditor } from '@tiptap/react'
import { useAdminT } from './I18nProvider'
import { editLink, useLinkAsker } from './editorLink'
import { tip } from './editorKeys'
// Link, picture and bin come from the shared set; the rest is editing notation, drawn here.
import { SharedGlyph as Shared } from './navIcons'
import { Tip } from '@/admin/ui/Tip'

const BTN = 'grid h-9 min-w-9 shrink-0 place-items-center rounded-md px-1 text-[15px] hover:bg-white dark:hover:bg-neutral-700'

/**
 * A LINE OF THE BAR: the full width of the sheet, its buttons in the middle of it.
 *
 * `px-4` and not the 10px it had, so the first button stands on the same left edge as the
 * action line above it. Measured at 1440: that line's first control sits at 273 and this
 * one's sat at 267, which is one sheet with two left edges six pixels apart.
 */
const STRIP = 'no-scrollbar overflow-x-auto px-4 py-1.5 lg:flex lg:overflow-x-visible'

/** The main bar's line: centred over the writing, which is the shape this bar was asked for. */
const MIDDLE = `${STRIP} lg:justify-center`

/**
 * The run of buttons inside a line, and the two widths that make it behave.
 *
 * `w-max` shrinks the run to its content, so the strip's `justify-center` has something to
 * centre; `max-w-full` caps it at the sheet, and at that point it wraps — and a wrapped run
 * lays its lines out from the LEFT rather than centring each one, which is what a second line
 * of tools should do. Centring every line put five buttons adrift in the middle of an empty
 * row, which is how it read at 1440 with the attributes sheet docked beside the writing.
 */
const RUN = 'flex flex-nowrap items-center gap-3 lg:w-max lg:max-w-full lg:flex-wrap'

/**
 * One cluster of buttons, kept together when the run wraps.
 *
 * The clusters used to be told apart by a hairline between them, and a hairline is the one
 * thing that must not be the first mark on a line: wrapped at 1440 with the attributes sheet
 * docked, the second line opened with a stray vertical tick and then its buttons. The gap
 * between clusters was 13px with the rule in it and is 12px without, so the rhythm of the row
 * is the one it already had, minus a piece of furniture that could end up orphaned.
 */
const GROUP = 'flex items-center gap-0.5'

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

function ToolButton({ label, active = false, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    // `Tip` draws the label in this product's type after 400ms; `title` stays for touch.
    <Tip label={label}>
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
    </Tip>
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
  const askLink = useLinkAsker()
  // The sheet's own top strip, tuned by the owner's notes in order: on TOP, full-width,
  // wrapping instead of scrolling, buttons grouped in the middle, FORMATTED view only (the
  // MD switch sits in the action line, and the Markdown view shows no bar at all) — and
  // drawn in the SAME language as that action line: the same ground, the same hairline,
  // edges flush with the card. The first cut floated it as an inset rounded chip, and the
  // two chrome pieces in two styles a hand apart read as careless.
  return (
    <div className="sticky z-10 border-b border-neutral-200/70 bg-neutral-50/80 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/60" style={{ top: stickyTop }}>
      {/* ⚠️ ONE ROW THAT SCROLLS ON A PHONE, rows that wrap on a desktop.
          Measured at 390 × 844 on 2026-09-07: this strip wrapped to 125px and the action bar
          above it to 139, so a post's title began 378px down — 45% of the screen was chrome
          before the first word. Wrapping is right where there is width for it and wrong here:
          a writer scrolls a strip of tools sideways in every application they have ever used,
          and they cannot scroll the paper back up past chrome that is stuck to it.
          `no-scrollbar` because the bar itself would be a fourth line of furniture. */}
      <div className={MIDDLE}>
        <div className={RUN}>
          <span className={GROUP}>
            <ToolButton label={tip(t.tbBold, 'bold')} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></ToolButton>
            <ToolButton label={tip(t.tbItalic, 'italic')} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></ToolButton>
            <ToolButton label={tip(t.tbUnderline, 'underline')} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolButton>
            <ToolButton label={tip(t.tbRing, 'ring')} active={editor.isActive('ring')} onClick={() => editor.chain().focus().toggleRing().run()}><span className="inline-block rounded-full border border-current px-1 leading-tight">O</span></ToolButton>
            <ToolButton label={tip(t.tbStrike, 'strike')} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolButton>
            <ToolButton label={tip(t.tbCodeInline, 'code')} active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><code>{'`'}</code></ToolButton>
          </span>
          <span className={GROUP}>
            <ToolButton label={t.tbParagraph} active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>P</ToolButton>
            {([1, 2, 3, 4, 5] as const).map((level) => (
              <ToolButton key={level} label={`${t.tbHeading} ${level}`} active={editor.isActive('heading', { level })} onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>
                <span className="text-xs font-medium">H{level}</span>
              </ToolButton>
            ))}
          </span>
          <span className={GROUP}>
            <ToolButton label={tip(t.tbList, 'bulletList')} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <Glyph><circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" /><path d="M9 7h10M9 12h10M9 17h10" /></Glyph>
            </ToolButton>
            <ToolButton label={tip(t.tbListNumbered, 'orderedList')} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <Glyph><path d="M4 6h2v4M4 14h2l-2 4h2M10 7h10M10 12h10M10 17h10" /></Glyph>
            </ToolButton>
            <ToolButton label={tip(t.tbTask, 'taskList')} active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
              <Glyph><rect x="3.5" y="4.5" width="6" height="6" rx="1" /><path d="m5 7 1.5 1.5L9 5.5M13 7h7M4 16h5M13 16h7" /></Glyph>
            </ToolButton>
          </span>
          {/* LISTS end, BLOCKS begin: one run of five held two ideas. */}
          <span className={GROUP}>
            <ToolButton label={tip(t.tbQuote, 'blockquote')} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              <Glyph><path d="M7 8H4v4h4v4H4M17 8h-3v4h4v4h-4" /></Glyph>
            </ToolButton>
            <ToolButton label={tip(t.tbCodeBlock, 'codeBlock')} active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
              <Glyph><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></Glyph>
            </ToolButton>
            <ToolButton label={t.tbDivider} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
              <Glyph><path d="M4 12h16" /></Glyph>
            </ToolButton>
          </span>
          <span className={GROUP}>
            <ToolButton
              label={tip(t.tbLink, 'link')}
              active={editor.isActive('link')}
              onClick={() => { void editLink(editor, askLink) }}
            >
              <Glyph><Shared name="link" /></Glyph>
            </ToolButton>
            <ToolButton label={t.tbImage} onClick={onPickImage}><Glyph><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><circle cx="8" cy="9" r="1.5" /><path d="m4 17 5-5 4 4 3-3 4 4" /></Glyph></ToolButton>
            <ToolButton label={t.tbGallery} onClick={onPickGallery}><Glyph><rect x="5" y="5" width="14" height="14" rx="1.5" /><path d="M8 5V3h13v13h-2M6 16l4-4 3 3 2-2 4 4" /></Glyph></ToolButton>
            <ToolButton label={t.tbTable} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Glyph><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><path d="M3.5 10h17M9 4.5v15M15 4.5v15" /></Glyph></ToolButton>
            {/* Two buttons, not one behind a menu. Display and inline are not two settings of
                one thing: a standalone equation and a symbol inside a sentence are different
                gestures, the same argument the five pens make against a colour dropdown. Both
                drop an EMPTY formula with the caret in its box, so the next thing typed is the
                TeX. The glyph is a pi, and the LINES AROUND IT carry the distinction: full
                rules above and below for a formula on its own line, a dash either side for one
                sitting in a sentence. Chosen by rendering the candidates at 24px and looking —
                the first pair drawn here read as "I×" and "×≠", and a sigma at this size comes
                out as the digit 3. */}
            <ToolButton label={t.tbMath} active={editor.isActive('mathBlock')} onClick={() => editor.chain().focus().setMath(true).run()}>
              <Glyph><path d="M4 4.5h16M4 19.5h16" /><path d="M7.5 9.5h9M10 9.5v5M14 9.5v5" /></Glyph>
            </ToolButton>
            <ToolButton label={t.tbMathInline} active={editor.isActive('mathInline')} onClick={() => editor.chain().focus().setMath(false).run()}>
              <Glyph><path d="M3 12h3M18 12h3" /><path d="M8 9h8M10.5 9v6M14.5 9v6" /></Glyph>
            </ToolButton>
          </span>
        </div>
      </div>
      {/* THE TABLE'S OWN TOOLS, ON THEIR OWN LINE, and the line is what makes the bar above
          hold still. Ranged left, where every other row of chrome on this sheet starts: the
          bar above is centred because that is the shape it was asked for, and a contextual
          row borrowing that centring floated in the middle of an empty line whenever the bar
          wrapped — which it does from the moment the attributes sheet stands beside the page. They used to join the end of that run, which moved every button in it:
          measured 2026-09-12 at 1440, putting the caret in a table slid the whole row 62.5px
          to the left and taking it out slid it back, so the button a hand was travelling
          towards was somewhere else by the time it arrived. Five buttons that belong to one
          block have no business changing where Bold lives. */}
      {editor.isActive('table') && (
        <div className={`${STRIP} border-t border-neutral-200/60 dark:border-neutral-800/80`}>
          <div className={RUN}>
            <ToolButton label={t.tbColAdd} onClick={() => editor.chain().focus().addColumnAfter().run()}><span className="text-xs font-bold">C+</span></ToolButton>
            <ToolButton label={t.tbColDel} onClick={() => editor.chain().focus().deleteColumn().run()}><span className="text-xs font-bold">C−</span></ToolButton>
            <ToolButton label={t.tbRowAdd} onClick={() => editor.chain().focus().addRowAfter().run()}><span className="text-xs font-bold">R+</span></ToolButton>
            <ToolButton label={t.tbRowDel} onClick={() => editor.chain().focus().deleteRow().run()}><span className="text-xs font-bold">R−</span></ToolButton>
            <ToolButton label={t.tbTableDelete} onClick={() => editor.chain().focus().deleteTable().run()}><Glyph><Shared name="trash" /></Glyph></ToolButton>
          </div>
        </div>
      )}
    </div>
  )
}
