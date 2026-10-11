// The drawings that stand for each built-in theme where the owner chooses one (ADR 0072): a
// tile on Settings → Appearance and a card on the setup step. Each theme in the registry
// (`content/themes-builtin.ts`) names its own two, so neither screen keeps a table of themes.
//
// Two kinds because the two screens draw differently. The admin tile is inline SVG in
// `currentColor`: the admin takes classes from its utilities and nothing else
// (`check:admin-css`), and a drawing needs no class at all. The setup card is spans styled by
// the setup screen's own sheet (`web/login.css.ts`, the `face-*` parts).
//
// What separates the four at this size is the same few marks on both: a gutter of numbers, a
// masthead over columns, a sheet of dotted paper.

// --- The admin tiles: 160 × 96, the headline strong, the running lines faint -----------------

const bar = (x: number, y: number, w: number, h = 3, o = 0.35): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="currentColor" fill-opacity="${o}"/>`
// Each run of lines is its own <g>: a drawing is one picture, not a stack of rows, and the
// admin's evenness pass (tour-flows-even.ts) measures any three same-kind siblings stacked in
// a column - a headline bar over five text bars read to it as a list with one wide gap.
const lines = (x: number, y: number, widths: number[], step = 8): string =>
  `<g>${widths.map((w, i) => bar(x, y + i * step, w)).join('')}</g>`

/** The words and nothing else. */
export const PLAIN_TILE = bar(16, 14, 78, 7, 0.8) + lines(16, 32, [128, 128, 128, 128, 84])

/** Numbers down a gutter, a hairline beside them, the headline in the same heavy mono. */
export const CODE_TILE = `<g>${[0, 1, 2, 3, 4, 5].map((i) => bar(12, 14 + i * 12, 6, 3, 0.3)).join('')}</g>`
  + `<rect x="24" y="10" width="1" height="74" fill="currentColor" fill-opacity=".25"/>`
  + bar(32, 12, 92, 8, 0.85) + lines(32, 32, [112, 96, 112, 70, 104], 9)

/** A nameplate over a heavy rule, then three columns with a rule in each gutter. */
export const PAPER_TILE = bar(46, 8, 68, 9, 0.85)
  + `<rect x="12" y="24" width="136" height="2" fill="currentColor" fill-opacity=".8"/>`
  + [12, 60, 108].map((x) => bar(x, 33, 40, 5, 0.7) + lines(x, 44, [40, 40, 40, 28], 7)).join('')
  + [55, 103].map((x) => `<rect x="${x}" y="33" width="1" height="50" fill="currentColor" fill-opacity=".2"/>`).join('')

/** A sheet lying on a darker desk, dot grid printed on it, a heading underlined by hand. */
export const NOTES_TILE = `<rect x="0" y="0" width="160" height="96" fill="currentColor" fill-opacity=".08"/>`
  + `<rect x="26" y="9" width="110" height="82" fill="currentColor" fill-opacity=".1"/>`
  + `<rect x="24" y="6" width="110" height="82" fill="Canvas"/>`
  + `<g>${Array.from({ length: 6 }, (_, r) => Array.from({ length: 12 }, (_, c) =>
    `<circle cx="${30 + c * 9}" cy="${12 + r * 13}" r=".75" fill="currentColor" fill-opacity=".25"/>`).join('')).join('')}</g>`
  + bar(34, 16, 58, 7, 0.85) + bar(34, 25, 58, 1.2, 0.85) + lines(34, 38, [88, 88, 64, 88], 9)

// --- The setup cards: spans the setup sheet draws ---------------------------------------------

const faceLines = (n: number): string =>
  Array.from({ length: n }, (_, i) =>
    `<span class="face-line${i === n - 1 ? ' face-short' : ''}"></span>`).join('')

/** Four lines of text. */
export const PLAIN_CARD = faceLines(4)

/** A gutter of numbers beside each line: the one mark that says "editor" at this size. */
export const CODE_CARD = Array.from({ length: 4 }, (_, i) =>
  `<span class="face-gut"><span class="face-num"></span>`
  + `<span class="face-line${i === 3 ? ' face-short' : ''}"></span></span>`).join('')

/** A centred nameplate over a heavy rule, then columns: a masthead and nothing else. */
export const PAPER_CARD = '<span class="face-plate"></span><span class="face-heavy"></span>'
  + '<span class="face-cols"><span></span><span></span><span></span></span>'

/** A sheet lifted off the desk, with the printing already on it. */
export const NOTES_CARD = `<span class="face-sheet">${
  Array.from({ length: 4 }, () => '<span class="face-ruled"></span>').join('')}</span>`
