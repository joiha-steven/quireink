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
  CONTROL_SM, LAMP_HUES, LAMP_SHAPE, SHEET, SHEET_TOOL, SHEET_TOOL_DANGER, SHEET_TOP,
  TICK_BOX, TICK_MARK, TICK_PATH, TICK_WRAP, buttonClass, type LampState,
} from '@/admin-shared/kit'
import { META } from '@/admin-shared/scale'
import {
  SEGMENT_TRACK, SEGMENT_TRACK_DENSE, SEGMENT_TRACK_DENSE_PLACE, SEGMENT_TRACK_PLACE, TAB_TRACK, TAB_TRACK_DENSE, edgeAt, tabItemClass, type TabRole, type TabSize,
} from '@/admin-shared/tabs'
import { HEADER_GAP, NOTE_TEXT, TITLE } from '@/admin-shared/scale'

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
export function emptyState({ title, description = '', glyph, actionHtml = '', hidden = false, attrs = '' }: {
  title: string
  description?: string
  glyph?: GlyphName
  /** One thing to do about it, already markup: the chips the assistant offers to ask for you. */
  actionHtml?: string
  hidden?: boolean
  /**
   * A hook, for the ones an island shows and hides.
   *
   * ⚠️ IT EXISTS SO NOTHING HAS TO WALK SIBLINGS TO FIND ONE. The activity log reached its
   * no-match box as `[data-log-list]`'s `previousElementSibling`, which is a selector that
   * breaks the day anything is drawn between them and breaks silently — the box simply stops
   * appearing, and a filter that matches nothing goes back to showing a blank panel.
   */
  attrs?: string
}): string {
  return `<div class="flex flex-col items-center justify-center px-6 py-16 text-center"`
    + `${attrs ? ` ${attrs}` : ''}${hidden ? ' hidden' : ''}>`
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
    + (actionHtml ? `<div class="mt-4">${actionHtml}</div>` : '')
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
export function tabs({
  items, value, role = 'place', tablist = false, panelId = '', attrs = '',
  size = 'sm', dense = false,
}: {
  items: { key: string; label: string }[]
  value: string
  /**
   * `sm` is the segmented track — a strip of keys in a sunken well. `lg` is the UNDERLINED
   * strip, a marker stroke under the label rather than a wash behind it.
   *
   * It defaults to `sm` because that is what every server-drawn strip has wanted so far, and
   * `lg dense` exists because the write column asked for it: four words 24px apart do not fit a
   * 288px column, so the gap closes to 16 and the type steps to 13px. Drawing that column with
   * the segmented track was the first cut, and it read as a different control from the one it
   * replaced — caught by photographing the two builds side by side (2026-09-15).
   */
  size?: TabSize
  /** A tighter strip, for a 320px pane. Neither size wraps when dense. */
  dense?: boolean
  /**
   * A REAL TABLIST: `role=tab` in a `role=tablist`, ONE keyboard stop, and the arrows walking
   * the strip.
   *
   * Off by default, because most strips in this admin are filters rather than places and a
   * filter announcing itself as a tab is a lie a screen reader repeats. The settings strip is
   * the one that is genuinely a tablist, and it was one in React: seven tabs and a single stop,
   * so Tab reaches the PANEL instead of walking seven buttons to get there.
   */
  tablist?: boolean
  /**
   * The PREFIX of the panel each tab controls — `<panelId>-<key>` — so the strip and the paper
   * under it are linked both ways.
   *
   * A prefix rather than one id, because a screen that draws every panel at once has seven of
   * them: one `aria-controls` pointing at a container holding all seven says the whole stack is
   * one panel, which is what a screen reader would then read out.
   */
  panelId?: string
  /**
   * A `place` is a tab you navigated to; a `choice` is a value you set. See `tabItemClass` for
   * the argument — the highlighter marks WHERE YOU ARE and nothing else, so a filter takes the
   * sunken paper key instead. The trash's kinds are places; the comments queue's sort and age
   * strips are choices.
   */
  role?: TabRole
  attrs?: string
}): string {
  const track = size === 'lg'
    ? (dense ? TAB_TRACK_DENSE : TAB_TRACK)
    : dense
      ? (role === 'place' ? SEGMENT_TRACK_DENSE_PLACE : SEGMENT_TRACK_DENSE)
      : (role === 'place' ? SEGMENT_TRACK_PLACE : SEGMENT_TRACK)
  return `<div class="${track}"${tablist ? ' role="tablist"' : ''}${attrs ? ` ${attrs}` : ''}>`
    + items.map(({ key, label }, i) => {
      const on = key === value
      // ROVING: exactly one tab is a keyboard stop. Seven stops would make Tab walk the strip
      // before it ever reached the paper the strip is about.
      const tab = tablist
        ? ` role="tab" aria-selected="${on}" tabindex="${on ? '0' : '-1'}"`
          + (panelId ? ` aria-controls="${escapeAttr(`${panelId}-${key}`)}"` : '')
        : ` aria-pressed="${on}"`
      return `<button type="button" data-tab="${escapeAttr(key)}"${tab}`
        + ` class="${tabItemClass(on, size, dense, role, edgeAt(i, items.length))}">${escapeHtml(label)}</button>`
    }).join('')
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
    + items.map(({ key, label, href }, i) =>
      `<a href="${escapeAttr(href)}" data-tab="${escapeAttr(key)}"`
      + (key === value ? ' aria-current="page"' : '')
      + ` class="${tabItemClass(key === value, size, false, role, edgeAt(i, items.length))}`
      + ` whitespace-nowrap">${escapeHtml(label)}</a>`).join('')
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
  // ⚠️ THE KIT'S OWN TOOLS, and the delete one in RED. Until 2026-09-16 this bar hand-typed a
  // near-miss of both: `text-sm` where `SHEET_TOOL` is `text-xs`, and a bold `neutral-800` for
  // the delete where `SHEET_TOOL_DANGER` exists for exactly this. The cost was visible on ONE
  // screen: the media library's Images tab draws its own action row from the kit, so Delete
  // selected was red at 12px there and neutral at 14px on the Files and Videos tabs beside it.
  // `SHEET_TOOL_DANGER`'s own note records the same fault being fixed in the Trash.
  return `<div${attrs ? ` ${attrs}` : ''} class="flex flex-wrap items-center justify-end gap-4" hidden>`
    + `<button type="button" data-pick-clear class="${SHEET_TOOL}">${escapeHtml(clearLabel)}</button>`
    + extras
    + `<button type="button" data-pick-delete class="${SHEET_TOOL_DANGER}">`
    + `${escapeHtml(deleteLabel)} (<span data-pick-count>0</span>)</button></div>`
}

/**
 * THE WAY TO THE NEXT PAGE, and it is three links rather than an island.
 *
 * Turning a page is a navigation: the address says which page, the server draws it, and Back
 * goes back a page the way it does everywhere else. An island would have had to BUILD a row or
 * a tile, and a row built in the browser is a second copy of the server's own drawing, drifting
 * from it in silence. Three screens share this one, so they cannot disagree about what a pager
 * looks like either.
 *
 * ⚠️ THE LINK CARRIES ITS OWN TAB. On every screen that has one, switching tabs is an attribute
 * rather than a navigation, so the address can be sitting on one kind while somebody is looking
 * at another. A pager that wrote only `page=` would turn the page of the wrong one.
 *
 * Nothing at all when there is one page, which is the usual case: a pager under a list of nine
 * is an offer to go nowhere.
 */
export function pager(
  t: { pagerPrev: string; pagerNext: string; pagerOf: string },
  screen: string, tab: string, at: number, pages: number,
): string {
  if (pages <= 1) return ''
  const href = (n: number) => `${screen}?tab=${tab}${n > 1 ? `&page=${n}` : ''}`
  const step = (n: number, label: string, live: boolean) => live
    ? `<a href="${escapeAttr(href(n))}" class="${buttonClass('secondary')}">${escapeHtml(label)}</a>`
    // Drawn and dead rather than absent: a pager whose keys move as you reach the ends is a
    // pair of buttons that will not stay under the pointer.
    : `<span aria-disabled="true" class="${buttonClass('secondary')} pointer-events-none opacity-50">`
      + `${escapeHtml(label)}</span>`
  return `<nav class="flex items-center justify-center gap-3 pt-6 pb-2" data-pager="${escapeAttr(tab)}">`
    + step(at - 1, t.pagerPrev, at > 1)
    + `<span class="${META} tabular-nums">`
    + `${escapeHtml(t.pagerOf.replace('{n}', String(at)).replace('{total}', String(pages)))}</span>`
    + step(at + 1, t.pagerNext, at < pages)
    + `</nav>`
}
