// One tile in the media grid: the picture, the selection tick, the hover actions, the caption.
//
// Split out of `MediaLibrary.tsx` on 2026-08-22, when that file crossed its 400-line ceiling.
// The seam is the obvious one: everything here is about ONE item, and nothing here knows
// about paging, filtering, uploading or the zoom overlay, which is the rest of that file.
//
// The four callbacks are already bound to this item by the caller, so nothing in here has to
// know its own url — which is also what stops a handler being wired to the wrong row.
//
// REDRAWN 2026-08-31, because the grid was the one screen in the admin nobody had looked at:
//
//   · Every picture was cropped to 3:2 with `object-cover`. A manuscript page and a wide
//     landscape are not the same shape, and forcing both through one letterbox threw away
//     the half of a tall image that tells you WHICH image it is. A library you cannot
//     recognise a picture in is not a library. Now the tile is square, the picture is
//     `object-contain`, and nothing is cut.
//   · The actions sat on a black gradient washed across the bottom of the picture, with
//     three white words on it that wrapped to two lines on a narrow tile. That band is the
//     stock photo-app costume, it is the darkest thing in an admin built from paper and
//     hairlines, and it painted over the one thing the screen exists to show.
//   · Every tile was a bordered box holding a picture plus TWO lines of small grey type —
//     eighteen boxes to a screen, and the second line truncated mid-date (`08/…`) so the
//     noise was not even legible. One line now, and the size kept because it is one of the
//     three sorts.
//
// What replaces the band is the grammar the rest of the admin already uses: the picture sits
// in a TRAY that is carved (a hairline pressed in, because a tray holds), and the actions are
// small RAISED keys (because a key is pressed). No black anywhere.
import { memo } from 'react'
import type { MediaItem, SiteLang } from '@/types'
import type { IconName } from '@/icons'
import { formatBytes } from '@/utils'
import { formatDate } from '@/i18n/i18n'
import { useAdminT } from './I18nProvider'
import { SharedGlyph } from './navIcons'
import { Tick } from '@/admin/ui/Tick'

/**
 * A key laid ON a picture: white, raised, and pressed the way every other key in this admin
 * is pressed. It is defined here rather than in the kit because it is the only place in the
 * admin where a control has to stand on an image it does not own — it cannot take the paper
 * behind it for granted, which is why it carries its own ground and a top lip bright enough
 * to read over a photograph.
 */
const KEY =
  'grid h-7 w-7 place-items-center rounded-md bg-white/95 text-neutral-600 backdrop-blur-[2px] transition '
  + 'shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_1px_2px_rgba(0,0,0,.3)] '
  + 'hover:text-neutral-900 hover:shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_2px_4px_rgba(0,0,0,.32)] '
  + 'active:translate-y-px active:duration-0 active:shadow-[inset_0_2px_3px_rgba(0,0,0,.25)] '
  + 'motion-reduce:active:translate-y-0 '
  + 'dark:bg-neutral-900/95 dark:text-neutral-300 dark:hover:text-white'

/**
 * The tray, in its three states.
 *
 * It was one flat state: a hairline, and a RING when chosen. A ring is drawn around a thing;
 * this admin's grammar says a chosen thing is pressed INTO the page, and a picture in a tray
 * is the most literal case of it there is. So hovering deepens the tray a little and choosing
 * deepens it properly, with the ink edge kept because eighteen pale trays need one that is
 * unmistakable at a glance. Pressing lands at once, as every press in this product does.
 */
const TRAY = 'relative aspect-square select-none overflow-hidden rounded-lg transition group-active:duration-0'
const TRAY_IDLE =
  'bg-neutral-100/70 ring-1 ring-inset ring-black/[.07] '
  + 'group-hover:bg-neutral-200/70 group-hover:shadow-[inset_0_1.5px_3px_rgba(0,0,0,.10)] '
  + 'group-active:shadow-[inset_0_2px_5px_rgba(0,0,0,.16)] '
  + 'dark:bg-neutral-800/50 dark:ring-white/10 dark:group-hover:bg-neutral-800 '
  + 'dark:group-hover:shadow-[inset_0_1.5px_3px_rgba(0,0,0,.45)]'
const TRAY_ON =
  'bg-neutral-200 ring-2 ring-inset ring-neutral-900 shadow-[inset_0_2px_6px_rgba(0,0,0,.22)] '
  + 'dark:bg-neutral-700 dark:ring-white dark:shadow-[inset_0_2px_6px_rgba(0,0,0,.5)]'

/** Shown on touch, waited for on a pointer: a library is scrolled far more than it is acted on. */
const ON_HOVER = 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'

const Glyph = ({ name }: { name: IconName }) => (
  <svg
    viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden
  >
    <SharedGlyph name={name} />
  </svg>
)

/**
 * MEMOISED, and the callbacks below take the item rather than arriving bound to it.
 *
 * Bound callbacks were the original design and the reason was sound: a handler that cannot
 * see a url cannot be wired to the wrong row. The cost only showed up with a real library —
 * a new closure per card per render means every card is a new element, so ticking ONE box in
 * a grid of seventy-eight re-rendered all seventy-eight, and the tick lagged behind the
 * finger. The safety is kept a different way: a card only ever passes its OWN `m`.
 */
export const MediaCard = memo(function MediaCard({
  m, mode, multi, selected, lang, unused, onOpen, onToggle, onCopy, onDelete,
}: {
  m: MediaItem
  mode: 'page' | 'picker'
  multi: boolean
  selected: boolean
  lang: SiteLang
  /** Marked by the "check unused" sweep; the chip is the only thing that reads it. */
  unused: boolean
  onOpen: (m: MediaItem) => void
  /** `shift` asks for the run from the last box ticked to this one. */
  onToggle: (url: string, shift: boolean) => void
  onCopy: (url: string) => void
  onDelete: (url: string) => void
}) {
  const t = useAdminT()
  const dims = m.width && m.height ? `${m.width}×${m.height} · ` : ''
  const full = `${dims}${formatBytes(m.size)} · ${formatDate(m.uploadedAt, lang)}`
  const showTick = mode === 'page' || multi
  return (
    <figure className="group relative">
      {/* The tray. Carved rather than boxed: a hairline pressed into the paper says the
          picture is HELD here, where a border drawn around picture AND caption made the
          grid a tray of boxes — the costume `kit.tsx` argues against for exactly this
          reason. Chosen goes one step down and takes an ink edge, like every other
          chosen thing in this admin. */}
      <div
        className={`${TRAY} ${selected ? TRAY_ON : TRAY_IDLE}`}
      >
        <button
          type="button"
          // Page mode: click to zoom. Picker: click to select (toggle in multi).
          onClick={() => onOpen(m)}
          aria-label={m.filename}
          className="absolute inset-0 block"
        >
          {/* The padding is the mount a print gets, and it is what keeps a white-edged
              scan from bleeding into the tray it sits in. */}
          <img src={m.thumb ?? m.url} alt={m.filename} className="h-full w-full object-contain p-1.5" />
        </button>
        {showTick && (
          /* The LABEL carries the hit area, not the tick. Padding on an `input[type=checkbox]`
             is ignored by the browser — the native widget draws at its border box and a `p-2`
             on it computes to 0, measured 2026-08-22 — so the 16px tick stayed a 16px target
             on a phone and on an iPad. A label is the standard answer and it is also the
             accessible one: the whole 32px square is the control.
             It is `<Tick>` and not the native box because this one stands on a PICTURE: the
             drawn box brings its own white ground and hairline, so it is findable over a
             pale scan, where `accent-` on the platform widget was not. */
          <label
            className={`absolute left-1.5 top-1.5 z-20 flex h-8 w-8 -translate-x-1 -translate-y-1 cursor-pointer items-center justify-center ${
              selected ? 'opacity-100' : ON_HOVER
            }`}
          >
            <Tick
              checked={selected}
              // The native event is the MouseEvent behind the change, which is where the
              // modifier lives; a keyboard space reports false, which is right.
              onChange={(e) => onToggle(m.url, (e.nativeEvent as MouseEvent).shiftKey)}
              // Without this, shift-clicking a box also drags a text selection across the
              // grid, so a range-select leaves the page highlighted blue.
              onMouseDown={(e) => { if (e.shiftKey) e.preventDefault() }}
              aria-label={m.filename}
            />
          </label>
        )}
        {unused && (
          /* A finding, not an alarm: it reads as a note laid on the corner of the print.
             It was a solid black rectangle with square corners, which in an admin whose
             only black is its ink read louder than anything it could be telling you. */
          <span className="absolute bottom-1.5 left-1.5 z-10 rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,.22)] backdrop-blur-[2px] dark:bg-neutral-900/95 dark:text-neutral-300">
            {t.unusedBadge}
          </span>
        )}
        {/* The size, where it costs the NAME nothing. Set beside the name it took a third
            of a 190px caption and cut "gutenberg-bible-epistle.jpg" to "gutenberg-bible-ep…",
            which is the half of the line that is actually looked for. It waits for the
            pointer with the keys, so the resting grid is pictures and names and nothing else. */}
        <span className={`absolute bottom-1.5 right-1.5 z-10 rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] tabular-nums text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,.22)] backdrop-blur-[2px] transition-opacity dark:bg-neutral-900/95 dark:text-neutral-300 ${ON_HOVER}`}>
          {formatBytes(m.size)}
        </span>
        {mode === 'page' && (
          /* Three keys, not three words. The labels were "Copy URL", "Download" and
             "Delete" laid across the picture; at 155px — a tile on a 390px phone — they
             did not fit on one line, so the row wrapped and the band grew a second storey.
             A 28px key is the same target at every width and carries no line to break. */
          <div className={`absolute right-1.5 top-1.5 z-10 flex gap-1 transition-opacity duration-150 ${ON_HOVER}`}>
            <button type="button" onClick={() => onCopy(m.url)} title={t.copyUrl} aria-label={t.copyUrl} className={KEY}>
              <Glyph name="copy" />
            </button>
            <a href={m.url} download={m.filename} title={t.download} aria-label={t.download} className={KEY}>
              <Glyph name="download" />
            </a>
            <button
              type="button" onClick={() => onDelete(m.url)} title={t.delete} aria-label={t.delete}
              className={`${KEY} hover:text-[var(--pen-red)] dark:hover:text-[var(--pen-red)]`}
            >
              <Glyph name="trash" />
            </button>
          </div>
        )}
      </div>
      {/* One line, and the whole width of the tile for the one thing you are looking for.
          Dimensions, size and date are all a hover or a title away. */}
      <figcaption
        className="mt-1.5 truncate text-xs text-neutral-700 dark:text-neutral-300"
        title={`${m.filename}\n${full}`}
      >
        {m.filename}
      </figcaption>
    </figure>
  )
})
