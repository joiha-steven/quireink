// The admin's primitives, as HTML the server sends (ADR 0054).
//
// Each one is the React component of the same name, wearing the same class strings from
// `@/admin-shared/kit` — not a copy of them. That is the whole discipline: `check:admin-kit`
// owns those strings and fails anything that re-types one, so the two faces of a card, a
// sheet, a field cannot drift apart while both exist.
//
// TEMPLATE STRINGS, not JSX, and it is a decision rather than an inconvenience. The root
// TypeScript project is configured for hono's JSX and nothing uses it: the reading site has
// rendered HTML by concatenation since it was written. ADR 0054's own consequence is that the
// admin *stops being a second kind of program* — one way to render a page — and adopting a
// second templating language for the admin alone would break that on the first screen.
//
// It grows one screen at a time, deliberately. A primitive arrives here when a converting
// screen needs it, with its reasoning; a speculative port of all forty would be forty class
// lists nobody has looked at on a screen.
import { escapeAttr, escapeHtml } from '@/utils'
import { ICONS, GLYPHS, type GlyphName, type IconName } from '@/icons'
import {
  CARD, CONTROL_SM, LAMP_HUES, LAMP_SHAPE, SHEET, SHEET_TOP,
  TICK_BOX, TICK_MARK, TICK_PATH, TICK_WRAP, type LampState,
} from '@/admin-shared/kit'
import {
  SEGMENT_TRACK, SEGMENT_TRACK_PLACE, tabItemClass, type TabRole, type TabSize,
} from '@/admin-shared/tabs'
import { FIGURE, HEADER_GAP, META, NOTE_TEXT, SECTION, TAP, TITLE } from '@/admin-shared/scale'

/** A glyph from the shared set, at the surface's own size. */
export const icon = (name: IconName, cls = 'h-[var(--admin-glyph,1.25rem)] w-[var(--admin-glyph,1.25rem)] shrink-0'): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"`
  + ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${cls}">${ICONS[name]}</svg>`

/**
 * A page's own name, once per screen.
 *
 * `actions` is raw HTML the caller has already escaped. `flex-wrap` and not `shrink-0`: a wide
 * action set is wider than a phone viewport and would otherwise push the page into horizontal
 * scroll instead of dropping onto a second line.
 *
 * ⚠️ `title` AND `description` ARE ESCAPED; `titleHtml` and `descriptionHtml` are the raw
 * doors beside them, and they exist because a drill-down's header is not a string: the
 * analytics detail puts a back link over the piece's name and the piece's address under it, as
 * a link out. Passing markup through `title` printed the anchor as visible text, which
 * compiles, renders and is wrong — the reason this pair is spelled out rather than left to the
 * caller's memory. Exactly one of each pair is honoured, the raw one first.
 */
export function pageHeader({ title = '', titleHtml = '', description = '', descriptionHtml = '', actions = '' }: {
  title?: string
  titleHtml?: string
  description?: string
  descriptionHtml?: string
  actions?: string
}): string {
  const name = titleHtml || escapeHtml(title)
  const note = descriptionHtml || (description ? escapeHtml(description) : '')
  return `<div class="${HEADER_GAP} flex flex-wrap items-center justify-between gap-4">`
    + `<div class="min-w-0"><h1 class="${TITLE}">${name}</h1>`
    + (note ? `<p class="mt-2 max-w-2xl text-[0.8125rem] leading-[1.6] text-neutral-500 dark:text-neutral-400">${note}</p>` : '')
    + `</div>`
    + (actions ? `<div class="flex flex-wrap items-center gap-2">${actions}</div>` : '')
    + `</div>`
}

/** The sheet a screen's content stands on, and its first row of tools. */
export const sheet = (body: string, attrs = ''): string => `<div class="${SHEET}"${attrs ? ` ${attrs}` : ''}>${body}</div>`
export const sheetTop = (body: string): string => `<div class="${SHEET_TOP}">${body}</div>`

/**
 * Empty / zero state: a picture, what the state is, and why.
 *
 * The drawing is two steps lighter than the sentence under it. A 96px drawing at text ink would
 * be the loudest thing on the screen, and what it has to say is that there is nothing here.
 *
 * `hidden` rather than left out, at the caller's option: a screen whose emptiness depends on a
 * filter draws every state once and lets CSS pick, the same way the rail does.
 */
export function emptyState({ title, description = '', glyph, hidden = false }: {
  title: string
  description?: string
  glyph?: GlyphName
  hidden?: boolean
}): string {
  return `<div class="flex flex-col items-center justify-center px-6 py-16 text-center"${hidden ? ' hidden' : ''}>`
    + (glyph
      ? `<div class="mb-5 text-neutral-300 dark:text-neutral-700">`
        // 48 units, not 24: the stroke has to stay a LINE at 96px, and the small set's 1.8 of
        // 24 would be 7.2px of ink here.
        + `<svg viewBox="0 0 48 48" class="h-24 w-24" fill="none" stroke="currentColor" stroke-width="1.1"`
        + ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[glyph]}</svg></div>`
      : '')
    // The title is a STATE ("Nothing yet"), which is the machine talking, so it keeps the
    // chrome font. The description explains it in a sentence and takes the other face.
    + `<p class="text-sm font-medium text-neutral-700 dark:text-neutral-300">${escapeHtml(title)}</p>`
    + (description ? `<p class="${NOTE_TEXT} mt-1.5 max-w-sm">${escapeHtml(description)}</p>` : '')
    + `</div>`
}

/**
 * A select, with the chevron the native control will not let us style.
 *
 * `appearance-none` plus an absolutely positioned mark, and the mark is `pointer-events-none`
 * so the click still reaches the field under it.
 */
export function select({ name, label, options, value, attrs = '' }: {
  name: string
  label: string
  options: [string, string][]
  value: string
  attrs?: string
}): string {
  return `<span class="relative inline-flex">`
    + `<select name="${escapeAttr(name)}" aria-label="${escapeAttr(label)}"${attrs ? ` ${attrs}` : ''}`
    + ` class="${CONTROL_SM} cursor-pointer appearance-none pr-9">`
    + options.map(([v, text]) =>
      `<option value="${escapeAttr(v)}"${v === value ? ' selected' : ''}>${escapeHtml(text)}</option>`).join('')
    + `</select>`
    + `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"`
    + ` stroke-linecap="round" stroke-linejoin="round"`
    + ` class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 dark:text-neutral-400">`
    + `${ICONS.down}</svg></span>`
}

/**
 * A STRIP OF KINDS, with every tab drawn and the current one marked.
 *
 * The React `Tabs` is a much larger thing: it measures its own overflow to fade the edge it
 * can scroll towards, it scrolls the chosen tab into view, and in a tablist it moves selection
 * with the arrow keys. None of that is here, and the ones that matter are the island's job —
 * this function draws the strip, and the screen that uses it says which of those behaviours it
 * wants. The trash's strip is not a tablist today and this keeps it as it was: buttons that
 * carry `aria-pressed`, which is what a filter is.
 *
 * `attrs` rides on the track and `key` becomes `data-tab` on each item, so an island can find
 * the strip and know what was pressed without a second dictionary.
 */
export function tabs({ items, value, role = 'place', attrs = '' }: {
  items: { key: string; label: string }[]
  value: string
  /**
   * A `place` is a tab you navigated to; a `choice` is a value you set. See `tabItemClass` for
   * the argument — the highlighter marks WHERE YOU ARE and nothing else, so a filter takes the
   * sunken paper key instead. The trash's kinds are places; the comments queue's sort and age
   * strips are choices.
   */
  role?: TabRole
  attrs?: string
}): string {
  return `<div class="${role === 'place' ? SEGMENT_TRACK_PLACE : SEGMENT_TRACK}"${attrs ? ` ${attrs}` : ''}>`
    + items.map(({ key, label }) =>
      `<button type="button" data-tab="${escapeAttr(key)}" aria-pressed="${key === value}"`
      + ` class="${tabItemClass(key === value, 'sm', false, role)}">${escapeHtml(label)}</button>`).join('')
    + `</div>`
}

/**
 * THE BAND OF NUMBERS at the head of a sheet: the figures somebody would otherwise work out by
 * scrolling. `n` and `label` are already-escaped text; `after`, `sub` and `labelHtml` are raw
 * HTML, as in the React `NumBand` they mirror.
 *
 * `labelHtml` is the raw door beside `label`, and it exists because one label on the subscriber
 * band is not a string: "Pending" carries the pen's own mark in front of it, the same mark the
 * write list puts against an unfinished piece. Exactly one of the pair is honoured, raw first.
 */
export function numBand(items: { n: string; label?: string; labelHtml?: string; after?: string; sub?: string }[]): string {
  return `<div class="flex flex-wrap border-b border-neutral-100 dark:border-neutral-800">`
    + items.map((it) =>
      `<div class="min-w-32 flex-1 border-r border-neutral-100 px-5 py-4 last:border-r-0 dark:border-neutral-800">`
      + `<span class="flex items-baseline gap-2">`
      + `<b class="text-2xl font-semibold tracking-tight tabular-nums">${escapeHtml(it.n)}</b>${it.after ?? ''}</span>`
      + `<span class="block text-xs text-neutral-500 dark:text-neutral-400">${it.labelHtml ?? escapeHtml(it.label ?? '')}</span>`
      + (it.sub ? `<span class="block text-xs text-neutral-500 dark:text-neutral-400">${it.sub}</span>` : '')
      + `</div>`).join('')
    + `</div>`
}

/**
 * The admin's checkbox: a real `input[type=checkbox]` with the platform widget removed and the
 * tick drawn over it. See `TICK_BOX` for why the box is not the browser's.
 *
 * `label` rather than a wrapping `<label>` element: every row that carries one of these names
 * the thing beside it already, and a second visible name is not what an unlabelled box needs.
 *
 * ⚠️ `className` LANDS ON THE WRAPPER, not on the box, and `attrs` lands on the box and may not
 * carry a class. It is `Tick`'s own rule for its own reason — a margin on the input moves the
 * 16px box out from under the 16px tick drawn over it — and here it is also a correctness one:
 * a class inside `attrs` would emit a second `class` attribute and the browser would keep the
 * first, which is to say none of the box's own styling.
 */
export function tick({ label, className = '', attrs = '' }: {
  label: string
  className?: string
  attrs?: string
}): string {
  return `<span class="${TICK_WRAP}${className ? ` ${className}` : ''}">`
    + `<input type="checkbox" aria-label="${escapeAttr(label)}"${attrs ? ` ${attrs}` : ''} class="${TICK_BOX}">`
    + `<svg viewBox="0 0 16 16" aria-hidden="true" class="${TICK_MARK}">`
    + `<path d="M4 8.4 6.6 11 12 5" fill="none" stroke-width="2" stroke-linecap="round"`
    + ` stroke-linejoin="round" class="${TICK_PATH}"/></svg></span>`
}

/**
 * A TITLED PANEL on the canvas — the React `Card` without its `panel` variant, which is the
 * one a screen uses inside a sheet and which no server-drawn screen has needed yet.
 *
 * `title` and `actions` are raw HTML the caller has escaped, because both carry markup on
 * every screen that uses them: a link out, a count, a progress bar.
 */
export function card({ title = '', actions = '', body, className = '', bodyClass = '' }: {
  title?: string
  actions?: string
  body: string
  className?: string
  bodyClass?: string
}): string {
  const head = title || actions
    ? `<div class="mb-5 flex items-center justify-between gap-3">`
      + (title ? `<h2 class="${SECTION}">${title}</h2>` : '')
      + actions + `</div>`
    : ''
  return `<section class="${CARD} p-5 sm:p-6${className ? ` ${className}` : ''}">`
    + head + `<div class="${bodyClass}">${body}</div></section>`
}

/** A tile inside a band: no edge of its own, the band's divider does that job. */
const BARE_TILE = 'px-5 py-4'

/**
 * A headline figure with its label under it, bare (inside a band) or on its own card.
 *
 * `value` and `label` are already-escaped text; `after` is raw HTML (the analytics trend
 * arrow, which sits inside the figure). With `href` the whole tile is a link, and the hover
 * darkens its own edge rather than lifting — a tile that rises and casts a shadow is the
 * dashboard costume `admin-design.md` took out.
 */
export function statCard({ label, value, sub = '', after = '', href = '', bare = false }: {
  label: string
  value: string
  sub?: string
  after?: string
  href?: string
  bare?: boolean
}): string {
  const inner = `<div class="flex items-start justify-between gap-2"><div class="${FIGURE}">${escapeHtml(value)}${after}</div></div>`
    + `<div class="${META} mt-2.5">${escapeHtml(label)}</div>`
    + (sub ? `<div class="${META} mt-1">${escapeHtml(sub)}</div>` : '')
  const shape = bare ? BARE_TILE : `${CARD} p-5`
  if (!href) return `<div class="${shape}">${inner}</div>`
  const hover = bare
    ? 'hover:bg-neutral-100/70 dark:hover:bg-neutral-800/40'
    : 'hover:border-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40'
  return `<a href="${escapeAttr(href)}" class="${shape} block transition ${hover}">${inner}</a>`
}

/**
 * The figures of a page as ONE BAND divided by hairlines, instead of five floating sheets.
 *
 * `divide-x` alone is wrong once the grid wraps — it skips only the very first child, so the
 * first cell of every later ROW keeps a left edge. The border goes on every cell and the
 * per-row firsts are cleared by column position, which is why the counts are spelled out.
 */
export const statBand = (tiles: string): string =>
  `<div class="${CARD} overflow-hidden grid grid-cols-2 divide-neutral-200 sm:grid-cols-3 lg:grid-cols-5 dark:divide-neutral-800
      [&>*]:border-l [&>*]:border-t [&>*]:border-neutral-200 dark:[&>*]:border-neutral-800
      [&>*:nth-child(-n+2)]:border-t-0 [&>*:nth-child(odd)]:border-l-0
      sm:[&>*:nth-child(-n+3)]:border-t-0 sm:[&>*:nth-child(odd)]:border-l sm:[&>*:nth-child(3n+1)]:border-l-0
      lg:[&>*]:border-t-0 lg:[&>*:nth-child(3n+1)]:border-l lg:[&>*:first-child]:border-l-0">${tiles}</div>`

/**
 * A STRIP OF LINKS, for a strip whose state lives in the address.
 *
 * The sibling of `tabs` above, and the difference is the whole reason both exist: that one
 * draws buttons an island presses, this one draws anchors the browser follows. The analytics
 * range strip cannot be buttons — `?range=30` has to survive a reload and be something the
 * owner can send to themselves — and a button that calls `location.assign` is a link with the
 * middle-click, the back button and the status bar taken away.
 *
 * `aria-current="page"` rather than `aria-pressed`: these are addresses, and a screen reader
 * that says "pressed" about the page you are already on is describing a control that is not
 * there. The class is the same `tabItemClass` either way, so the two strips cannot drift.
 */
export function linkTabs({ items, value, size = 'sm', role = 'choice', attrs = '' }: {
  items: { key: string; label: string; href: string }[]
  value: string
  size?: TabSize
  role?: TabRole
  attrs?: string
}): string {
  return `<div class="${role === 'place' ? SEGMENT_TRACK_PLACE : SEGMENT_TRACK}"${attrs ? ` ${attrs}` : ''}>`
    + items.map(({ key, label, href }) =>
      `<a href="${escapeAttr(href)}" data-tab="${escapeAttr(key)}"`
      + (key === value ? ' aria-current="page"' : '')
      + ` class="${tabItemClass(key === value, size, false, role)} whitespace-nowrap">${escapeHtml(label)}</a>`).join('')
    + `</div>`
}

/**
 * The pilot lamp: a small round mark that says whether a thing is working.
 *
 * `title` is the SENTENCE, and it is not decoration — colour never carries the message alone
 * here. With one the lamp is an `img` with that name; without one it is hidden from the
 * reading order entirely, because a mark nobody can name is noise in a screen reader.
 *
 * `pulse` is a slow breath for one meaning only: something that has not happened YET.
 * `admin.css` gates the keyframe behind the motion switch.
 *
 * `attrs` rides on the lamp ITSELF rather than on a wrapper around it, and that is measured
 * rather than tidy: an extra span holding the island's hook became a flex item of its own and
 * took the line-height, so the live strip's 8px mark sat in a 16px box and pushed the strip
 * open. The hook goes on the thing it hooks.
 */
export function lamp({ state, title = '', pulse = false, attrs = '' }: {
  state: LampState
  title?: string
  pulse?: boolean
  attrs?: string
}): string {
  const named = title
    ? ` role="img" aria-label="${escapeAttr(title)}" title="${escapeAttr(title)}"`
    : ' aria-hidden="true"'
  return `<span${attrs ? ` ${attrs}` : ''}${named}`
    + ` class="${LAMP_SHAPE} ${LAMP_HUES[state]}${pulse ? ' lamp-pulse' : ''}"></span>`
}

/**
 * "Clear · <extras> · Delete (n)", the bar a list raises once something is ticked.
 *
 * ⚠️ IT SHIPS HIDDEN AND THE ISLAND UNHIDES IT. The React `SelectionBar` returns null at a
 * count of zero, which is a thing the server cannot do and then change its mind about — so
 * both states are in the markup, as everywhere else under ADR 0054. This is the same shape
 * that has caught six tour flows: a flow that clicks "Delete selected (0)" is clicking a
 * control nobody can see.
 *
 * THE ORDER IS THE POINT. The one irreversible verb sits at the END of the row, where a hand
 * travelling left to right arrives at it last, and `extras` (export, and whatever a later list
 * adds) go before it for the same reason Cancel sits before Save everywhere else.
 *
 * `count` rides in a span of its own so the island writes a number rather than a sentence.
 */
export function selectionBar({ clearLabel, deleteLabel, attrs = '', extras = '' }: {
  clearLabel: string
  deleteLabel: string
  attrs?: string
  extras?: string
}): string {
  const quiet = `${TAP} text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white`
  return `<div${attrs ? ` ${attrs}` : ''} class="flex flex-wrap items-center justify-end gap-4" hidden>`
    + `<button type="button" data-pick-clear class="${quiet}">${escapeHtml(clearLabel)}</button>`
    + extras
    + `<button type="button" data-pick-delete`
    + ` class="${TAP} text-sm font-medium text-neutral-800 hover:text-black dark:text-neutral-200 dark:hover:text-white">`
    + `${escapeHtml(deleteLabel)} (<span data-pick-count>0</span>)</button></div>`
}
