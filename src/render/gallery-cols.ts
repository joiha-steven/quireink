// How many columns a gallery of N pictures takes.
//
// ONE RULE, TWO READERS, and that is why it is a file of its own. The renderer decides the
// published grid; the editor's node view has to draw the SAME grid while the author is
// looking at it, or the writing surface quietly lies about the page. It did: the editor
// laid every gallery out three across whatever its size, so the commonest case — four
// pictures — was 3+1 in the editor and 2x2 for the reader, and nothing in the product said
// which one was true. A second copy of these five lines would have drifted the first time
// either side was tuned.
//
// The shape is Jetpack-like: small sets get one row, four squares up into a 2x2 rather than
// a lonely 3+1, larger sets settle at three and then four across.
//
// The count is not the whole answer on a narrow screen — `mobile.css.ts` caps the grid at
// two columns below 639px, because 4 columns of a 350px measure is an 80px photograph. That
// cap belongs in CSS rather than here: it is a question about the viewport, and this
// function is answered once at render time and cached with the body.
export function galleryCols(n: number): number {
  if (n <= 3) return n // 2 -> 2, 3 -> 3
  if (n === 4) return 2 // 2x2
  if (n <= 9) return 3 // 5-9 -> 3 across
  return 4 // 10+ -> 4 across
}

/**
 * The width one tile takes in the editor's preview, as a percentage.
 *
 * The published grid is a CSS grid with a gap; the editor's is inline-blocks with a margin,
 * because a ProseMirror node view is a block element per node and there is no run wrapper to
 * hang a grid off. So the number is not `100/cols` — it leaves room for the same 1.5% margin
 * the editor's rule adds to every tile but the last in a row.
 */
export function editorTileWidth(cols: number): string {
  return `${(100 / cols - 1.5).toFixed(1)}%`
}
