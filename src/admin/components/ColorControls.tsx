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
 * 132px holds a 28px swatch and `#FCFCFC` — seven characters and a hash is the WIDEST thing
 * this control ever carries, and it is what the width is cut for. It was 148px when the
 * swatch and the field were two separate boxes with a gap; welding them gave 16px back on
 * every one of twenty-eight cells.
 */
export const CELL = 'w-[8.25rem]'

/**
 * A colour, as ONE control: the swatch is the field's leading edge, not a neighbour.
 *
 * ⚠️ `<input type="color">` IS PAINTED BY THE OPERATING SYSTEM. Border, radius and ring set
 * on it are advice the browser is free to ignore, and macOS does — it draws its own corner
 * and its own inner shadow, so the palette editor showed twenty-eight chunky shadowed
 * squares whose rounding did not match anything else on the screen and could not be made to.
 *
 * So the native input is still the control — it opens the OS picker, it is what a screen
 * reader and a keyboard find — but it paints NOTHING: it is transparent and stretched over a
 * span we draw ourselves. The swatch you see is that span's background.
 *
 * `ring-inset ring-black/10` is not decoration either: the lightest palette value is
 * `#FCFCFC` on a white card, and without an inner edge that swatch is an invisible hole.
 */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <span className={`flex h-8 shrink-0 items-center overflow-hidden ${CONTROL_GROUP} ${CELL}`}>
      <span
        className="relative h-full w-7 shrink-0 border-r border-neutral-300 ring-1 ring-inset ring-black/10 dark:border-neutral-700 dark:ring-white/10"
        style={{ background: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        spellCheck={false}
        // No chrome of its own: the box around the pair carries it. Mono and tabular so a
        // column of hexes lines up on the hash rather than wobbling per glyph.
        className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 font-mono text-xs uppercase tabular-nums text-neutral-900 outline-none dark:text-neutral-100"
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
