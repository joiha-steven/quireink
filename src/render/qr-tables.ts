// The two tables in QR that cannot be computed, only looked up. ISO/IEC 18004, level M.
//
// Everything else in `qr-encode.ts` is arithmetic. These are data, and data typed from a
// specification is data with a typo in it, which is why `qr-encode.test.ts` checks every row
// of both against module grids captured from an independent encoder before that encoder was
// removed. A wrong number here does not produce a broken-looking image. It produces a QR code
// that looks perfect and will not scan.
//
// ONLY LEVEL M. The enrolment code is read off a screen, where nothing is scratched or faded,
// and a higher correction level only makes the image denser for no gain. Adding L, Q or H means
// three more tables of the same shape, so the level is a constant rather than a parameter: an
// argument nothing passes is a table nobody checks.

/**
 * Per version 1-40, how the data is cut into blocks before error correction.
 *
 * `[ecPerBlock, blocksInGroup1, dataPerBlockInGroup1, blocksInGroup2, dataPerBlockInGroup2]`
 *
 * The two groups differ by exactly one data codeword, always, and the second group is empty for
 * the versions where the split comes out even.
 */
export const BLOCKS_M: readonly (readonly [number, number, number, number, number])[] = [
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
  [30, 1, 50, 4, 51],
  [22, 6, 36, 2, 37],
  [22, 8, 37, 1, 38],
  [24, 4, 40, 5, 41],
  [24, 5, 41, 5, 42],
  [28, 7, 45, 3, 46],
  [28, 10, 46, 1, 47],
  [26, 9, 43, 4, 44],
  [26, 3, 44, 11, 45],
  [26, 3, 41, 13, 42],
  [26, 17, 42, 0, 0],
  [28, 17, 46, 0, 0],
  [28, 4, 47, 14, 48],
  [28, 6, 45, 14, 46],
  [28, 8, 47, 13, 48],
  [28, 19, 46, 4, 47],
  [28, 22, 45, 3, 46],
  [28, 3, 45, 23, 46],
  [28, 21, 45, 7, 46],
  [28, 19, 47, 10, 48],
  [28, 2, 46, 29, 47],
  [28, 10, 46, 23, 47],
  [28, 14, 46, 21, 47],
  [28, 14, 46, 23, 47],
  [28, 12, 47, 26, 48],
  [28, 6, 47, 34, 48],
  [28, 29, 46, 14, 47],
  [28, 13, 46, 32, 47],
  [28, 40, 47, 7, 48],
  [28, 18, 47, 31, 48],
]

/**
 * The centre coordinates of the alignment patterns, per version. Version 1 has none.
 *
 * A pattern is drawn at every pairing of these coordinates EXCEPT the three that would sit on a
 * finder pattern, which is the rule rather than three more table rows.
 */
export const ALIGNMENT: readonly (readonly number[])[] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
]

/** Data codewords a version holds at level M, which is what version selection compares against. */
export function dataCodewords(version: number): number {
  const [, g1, d1, g2, d2] = BLOCKS_M[version - 1]!
  return g1 * d1 + g2 * d2
}
