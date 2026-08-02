// Admin UI kit — ONE source of truth for the shared chrome so no page hand-rolls
// its own card/header/tabs/table and they can never drift again (radius, padding,
// shadow, header size were all inconsistent before). Admin is monochrome by design
// (neutral scale, no public theme tokens). No `'use client'`: these are presentational
// — pure primitives render in server OR client trees; Tabs only takes props.
import Link from '@/admin/router'
import type { ReactNode, SelectHTMLAttributes } from 'react'

// Canonical card surface. ONE radius + border + shadow for every admin panel.
export const CARD =
  'rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.035)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none'

// --- The two gaps -------------------------------------------------------------------------
//
// TWO numbers for the whole admin, and they are here because there were four. One Overview
// column measured 12px between the stat tiles, 16px inside the widget group, 20px between the
// widget cards and 28px between the page's sections, which reads as a page assembled from
// four screens rather than as one grid.
//
// SECTION_GAP separates the bands of a page (header, tiles, widgets, table). CARD_GAP is the
// space between two cards SIDE BY SIDE or stacked within one band. Anything that wants a
// third number wants one of these two.
export const SECTION_GAP = 'space-y-7'
export const CARD_GAP = 'gap-5'
export const CARD_STACK = 'space-y-5'

// The two surfaces that sit INSIDE a card, both hand-written in several places before
// they were named here. A settings page is a Card holding a PANEL_LIST of rows; a row that
// needs its own boxed sub-area uses INSET.
//
// `rounded-xl`, not the card's `rounded-2xl`: a box nested inside a rounded box needs the
// smaller radius or the two curves fight. No background and no shadow, because the card
// underneath already provides both.
export const PANEL = 'overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800'
export const PANEL_LIST = `divide-y divide-neutral-200 dark:divide-neutral-800 ${PANEL}`
export const INSET = 'rounded-xl border border-neutral-200 p-4 dark:border-neutral-800'

// --- One setting ------------------------------------------------------------------------
//
// THE RULE, and it is the only one: a setting reads top to bottom as **what it is, what to
// know about it, then the control**. Never a hint under the control it explains, never a
// second note style beside the first, never a caller's own idea of the spacing between them.
//
// It is a rule because the screens drifted the moment it was left implicit: the font pickers
// put their hint below the grid, the palette card carried a tinted callout AND a plain
// paragraph saying related things, and the gap between a label and its control was 0.5, 1 or
// 2 depending on the file. Reading a settings page meant re-learning where to look in every
// card.
//
// `SETTING_LABEL` and `NOTE` are exported because `ui/Input.tsx` builds the same three parts
// for a text field and the two must not drift apart.
export const SETTING_LABEL = 'block text-sm font-medium text-neutral-800 dark:text-neutral-200'
export const NOTE = 'mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400'

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
          {badge && <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-normal text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">{badge}</code>}
        </div>
      )}
      {note && <p className={NOTE}>{note}</p>}
    </div>
  )
  if (inline) {
    return (
      <div className={`flex items-start justify-between gap-4 ${className}`}>
        {head}
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

/** The gap between two settings inside one card. One number, so no card invents its own. */
export const SETTING_GAP = 'space-y-5'

// The status bar both editors put above the form (scheduled-for, unsaved-changes and the
// like). Tinted rather than white so it reads as a message about the page, not part of it.
export const NOTICE =
  'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900'

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
  'min-h-10 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500 dark:focus:ring-neutral-800 dark:placeholder:text-neutral-500'

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
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
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
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`${CARD} p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">{title}</h2>}
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
    <div className={`mb-7 flex flex-wrap items-center justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-neutral-950 dark:text-white">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">{description}</p>}
      </div>
      {/* `flex-wrap`, not `shrink-0`: a wide action set (Analytics' 4 range pills +
          Export) is wider than a phone viewport and would otherwise push the page
          into horizontal scroll instead of dropping onto a second line. */}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// Tabs — a segmented control on a tinted track, and there is ONE of it.
//
// There used to be two variants and a hand-rolled third. `variant='segment'` was never called
// from anywhere; `variant='underline'` was called from all four tab strips and did not draw an
// underline, so the name described a design that had been replaced and the two variants
// differed only in the shade of their track. Meanwhile the Content page's All/Published/Draft
// filter was a copy of this markup with `px-3 py-1.5` instead of `px-4 py-2` — the same
// control, 40px tall, four pixels short of the tab strip directly above it, with no
// `aria-pressed` and no hover state.
//
// `size` is the one real difference, and it is a size rather than a style: a tab strip that
// names a SECTION of the page is the page's own navigation, and a filter inside a section is
// subordinate to it. Both are the same object at two scales.
export type TabItem<K extends string = string> = { key: K; label: ReactNode }
export type TabSize = 'lg' | 'sm'

// The track and the item, separately, because Analytics' range control is made of LINKS: the
// range lives in the URL, so it cannot be a `<Tabs>` with an `onChange`. It had its own copy
// of this markup, one padding step off and with a different hover, which is how the same
// control came to look like two. A link-driven strip wears these two and gets the tab strip
// it was imitating.
export const TAB_TRACK = 'flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-neutral-200/70 p-1 dark:bg-neutral-800'

export const tabItemClass = (active: boolean, size: TabSize = 'lg'): string =>
  `rounded-lg text-sm font-medium transition ${size === 'lg' ? 'px-4 py-2' : 'px-3 py-1.5'} ${
    active
      ? 'bg-white text-neutral-950 shadow-sm dark:bg-neutral-700 dark:text-white'
      : 'text-neutral-500 hover:bg-white/60 hover:text-neutral-900 dark:hover:bg-neutral-700/60 dark:hover:text-neutral-200'
  }`

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  size = 'lg',
  className = '',
}: {
  tabs: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  size?: TabSize
  className?: string
}) {
  return (
    <div className={`${TAB_TRACK} ${className}`}>
      {tabs.map((tb) => (
        <button
          key={tb.key}
          type="button"
          onClick={() => onChange(tb.key)}
          aria-pressed={value === tb.key}
          className={tabItemClass(value === tb.key, size)}
        >
          {tb.label}
        </button>
      ))}
    </div>
  )
}

// A headline figure with its label under it. ONE of these, used by the Overview tiles, the
// Analytics tiles and the newsletter counts — `analytics-kit`'s `StatTile` was a second copy
// of the same twelve classes that had already drifted by one shade on its sub-line.
//
// Optional `icon`, `sub` line, `after` (the analytics trend arrow, which sits inside the
// figure) and `href` (wraps the whole tile in a link with a hover lift).
export function StatCard({
  label,
  value,
  sub,
  icon,
  after,
  href,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  after?: ReactNode
  href?: string
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[1.65rem] font-semibold tracking-tight tabular-nums">{value}{after}</div>
        {icon && <span className="text-neutral-300 dark:text-neutral-600">{icon}</span>}
      </div>
      <div className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{sub}</div>}
    </>
  )
  if (href) {
    return (
      <Link href={href} className={`${CARD} block p-5 transition duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:hover:border-neutral-700 dark:hover:bg-neutral-800/40`}>
        {inner}
      </Link>
    )
  }
  return <div className={`${CARD} p-5`}>{inner}</div>
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
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// Table chrome — shared so the 4 admin tables stop re-declaring wrapper + head
// classes. `TableFrame` is the rounded, bordered surface; `TH`/`TD` standardize cells.
//
// TWO nested boxes, and the inner one is not decoration. The frame needs
// `overflow-hidden` or the table's corners square off the rounded card. But
// `overflow-hidden` on the ONLY box means a table wider than the card is clipped with no
// way to reach the rest: measured at 390px, the analytics table ran to 426px and its last
// column (scroll depth) sat entirely past the viewport edge, unreachable, on every phone.
// The inner `overflow-x-auto` gives that overflow somewhere to go while the outer box
// keeps the corners.
export const TABLE_FRAME = `overflow-hidden ${CARD}`
/** Goes between TABLE_FRAME and the table. Never let a table be the frame's direct child. */
export const TABLE_SCROLL = 'overflow-x-auto overscroll-x-contain [scrollbar-width:thin]'
export const THEAD =
  'whitespace-nowrap border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'
export const TROW = 'border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40'

export function TableFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${TABLE_FRAME} ${className}`}>
      <div className={TABLE_SCROLL}>
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}
