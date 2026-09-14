// The QR encoder, against grids drawn by an encoder that is not this one.
//
// HOW THESE NUMBERS WERE MADE, and why they are the whole gate. Before `qrcode-generator` was
// removed, every payload from 1 to 2331 bytes was encoded by both it and this module, with the
// mask here pinned to whichever one that library had chosen, and the two grids compared module
// by module. 2331 of 2331 were identical, across all forty versions, which walks every row of
// both tables in `qr-tables.ts` and every branch of the placement.
//
// The rows below are a slice of that run, kept as the digest of the library's grid, so the
// comparison outlives the library. A wrong number in a table does not make a broken-looking
// image; it makes a QR code that looks perfect and will not scan, and this is what says so.
//
// THE ONE THING THAT COULD NOT BE CHECKED THAT WAY IS THE CHOICE OF MASK, because
// `qrcode-generator` does not score masks the way ISO/IEC 18004 does. It deviates in three of
// the four rules: rule 1 counts a module's like-coloured neighbours instead of runs of five in a
// line, rule 3 drops the four light modules its finder-lookalike needs on one side, and rule 4
// never floors the ratio. This module follows the specification, so the mask it picks is
// sometimes a different one, and MY_MASKS below pins which. Nothing about scanning turns on it:
// all eight masks make a valid code, which is why the format field records which one was used.
import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { matrixWithMask, qrMatrix } from './qr-matrix'
import { encode } from './qr-encode'
import { BLOCKS_M, ALIGNMENT } from './qr-tables'

/** The same generator the comparison run used, so the payloads are the ones that were checked. */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:/?&=.-_%'
function payload(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[(i * 31 + length * 17) % ALPHABET.length]
  return out
}

const digest = (grid: boolean[][]): string =>
  createHash('sha256')
    .update(grid.map((row) => row.map((on) => (on ? '1' : '0')).join('')).join('\n'))
    .digest('hex')
    .slice(0, 16)

/** `[payload length, version it needs, the mask the other encoder chose, digest of its grid]` */
const CAPTURED: readonly (readonly [number, number, number, string])[] = [
  [1, 1, 4, 'a6e8152f49ca9481'],
  [8, 1, 1, '14a9e24a7ef99153'],
  [20, 2, 2, 'd9427cdb45dd310d'],
  [40, 3, 6, '20b6537b1bf79e38'],
  [70, 5, 1, '58fee95ac4b43069'],
  [110, 7, 4, '4982d95edaa56a46'],
  [160, 9, 2, '7710922e88416c05'],
  [230, 11, 4, '0337ecb36692f645'],
  [330, 13, 7, '3823500438261696'],
  [470, 17, 3, '0414fac9fe9c2f71'],
  [650, 20, 7, '4a0f4e77e85dd3b3'],
  [900, 24, 3, 'efede636268d1779'],
  [1200, 29, 4, '9aa37db3ae9bd264'],
  [1480, 32, 3, '8ae45eb82b16cc29'],
  [1800, 35, 3, 'cf49b9cf287818f7'],
  [2100, 39, 7, '1e4322187c461067'],
  [2331, 40, 7, '4fe070096e652a75'],
]

/** What the specification's own scoring picks for the same payloads. */
const MY_MASKS = [4, 1, 2, 6, 4, 6, 6, 2, 3, 2, 4, 5, 5, 4, 4, 4, 4]

/** The mask number a finished grid declares, read back out of its format field. */
function declaredMask(grid: boolean[][]): number {
  const size = grid.length
  let bits = 0
  for (let i = 0; i < 15; i++) {
    const on = i < 6 ? grid[i]![8]! : i < 8 ? grid[i + 1]![8]! : grid[size - 15 + i]![8]!
    if (on) bits |= 1 << i
  }
  return (bits ^ 0b101_0100_0001_0010) >> 10
}

describe('every module, against the encoder that was replaced', () => {
  for (const [length, version, mask, want] of CAPTURED) {
    it(`${length} bytes is version ${version} and matches module for module`, () => {
      const grid = matrixWithMask(payload(length), mask)
      expect(grid.length).toBe(version * 4 + 17)
      expect(digest(grid)).toBe(want)
    })
  }

  it('the real enrolment payload is unchanged, mask included', () => {
    const uri =
      'otpauth://totp/QuireInk%3Ahung?secret=JBSWY3DPEHPK3PXP&issuer=QuireInk&algorithm=SHA1&digits=6&period=30'
    // The specification's scoring and the old library's agree here, so the QR code an owner
    // scans when they enrol is the same image it was before any of this.
    expect(declaredMask(qrMatrix(uri))).toBe(5)
    expect(digest(qrMatrix(uri))).toBe('dac092af4d7e0f07')
    expect(qrMatrix(uri).length).toBe(6 * 4 + 17)
  })
})

describe('the mask', () => {
  it('is chosen by the specification, and the choice is pinned', () => {
    expect(CAPTURED.map(([length]) => declaredMask(qrMatrix(payload(length))))).toEqual(MY_MASKS)
  })

  it('is declared in the format field, whichever one is drawn', () => {
    for (let mask = 0; mask < 8; mask++) {
      expect(declaredMask(matrixWithMask('quire ink', mask))).toBe(mask)
    }
  })

  it('changes the image and nothing else about its size', () => {
    const sizes = new Set<number>()
    for (let mask = 0; mask < 8; mask++) sizes.add(matrixWithMask('quire ink', mask).length)
    expect(sizes.size).toBe(1)
  })
})

describe('the tables are the right shape', () => {
  it('covers all forty versions, with alignment centres from version two', () => {
    expect(BLOCKS_M.length).toBe(40)
    expect(ALIGNMENT.length).toBe(40)
    expect(ALIGNMENT[0]).toEqual([])
    for (const centres of ALIGNMENT.slice(1)) expect(centres[0]).toBe(6)
  })

  it('spends every codeword a version holds: data plus correction fills it exactly', () => {
    for (let version = 1; version <= 40; version++) {
      const [ec, g1, d1, g2, d2] = BLOCKS_M[version - 1]!
      // The two groups differ by one data codeword, always, or the second group is empty.
      if (g2 > 0) expect(d2).toBe(d1 + 1)
      expect(encode(payload(g1 * d1 + g2 * d2 - 3)).codewords.length).toBe(
        g1 * d1 + g2 * d2 + ec * (g1 + g2),
      )
    }
  })
})

it('refuses a payload no QR code can carry', () => {
  expect(() => qrMatrix(payload(2332))).toThrow(/more than a QR code can carry/)
})
