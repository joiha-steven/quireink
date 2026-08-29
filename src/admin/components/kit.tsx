// Admin UI kit — ONE source of truth for the shared chrome so no page hand-rolls
// its own card/header/tabs/table and they can never drift again (radius, padding,
// shadow, header size were all inconsistent before). Admin is monochrome by design
// (neutral scale, no public theme tokens). No `'use client'`: these are presentational
// — pure primitives render in server OR client trees; Tabs only takes props.
import type { ReactNode, SelectHTMLAttributes } from 'react'

// --- The sheet -----------------------------------------------------------------------------
//
// A card is a SHEET on paper: a hairline edge, a small radius, NO SHADOW. It was `rounded-2xl`
// + a 1px drop shadow on a #f5f5f5 canvas, which is the costume every generated dashboard
// wears and what the owner read as "rẻ tiền" on 2026-08-15. Each part does its share: 16px on
// a 1200px panel is a pill, a shadow says the panel FLOATS, and gray under white makes the
// page a tray of boxes rather than a document. The reading site next door is the argument —
// one sheet of paper, hairlines ruled across it, nothing floating — so the canvas is that same
// paper now (`admin.css`) and the RULE does the dividing, which is what this file's own
// contract already claimed ("hierarchy comes from spacing and rules, not decoration").
// ⚠️ Not to be re-added: `docs/admin-design.md` reserves shadows for OVERLAYS, so one on a
// card spends the only signal that means "this floats above what you were reading".
/**
 * ONE SHADOW STEP, owner's call 2026-08-29 — and the rule it replaces is worth reading first.
 *
 * The admin was flat on purpose: `admin-design.md` argued that a rounded white card on a soft
 * shadow is the costume every generated dashboard wears, and `check:admin-kit` failed a raised
 * white surface that was not `sticky` or `fixed`. That argument was about the COSTUME — a card
 * lifted high enough to float, over a tinted tray, with pill tabs. It is not an argument
 * against a card having any edge at all, and the admin had drifted into reading flat and, in
 * the owner's word, máy móc.
 *
 * So: one step, and small enough to be an edge rather than a lift — 1px of contact and a 2px
 * spread at 4% black. It says "this is a surface above the page" and stops. There is no second
 * step, and a card that wants one wants to be an overlay instead.
 */
export const CARD =
  'rounded-[10px] border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgb(16_24_40/0.04)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none'

// The two surfaces that sit INSIDE a card, both hand-written in several places before
// they were named here. A settings page is a Card holding a PANEL_LIST of rows; a row that
// needs its own boxed sub-area uses INSET.
//
// One radius step under the sheet's, so a box nested in a rounded-md box does not fight it. No
// background and no shadow: the sheet underneath already provides both.
export const PANEL = 'overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800'
export const PANEL_LIST = `divide-y divide-neutral-200 dark:divide-neutral-800 ${PANEL}`
export const INSET = 'rounded-lg border border-neutral-200 p-4 dark:border-neutral-800'

// Both scales live in `scale.ts` and are re-exported here, because thirty-eight screens
// already import them from the kit and the split is a fact about this file's length.
export { TAB_TRACK, SEGMENT_TRACK, tabItemClass, Tabs, type TabItem, type TabSize } from './tabs'
export {
  READING, TITLE, SECTION, SETTING_LABEL, NOTE_TEXT, NOTE, META, FIGURE,
  SECTION_GAP, CARD_GAP, CARD_STACK, HEADER_GAP, GROUP_GAP, CLUSTER_GAP, SETTING_GAP,
} from './scale'
import { HEADER_GAP, NOTE, NOTE_TEXT, SECTION, SETTING_LABEL, TITLE } from './scale'

// --- One setting ------------------------------------------------------------------------
//
// THE RULE, and it is the only one: a setting reads top to bottom as **what it is, what to know
// about it, then the control**. Never a hint under the control it explains, never a second note
// style beside the first, never a caller's own idea of the spacing between them. The screens
// drifted the moment it was implicit: the font pickers put their hint below the grid, the
// palette card carried a tinted callout AND a plain paragraph, and the gap between a label and
// its control was 0.5, 1 or 2 depending on the file. `NOTE` lives in `scale.ts`; `ui/Input`
// builds the same three parts from the same pieces.
/**
 * One setting whose control is not a plain text field: a picker grid, a switch, a button, a
 * row of them. Pass the control as children; the label and note are placed for you.
 *
 * `inline` is for a boolean: a 24px switch beside its label reads better than one stranded
 * on its own line, and it keeps a list of fifteen feature toggles scannable. The ORDER is
 * unchanged — label, note, control — it is only the wrap that differs.
 */
export function Setting({
  label,
  note,
  badge,
  inline = false,
  children,
  className = '',
}: {
  label?: ReactNode
  note?: ReactNode
  badge?: string
  inline?: boolean
  children: ReactNode
  className?: string
}) {
  const head = (
    <div className="min-w-0">
      {label && (
        <div className={`${SETTING_LABEL} flex items-center gap-2`}>
          {label}
          {badge && <code className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-normal text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">{badge}</code>}
        </div>
      )}
      {note && <p className={NOTE}>{note}</p>}
    </div>
  )
  if (inline) {
    /**
     * `flex-wrap` + `basis-48`, so the control drops to its own line rather than crushing the
     * sentence beside it — and WITHOUT a breakpoint, because the thing that decides is the
     * width of the control, not the width of the window.
     *
     * A 24px switch beside a label is comfortable at 390px and always stays put. A 230px
     * select is not: measured at 390 on the Appearance tab, "Default appearance" left its
     * note 215px to run in and seven lines to do it, with the space beside the select empty
     * underneath — the same hole the inline layout exists to close. The head refuses to go
     * under 12rem, so anything that cannot leave it that much wraps instead.
     */
    return (
      <div className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 ${className}`}>
        <div className="min-w-0 flex-1 basis-48">{head}</div>
        <div className="shrink-0 pt-0.5">{children}</div>
      </div>
    )
  }
  return (
    <div className={className}>
      {head}
      <div className={label || note ? 'mt-2.5' : ''}>{children}</div>
    </div>
  )
}

// Canonical form-control chrome — shared by admin <input> and <select> so height,
// padding, radius and focus never drift (they were hand-rolled + cramped before).
// `ui/Input.tsx` now IMPORTS this rather than declaring a matching copy, so there is nothing
// left to keep in step by hand. Callers add width (see FIELD_W).
//
// `min-h-10` and `py-2`, which is `ui/Button`'s height and not a rounder-looking `py-2.5`:
// the padding version measured 42px against the button's 40, so every field standing beside
// a button — Copy next to a token, Choose image next to a filename — sat two pixels proud of
// it. A form control and the button that acts on it are one row or they are nothing.
export const CONTROL =
  'min-h-10 rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-800 dark:placeholder:text-neutral-500'

/** The tick. No `accent-color` does not mean unstyled, it means the OS accent, which is BLUE, in
 *  an admin of black, white and neutrals. Five shipped so and the two that remembered disagreed
 *  — three ticks. This is the primary button's fill: a tick is ink, and there is one ink. */
/**
 * A tappable hit box around text that is only 16px tall.
 *
 * The quiet text buttons in this admin — Export CSV, Taxonomy, Check unused, Copy URL,
 * Delete — are `text-xs` with no padding, so their hit box is exactly the line box: 16px.
 * Measured on 2026-08-22 at 390, 768, 1024 and 1440: five screens, the same 16px, and iPad
 * is a touch device at every one of those widths. Apple asks for 44pt and Google for 48dp;
 * 16 is not a near miss.
 *
 * Padding PLUS the matching negative margin, so the box grows and the ink does not move: the
 * element's margin box stays the height it was, the row it sits in keeps its height, and
 * nothing on any of those screens shifts by a pixel. Making them visually bigger was the
 * other option and it is the wrong one — `docs/admin-design.md` puts these deliberately in
 * the quietest voice on the screen, and a hit box is not a voice.
 */
export const TAP = '-my-2 py-2'

export const CHECK = 'accent-neutral-900 dark:accent-white'

// A field whose CONTENT has a known size does not run to the edge of its card. A three-digit
// word count in a 580px box, a date in a 580px box and a site title in the same 580px box say
// the three are the same kind of answer, and they are not. Callers pick one; `w-full` stays
// the default for anything free-text.
export const FIELD_W = { short: 'w-28', medium: 'w-64', full: 'w-full' } as const

// Styled <select>: kills the OS-native arrow (`appearance-none`) and draws our own
// chevron, so a select matches the input chrome + the app font instead of the ugly
// browser-default dropdown. Auto-width by default; pass `wrapClassName="flex w-full"`
// + `className="w-full"` for a full-width field.
export function Select({
  className = '',
  wrapClassName = 'inline-flex',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { wrapClassName?: string }) {
  return (
    <span className={`relative ${wrapClassName}`}>
      <select {...props} className={`${CONTROL} cursor-pointer appearance-none pr-9 ${className}`}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 dark:text-neutral-400"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  )
}

// The "Reset to default" link, which three panels on the Appearance tab draw: both palette
// modes and the type scale. One component because it is one control — written out twice it
// had already drifted into two sizes of hit area, and the third copy was the one that ended
// up beside a note instead of on a title row.
export function ResetButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
    >
      {label}
    </button>
  )
}

// Card: a titled panel. `title` optional (stat-style panels pass none). `actions`
// renders on the right of the header row.
export function Card({
  title,
  actions,
  children,
  className = '',
  bodyClassName = '',
  panel = false,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /**
   * A PANEL is a card living INSIDE the one-sheet page (the admin-pages mock): one
   * radius step under the sheet's, hairline edges, its title on a ruled header row.
   * A card floating on the canvas keeps the sheet register; a box in a box does not.
   */
  panel?: boolean
}) {
  if (panel) {
    return (
      <section className={`rounded-lg border border-neutral-100 dark:border-neutral-800 ${className}`}>
        {(title || actions) && (
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
            {/* SECTION, not a hand-typed size. This read `text-[13px]`, which put every
              settings card's title below the labels inside it — see the note on SECTION. */}
          {title && <h2 className={SECTION}>{title}</h2>}
            {actions}
          </div>
        )}
        <div className={`p-4 ${bodyClassName}`}>{children}</div>
      </section>
    )
  }
  return (
    <section className={`${CARD} p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {title && <h2 className={SECTION}>{title}</h2>}
          {actions}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

// Page header: the one title block every admin screen uses (was a copy-pasted
// `<h1>` on each page). Optional description + right-aligned actions slot.
export function PageHeader({
  title,
  description,
  actions,
  className = '',
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`${HEADER_GAP} flex flex-wrap items-center justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h1 className={TITLE}>{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[0.8125rem] leading-[1.6] text-neutral-500 dark:text-neutral-400">{description}</p>}
      </div>
      {/* `flex-wrap`, not `shrink-0`: a wide action set (Analytics' 4 range pills +
          Export) is wider than a phone viewport and would otherwise push the page
          into horizontal scroll instead of dropping onto a second line. */}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// Empty / zero state — centered muted message, optional icon + action.
export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      {icon && <div className="mb-3 text-neutral-300 dark:text-neutral-600">{icon}</div>}
      {/* The title is a STATE ("No posts yet"), which is the machine talking, so it keeps the
          chrome font. The description explains the state in a sentence, and takes the other
          face — the same split as a label and its note. */}
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{title}</p>
      {description && <p className={`${NOTE_TEXT} mt-1.5 max-w-sm`}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// Table chrome — shared so the 4 admin tables stop re-declaring wrapper + head classes.
//
// TWO nested boxes, and the inner one is not decoration. The frame needs `overflow-hidden` or
// the table's corners square off the rounded-md sheet; but `overflow-hidden` on the ONLY box
// clips a table wider than the sheet with no way to reach the rest — measured at 390px, the
// analytics table ran to 426px and its last column sat past the viewport edge, unreachable, on
// every phone. The inner `overflow-x-auto` gives the overflow somewhere to go.
export const TABLE_FRAME = `overflow-hidden ${CARD}`
/** Goes between TABLE_FRAME and the table. Never let a table be the frame's direct child. */
export const TABLE_SCROLL = 'overflow-x-auto overscroll-x-contain [scrollbar-width:thin]'
// No fill on the head. `bg-neutral-50` behind the column names is the shadow's instinct again —
// a tint standing in for a rule — and it made a table read as a spreadsheet widget rather than
// a list. The rule under it already separates head from body. `text-xs` too: a column NAME is
// the smallest print on a page and it was set at the same size as the data under it.
export const THEAD =
  'whitespace-nowrap border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400'
export const TROW = 'border-b border-neutral-100 last:border-0 hover:bg-neutral-100/60 dark:border-neutral-800 dark:hover:bg-neutral-800/40'

export function TableFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${TABLE_FRAME} ${className}`}>
      <div className={TABLE_SCROLL}>
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}
