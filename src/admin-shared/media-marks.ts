// ONE TILE IN THE MEDIA GRID, written once for the two places that draw it.
//
// The server draws the library page; the island draws the picker, which opens over whatever
// screen asked for a picture and is filled from `/api/media` when it opens. Written twice they
// would drift, and this is the one object in the admin where that would be loudest: eighteen of
// them to a screen, and the only difference between the two would be which page you were on.
// So the shape is data (`admin-shared/markup.ts`) and the two renderers walk it.
//
// THE TILE, AND WHY IT IS THIS ONE. Every picture used to be cropped to 3:2 with
// `object-cover`, and a manuscript page and a wide landscape are not the same shape — forcing
// both through one letterbox threw away the half of a tall image that tells you WHICH image it
// is. The tile is square, the picture is `object-contain`, and nothing is cut. The actions were
// three white words on a black gradient washed across the bottom of the picture: the stock
// photo-app costume, the darkest thing in an admin built from paper and hairlines, painted over
// the one thing the screen exists to show. What replaces it is the grammar the rest of the
// admin already uses — the picture sits in a TRAY that is carved, and the actions are small
// RAISED keys. No black anywhere.
import { el, leaf, type Mark } from '@/admin-shared/markup'
import { TICK_BOX, TICK_MARK, TICK_PATH, TICK_WRAP } from '@/admin-shared/kit'
import type { IconName } from '@/icons'

export type MediaRow = {
  url: string
  filename: string
  size: number
  uploadedAt: string
  width?: number
  height?: number
  thumb?: string
  alt?: string
}

/** Everything a tile can have to say, so neither face has to carry a translation table. */
export type MediaWords = {
  copyUrl: string; download: string; delete: string; unusedBadge: string
}

/**
 * A key laid ON a picture: white, raised, and pressed the way every other key in this admin is
 * pressed. It carries its own ground and a top lip bright enough to read over a photograph,
 * because it is the one place in the admin where a control stands on an image it does not own.
 *
 * `tap-touch` gives a finger 44px without moving the key or covering the picture. Measured
 * 2026-09-07: these three were 28 × 28 on a phone.
 */
const KEY = 'tap-touch grid h-7 w-7 place-items-center rounded-md bg-white/95 text-neutral-600'
  + ' backdrop-blur-[2px] transition'
  + ' shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_1px_2px_rgba(0,0,0,.3)]'
  + ' hover:text-neutral-900 hover:shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_2px_4px_rgba(0,0,0,.32)]'
  + ' active:translate-y-px active:duration-0 active:shadow-[inset_0_2px_3px_rgba(0,0,0,.25)]'
  + ' motion-reduce:active:translate-y-0'
  + ' dark:bg-neutral-900/95 dark:text-neutral-300 dark:hover:text-white'

/**
 * The tray, in its three states.
 *
 * It was one flat state with a RING when chosen. A ring is drawn AROUND a thing; this admin's
 * grammar says a chosen thing is pressed INTO the page, and a picture in a tray is the most
 * literal case of it there is. So hovering deepens the tray a little and choosing deepens it
 * properly, with the ink edge kept because eighteen pale trays need one that is unmistakable.
 */
const TRAY = 'relative aspect-square select-none overflow-hidden rounded-lg transition group-active:duration-0'
const IDLE = 'bg-neutral-100/70 ring-1 ring-inset ring-black/[.07]'
  + ' group-hover:bg-neutral-200/70 group-hover:shadow-[inset_0_1.5px_3px_rgba(0,0,0,.10)]'
  + ' group-active:shadow-[inset_0_2px_5px_rgba(0,0,0,.16)]'
  + ' dark:bg-neutral-800/50 dark:ring-white/10 dark:group-hover:bg-neutral-800'
  + ' dark:group-hover:shadow-[inset_0_1.5px_3px_rgba(0,0,0,.45)]'
const ON = 'bg-neutral-200 ring-2 ring-inset ring-neutral-900 shadow-[inset_0_2px_6px_rgba(0,0,0,.22)]'
  + ' dark:bg-neutral-700 dark:ring-white dark:shadow-[inset_0_2px_6px_rgba(0,0,0,.5)]'

/** Shown on touch, waited for on a pointer: a library is scrolled far more than it is acted on. */
const ON_HOVER = 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'

/**
 * The tray's two faces and the tick's two, EXPORTED, because choosing a picture happens in the
 * browser and the island has to be able to say so.
 *
 * Two class strings that the island swaps, rather than a CSS rule keyed on `:checked` — the
 * tray's chosen face is a Tailwind colour with a dark variant plus two shadows, and writing
 * that by hand in `admin.css` is a second copy of three tokens. `:has()` would have been the
 * other way and it takes Safari down (`docs/admin-one-dom.md`).
 */
export const TRAY_IDLE = `${TRAY} ${IDLE}`
export const TRAY_ON = `${TRAY} ${ON}`
export const TICK_HOLD = 'absolute left-1.5 top-1.5 z-20 flex h-8 w-8 -translate-x-1 -translate-y-1'
  + ' cursor-pointer items-center justify-center'
export const TICK_HOLD_ON = `${TICK_HOLD} opacity-100`
export const TICK_HOLD_OFF = `${TICK_HOLD} ${ON_HOVER}`

const CHIP = 'absolute z-10 rounded-md bg-white/95 px-1.5 py-0.5 text-xs text-neutral-600'
  + ' shadow-[0_1px_2px_rgba(0,0,0,.22)] backdrop-blur-[2px] dark:bg-neutral-900/95 dark:text-neutral-300'

/** The shared glyph set, at the size a key on a picture wants. */
const glyph = (name: IconName): Mark => ({
  tag: 'svg',
  cls: 'h-4 w-4',
  attrs: {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
    'data-glyph': name,
  },
  kids: [],
})

/** The drawn tick, which stands on a PICTURE and so brings its own ground and hairline. */
const tick = (row: MediaRow, on: boolean): Mark =>
  // The LABEL carries the hit area, not the tick: padding on an `input[type=checkbox]` is
  // ignored by the browser — the native widget draws at its border box — so a 16px tick stayed
  // a 16px target on a phone. The whole 32px square is the control.
  el('label', on ? TICK_HOLD_ON : TICK_HOLD_OFF, [
    el('span', TICK_WRAP, [
      { tag: 'input', cls: TICK_BOX, attrs: {
        type: 'checkbox', 'data-pick': row.url, 'aria-label': row.filename, ...(on ? { checked: '' } : {}),
      } },
      el('svg', TICK_MARK, [leaf('path', TICK_PATH, '', {
        d: 'M4 8.4 6.6 11 12 5', fill: 'none', 'stroke-width': '2',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      })], { viewBox: '0 0 16 16', 'aria-hidden': 'true' }),
    ]),
  ])

export type TileState = {
  /** `page` gets the three keys and the zoom; `picker` gets neither. */
  mode: 'page' | 'picker'
  /** A tick shows on the library always, and in the picker only when it takes several. */
  tickable: boolean
  selected?: boolean
  /** Marked by the "check unused" sweep; the chip is the only thing that reads it. */
  unused?: boolean
  /** Already formatted, because bytes and dates are the caller's language, not this file's. */
  sizeLabel: string
  title: string
}

/** One tile: the picture, the selection tick, the hover actions, the caption. */
export function mediaTileMark(row: MediaRow, w: MediaWords, s: TileState): Mark {
  const inside: Mark[] = [
    el('button', 'absolute inset-0 block', [
      // The padding is the mount a print gets, and it is what keeps a white-edged scan from
      // bleeding into the tray it sits in.
      { tag: 'img', cls: 'h-full w-full object-contain p-1.5', attrs: {
        src: row.thumb ?? row.url, alt: row.filename, loading: 'lazy', decoding: 'async',
      } },
    ], { type: 'button', 'data-open': row.url, 'aria-label': row.filename }),
  ]
  if (s.tickable) inside.push(tick(row, Boolean(s.selected)))
  // A finding, not an alarm: it reads as a note laid on the corner of the print.
  inside.push(leaf('span', `${CHIP} bottom-1.5 left-1.5 font-medium`, w.unusedBadge, {
    'data-unused': '', ...(s.unused ? {} : { hidden: '' }),
  }))
  // The size, where it costs the NAME nothing. Beside the name it took a third of a 190px
  // caption and cut `gutenberg-bible-epistle.jpg` to `gutenberg-bible-ep…`, which is the half
  // of the line that is actually looked for.
  inside.push(leaf('span', `${CHIP} bottom-1.5 right-1.5 tabular-nums transition-opacity ${ON_HOVER}`, s.sizeLabel))

  if (s.mode === 'page') {
    // Three keys, not three words. The labels did not fit on one line on a 390px phone, so the
    // row wrapped and the band grew a second storey. A 28px key is the same target at every
    // width and carries no line to break.
    inside.push(el('div', `absolute right-1.5 top-1.5 z-10 flex gap-1 transition-opacity duration-150 ${ON_HOVER}`, [
      el('button', KEY, [glyph('copy')], { type: 'button', 'data-copy': row.url, title: w.copyUrl, 'aria-label': w.copyUrl }),
      el('a', KEY, [glyph('download')], { href: row.url, download: row.filename, title: w.download, 'aria-label': w.download }),
      el('button', `${KEY} hover:text-[var(--pen-red)] dark:hover:text-[var(--pen-red)]`, [glyph('trash')],
        { type: 'button', 'data-del': row.url, title: w.delete, 'aria-label': w.delete }),
    ]))
  }

  return el('figure', 'group relative', [
    el('div', s.selected ? TRAY_ON : TRAY_IDLE, inside, { 'data-tray': '' }),
    // One line, and the whole width of the tile for the one thing you are looking for.
    // Dimensions, size and date are all a hover or a title away.
    leaf('figcaption', 'mt-1.5 truncate text-xs text-neutral-700 dark:text-neutral-300',
      row.filename, { title: s.title }),
  ], {
    'data-media': row.url,
    'data-name': row.filename.toLowerCase(),
    'data-size': String(row.size),
    'data-at': String(Date.parse(row.uploadedAt) || 0),
    // The DESCRIPTION, which is not the filename. It is what the editor takes as a picture's
    // default alt text when one is chosen in the picker, and reading it off the `<img>` would
    // hand the editor `plate-14.jpg` instead — the tile's `alt` is the filename, deliberately,
    // because a library is scanned by name.
    ...(row.alt ? { 'data-alt': row.alt } : {}),
  })
}
