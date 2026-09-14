// Codewords to modules: the geometry half of the QR encoder. `qr-encode.ts` is the other.
//
// The order below is the specification's and cannot be rearranged. Function patterns go down
// first because they are what tells the data placement which cells to skip; the mask is chosen
// by drawing all eight and scoring them; the format information is written last because it
// records which mask won.
import { encode } from './qr-encode'
import { ALIGNMENT } from './qr-tables'

/** BCH generators for the two protected fields, and the constant the format is XORed with. */
const G15 = 0b101_0011_0111
const G18 = 0b1_1111_0010_0101
const FORMAT_MASK = 0b101_0100_0001_0010

const bitLength = (value: number): number => (value === 0 ? 0 : 32 - Math.clz32(value))

/** `data`, followed by the remainder of dividing it by `poly`. Both fields are protected so. */
function bch(data: number, shift: number, poly: number): number {
  let rest = data << shift
  while (bitLength(rest) >= bitLength(poly)) rest ^= poly << (bitLength(rest) - bitLength(poly))
  return (data << shift) | rest
}

/**
 * The eight masks, by their number.
 *
 * A mask exists because an unmasked code can come out mostly white, or carrying a run that
 * looks like a finder pattern, and a scanner then fails on an image that encodes perfectly
 * well. All eight are drawn and the least ugly one wins, by the score below.
 */
const MASKS: readonly ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

type Grid = (boolean | null)[][]

const FINDER = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1],
]

/** The three finders, each with the light separator that isolates it from the data. */
function drawFinders(grid: Grid, size: number): void {
  for (const [top, left] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ] as const) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r
        const col = left + c
        if (row < 0 || col < 0 || row >= size || col >= size) continue
        grid[row]![col] = r >= 0 && r < 7 && c >= 0 && c < 7 ? FINDER[r]![c] === 1 : false
      }
    }
  }
}

/** A 5x5 target wherever two centre coordinates meet, except on top of a finder. */
function drawAlignment(grid: Grid, size: number, version: number): void {
  const centres = ALIGNMENT[version - 1]!
  for (const row of centres) {
    for (const col of centres) {
      const onFinder =
        (row === 6 && col === 6) || (row === 6 && col === size - 7) || (row === size - 7 && col === 6)
      if (onFinder) continue
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          grid[row + r]![col + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1
        }
      }
    }
  }
}

/** Reserves the cells the format and version fields will occupy, so data placement skips them. */
function reserve(grid: Grid, size: number, version: number): void {
  for (let i = 0; i < 9; i++) {
    if (grid[8]![i] === null) grid[8]![i] = false
    if (grid[i]![8] === null) grid[i]![8] = false
  }
  for (let i = 0; i < 8; i++) {
    grid[8]![size - 1 - i] = false
    grid[size - 1 - i]![8] = false
  }
  if (version < 7) return
  for (let i = 0; i < 18; i++) {
    grid[Math.floor(i / 3)]![size - 11 + (i % 3)] = false
    grid[size - 11 + (i % 3)]![Math.floor(i / 3)] = false
  }
}

/**
 * The codewords, written into every cell the function patterns left empty.
 *
 * Two columns at a time, right to left, alternating upward and downward, and column 6 is skipped
 * because the vertical timing pattern lives there. Bits that run past the data are written light,
 * which is what the specification's remainder bits are.
 */
function place(grid: Grid, size: number, codewords: Uint8Array): void {
  let up = true
  let bit = 0
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--
    for (let step = 0; step < size; step++) {
      const row = up ? size - 1 - step : step
      for (const c of [col, col - 1]) {
        if (grid[row]![c] !== null) continue
        const byte = codewords[bit >> 3]
        grid[row]![c] = byte !== undefined && ((byte >> (7 - (bit % 8))) & 1) === 1
        bit++
      }
    }
    up = !up
  }
}

/** How badly a masked grid reads, by the specification's four rules. Lowest wins. */
function penalty(grid: boolean[][], size: number): number {
  let score = 0
  let dark = 0

  for (let i = 0; i < size; i++) {
    for (const line of [grid[i]!, grid.map((r) => r[i]!)]) {
      let run = 1
      for (let j = 1; j < size; j++) {
        if (line[j] === line[j - 1]) run++
        else {
          if (run >= 5) score += 3 + (run - 5)
          run = 1
        }
      }
      if (run >= 5) score += 3 + (run - 5)

      // Rule 3: the 1:1:3:1:1 run that a scanner would read as a finder, with four light
      // modules on either side. Both orientations of it, anywhere in the line.
      for (let j = 0; j + 11 <= size; j++) {
        const window = line.slice(j, j + 11).map((v) => (v ? '1' : '0')).join('')
        if (window === '10111010000' || window === '00001011101') score += 40
      }
    }
    for (let j = 0; j < size; j++) if (grid[i]![j]) dark++
  }

  for (let r = 0; r + 1 < size; r++) {
    for (let c = 0; c + 1 < size; c++) {
      const v = grid[r]![c]
      if (v === grid[r]![c + 1] && v === grid[r + 1]![c] && v === grid[r + 1]![c + 1]) score += 3
    }
  }

  return score + Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10
}

/** The 15 protected bits of the format field, in their two copies around the finders. */
function writeFormat(grid: boolean[][], size: number, mask: number): void {
  // Level M is 0b00, so the five-bit field is the mask number alone.
  const bits = bch(mask, 10, G15) ^ FORMAT_MASK
  for (let i = 0; i < 15; i++) {
    const on = ((bits >> i) & 1) === 1
    if (i < 6) grid[i]![8] = on
    else if (i < 8) grid[i + 1]![8] = on
    else grid[size - 15 + i]![8] = on

    if (i < 8) grid[8]![size - 1 - i] = on
    else grid[8]![15 - i - (i < 9 ? 0 : 1)] = on
  }
  grid[size - 8]![8] = true // the one module that is dark in every code ever made
}

/** Version 7 and up says its own number, twice, so a scanner need not count rows. */
function writeVersion(grid: boolean[][], size: number, version: number): void {
  if (version < 7) return
  const bits = bch(version, 12, G18)
  for (let i = 0; i < 18; i++) {
    const on = ((bits >> i) & 1) === 1
    grid[Math.floor(i / 3)]![size - 11 + (i % 3)] = on
    grid[size - 11 + (i % 3)]![Math.floor(i / 3)] = on
  }
}

/** Everything but the mask: function patterns, the data, and which cells are not data. */
function draw(text: string): { base: Grid; functional: boolean[][]; size: number; version: number } {
  const { version, codewords } = encode(text)
  const size = version * 4 + 17

  const base: Grid = Array.from({ length: size }, () => Array<boolean | null>(size).fill(null))
  drawFinders(base, size)
  for (let i = 8; i < size - 8; i++) {
    base[6]![i] = i % 2 === 0
    base[i]![6] = i % 2 === 0
  }
  drawAlignment(base, size, version)
  reserve(base, size, version)
  const functional = base.map((row) => row.map((cell) => cell !== null))
  place(base, size, codewords)
  return { base, functional, size, version }
}

/**
 * `text` drawn with a named mask, rather than the one the score below prefers.
 *
 * A SEAM FOR THE TEST, and the reason it exists is the reason this module can be trusted. Every
 * part of a QR code except the choice of mask has exactly one right answer, and all of it was
 * checked module by module against `qrcode-generator` across every payload length from 1 to 2331
 * bytes, with the mask pinned to the one that library had picked: 2331 of 2331 identical, across
 * all forty versions, which walks every row of both tables in `qr-tables.ts`. What could
 * not be checked that way is the choice itself, because that library does not score masks the
 * way the specification does. `qr-encode.test.ts` keeps those captured grids.
 */
export function matrixWithMask(text: string, mask: number): boolean[][] {
  const { base, functional, size, version } = draw(text)
  const grid = base.map((row, r) =>
    row.map((cell, c) => (!functional[r]![c] && MASKS[mask]!(r, c) ? !cell : cell!)),
  )
  writeFormat(grid, size, mask)
  writeVersion(grid, size, version)
  return grid
}

/**
 * `text` as a square of dark and light modules, with no quiet zone around it.
 *
 * THE MASK IS SCORED BY THE SPECIFICATION, WHICH `qrcode-generator` DOES NOT DO. That library
 * deviates in three of the four rules: its rule 1 counts how many of a module's eight neighbours
 * share its colour instead of looking for runs of five in a row or column, its rule 3 drops the
 * four light modules the finder-lookalike needs on one side, and its rule 4 never floors the
 * ratio. Following it would mean carrying three deviations in code that has no reason to.
 *
 * Nothing about scanning turns on this. All eight masks produce a valid code, which is why the
 * format field records which one was used, and the rules only pick the one a scanner is least
 * likely to struggle with. The image differs from the old one; what it means does not.
 */
export function qrMatrix(text: string): boolean[][] {
  const { base, functional, size, version } = draw(text)

  let best: boolean[][] | null = null
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const grid = base.map((row, r) =>
      row.map((cell, c) => (!functional[r]![c] && MASKS[mask]!(r, c) ? !cell : cell!)),
    )
    writeFormat(grid, size, mask)
    writeVersion(grid, size, version)
    const score = penalty(grid, size)
    if (score < bestScore) {
      bestScore = score
      best = grid
    }
  }
  return best!
}
