// Preloaded (`bun --preload`) into the matrix's seeder and server so "N days ago" and every
// window measured from now (most viewed, scheduled) read the same on every run, whatever day
// it is. The clock STARTS at THEME_MATRIX_NOW and then keeps moving: a frozen clock would
// stop rate-limit windows from ever expiring and the server would answer 429 mid-run.
const start = Date.parse(process.env.THEME_MATRIX_NOW ?? '')
if (Number.isNaN(start)) throw new Error('theme-matrix-clock: THEME_MATRIX_NOW is not a date')

const RealDate = Date
const origin = RealDate.now()
const now = (): number => start + (RealDate.now() - origin)

class ShiftedDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(now())
    else super(...(args as [number]))
  }
  static override now(): number { return now() }
}
globalThis.Date = ShiftedDate as DateConstructor
