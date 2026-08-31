// A colour, as a control rather than as part of a screen.
//
// It lived in `ThemeFields` and `InkFields` imported it from there — a screen borrowing a
// control from another screen, which is how a control ends up shaped by whichever screen
// changed last. Two screens ask for a colour; the control belongs to neither.
import type { ReactNode } from 'react'
import { CONTROL_GROUP } from './kit'

/**
 * ONE width for a colour cell, so the two column heads sit exactly over the two columns.
 *
 * 132px holds the well, the fixed hash and six hex characters with air — `FCFCFC` is the
 * WIDEST value the field carries now that the hash is chrome rather than content. It was
 * 148px when the swatch and the field were two separate boxes with a gap.
 */
export const CELL = 'w-[8.25rem]'

/**
 * A colour, as ONE control: an INK WELL carved into the field, then the hex.
 *
 * The well is round on purpose. Two rectangles welded at a seam read as two controls from
 * two machines; a round well of ink sits in the same family as the wordmark's filled stop
 * and the small state dots, and its carved lip (dark above, light below — held INK, in the
 * relief grammar) keeps even `#FCFCFC` visible as a well rather than a hole in the card.
 *
 * ⚠️ `<input type="color">` IS PAINTED BY THE OPERATING SYSTEM. Border, radius and ring set
 * on it are advice the browser is free to ignore, and macOS does — it draws its own corner
 * and its own inner shadow, so the palette editor showed twenty-eight chunky shadowed
 * squares whose rounding did not match anything else on the screen and could not be made to.
 * So the native input is still the control — it opens the OS picker, it is what a screen
 * reader and a keyboard find — but it paints NOTHING: it is transparent and stretched over
 * the well, whose background is the value.
 *
 * The hash is CHROME, not content: it sits fixed in the meta shade so a column of hexes
 * lines up on its digits, and the field stores it back for any bare hex typed in. A value
 * that is not a bare hex (an rgba() someone pasted) passes through untouched.
 */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const bare = value.startsWith('#') ? value.slice(1) : value
  const put = (v: string) => onChange(/^[0-9a-fA-F]{3,8}$/.test(v.trim()) ? `#${v.trim()}` : v)
  return (
    <span className={`flex h-8 shrink-0 items-center gap-1.5 px-2 ${CONTROL_GROUP} ${CELL}`}>
      <span
        className="relative h-[1.05rem] w-[1.05rem] shrink-0 rounded-full ring-1 ring-black/15 shadow-[inset_0_1.5px_2px_rgba(0,0,0,.35),inset_0_-1px_1px_rgba(255,255,255,.28)] dark:ring-white/20"
        style={{ background: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0"
        />
      </span>
      <span aria-hidden="true" className="font-mono text-xs text-neutral-400 dark:text-neutral-500">#</span>
      <input
        type="text"
        value={bare}
        onChange={(e) => put(e.target.value)}
        aria-label={label}
        spellCheck={false}
        className="h-full min-w-0 flex-1 border-0 bg-transparent font-mono text-xs uppercase tabular-nums text-neutral-900 outline-none dark:text-neutral-100"
      />
    </span>
  )
}

/**
 * One colour on its own: the label, then the control. The ink card's shape.
 *
 * Exported since 2026-08-24 because the ink card wants the same row, and a second copy of
 * these classes is exactly the drift `check:admin-kit` exists to catch.
 *
 * `justify-between` with nothing between them is what made the pen card look empty: one
 * colour per full-width row put a five-word label at the far left, a 132px control at the far
 * right, and several hundred pixels of nothing in the middle, five times over. The row is
 * unchanged — what changed is that `ColorGrid` below stops giving it the whole width.
 */
export function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    // `max-w-sm`, because two columns alone did not fix it. On a wide card each column came
    // out 661px, so the label still sat at one end and its 132px field at the other with
    // four hundred pixels of nothing between them — the same journey the eye was making
    // before, only twice per line instead of once. Capping the ROW keeps the pair together
    // and lets the leftover width fall outside it, where it costs nothing to read.
    <label className="flex max-w-sm items-center justify-between gap-3">
      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
      <ColorField label={label} value={value} onChange={onChange} />
    </label>
  )
}

/**
 * Single colours, two to a line where there is room for two.
 *
 * A list of unrelated colours — five highlighter pigments, a ring and an underline — has no
 * pairing to honour the way light and dark do, so the only question is how much air each one
 * earns. One per row earned all of it: the label and its field were as far apart as the card
 * is wide, and the eye had to travel that gap on every line to know which hex belonged to
 * which name.
 *
 * Two columns close that distance and halve the height. It collapses to one column below
 * `sm`, where the label and a 132px field genuinely do fill a line.
 */
export function ColorGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">{children}</div>
}
