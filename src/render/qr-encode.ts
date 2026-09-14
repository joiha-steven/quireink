// Text to the codeword stream a QR code carries: the arithmetic half.
//
// `qr-matrix.ts` turns what this returns into modules. The split is the 400-line cap, but it
// falls in the right place anyway: everything here is finite-field algebra with one answer, and
// everything there is geometry.
//
// BYTE MODE ONLY. QR has four (numeric, alphanumeric, byte, kanji) and picking the narrowest
// per run is how a general encoder squeezes a URL into a smaller image. The only thing this
// product encodes is an `otpauth://` URI, which is mixed case with punctuation and therefore
// byte mode whatever the encoder does, and the modes cost a segmenting pass that would never
// change the answer here.
import { BLOCKS_M, dataCodewords } from './qr-tables'

/**
 * GF(256), the field Reed-Solomon works in, built from the primitive polynomial QR specifies.
 *
 * The exponent table runs to 512 rather than 255 so that `LOG[a] + LOG[b]` can be read straight
 * back without a modulo on every multiply.
 */
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d // the polynomial: x^8 + x^4 + x^3 + x^2 + 1
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!
}

const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!)

/**
 * The generator polynomial for `n` error-correction codewords: (x - a^0)(x - a^1)...(x - a^n-1).
 *
 * Coefficients run highest degree first, which is the order the division below consumes them.
 */
function generator(n: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < n; i++) {
    const next = new Uint8Array(poly.length + 1)
    for (let j = 0; j < poly.length; j++) {
      next[j]! ^= poly[j]!
      next[j + 1]! ^= mul(poly[j]!, EXP[i]!)
    }
    poly = next
  }
  return poly
}

/** The remainder of `data` divided by the generator: the block's error-correction codewords. */
function correct(data: Uint8Array, n: number): Uint8Array {
  const gen = generator(n)
  const buf = new Uint8Array(data.length + n)
  buf.set(data)
  for (let i = 0; i < data.length; i++) {
    const factor = buf[i]!
    if (factor === 0) continue
    // gen[0] is always 1, so this step always clears buf[i] and the loop can walk forwards.
    for (let j = 0; j < gen.length; j++) buf[i + j]! ^= mul(gen[j]!, factor)
  }
  return buf.slice(data.length)
}

/** Byte mode spends 8 bits on the character count up to version 9, and 16 from version 10. */
const countBits = (version: number): number => (version < 10 ? 8 : 16)

/**
 * The smallest version whose level-M capacity holds `length` bytes.
 *
 * Version is searched rather than computed because the character-count field grows at version
 * 10: a payload that just fits version 9 does not necessarily fit in nine versions' worth of
 * capacity once the header costs eight more bits.
 */
function chooseVersion(length: number): number {
  for (let version = 1; version <= 40; version++) {
    if (4 + countBits(version) + length * 8 <= dataCodewords(version) * 8) return version
  }
  throw new Error(`${length} bytes is more than a QR code can carry`)
}

/** A bit sink that packs MSB first, which is the order every field in QR is written in. */
class Bits {
  private readonly out: number[] = []
  private length = 0

  push(value: number, width: number): void {
    for (let i = width - 1; i >= 0; i--) {
      if (this.length % 8 === 0) this.out.push(0)
      if ((value >> i) & 1) this.out[this.out.length - 1]! |= 0x80 >> this.length % 8
      this.length++
    }
  }

  get bits(): number {
    return this.length
  }

  bytes(): Uint8Array {
    return Uint8Array.from(this.out)
  }
}

/**
 * The data codewords for `text` at `version`: header, payload, terminator and padding.
 *
 * The two pad bytes alternate for the whole remaining length and are fixed by the
 * specification. They are not filler anyone may choose: a decoder that reads them expects
 * exactly this pair in exactly this order.
 */
function payload(text: string, version: number): Uint8Array {
  const body = new TextEncoder().encode(text)
  const capacity = dataCodewords(version)
  const bits = new Bits()
  bits.push(0b0100, 4) // byte mode
  bits.push(body.length, countBits(version))
  for (const byte of body) bits.push(byte, 8)

  // The terminator is up to four zero bits, and fewer when the data already reaches capacity.
  bits.push(0, Math.min(4, capacity * 8 - bits.bits))
  if (bits.bits % 8 !== 0) bits.push(0, 8 - (bits.bits % 8))

  const out = new Uint8Array(capacity)
  out.set(bits.bytes())
  for (let i = bits.bytes().length; i < capacity; i++) {
    out[i] = (i - bits.bytes().length) % 2 === 0 ? 0xec : 0x11
  }
  return out
}

export type Encoded = { version: number; codewords: Uint8Array }

/**
 * `text` as the final, interleaved codeword stream, and the version it needs.
 *
 * INTERLEAVING IS THE POINT OF THE BLOCKS. Error correction is per block, so a scratch across
 * the image has to be spread over several blocks rather than destroying one of them: the
 * codewords are written out a column at a time across the blocks, data first and then the
 * correction, so physically adjacent modules belong to different blocks.
 */
export function encode(text: string): Encoded {
  const version = chooseVersion(new TextEncoder().encode(text).length)
  const [ec, g1, d1, g2, d2] = BLOCKS_M[version - 1]!
  const data = payload(text, version)

  const blocks: { data: Uint8Array; ec: Uint8Array }[] = []
  let at = 0
  for (const [count, size] of [
    [g1, d1],
    [g2, d2],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const slice = data.subarray(at, at + size)
      at += size
      blocks.push({ data: slice, ec: correct(slice, ec) })
    }
  }

  const out: number[] = []
  for (let i = 0; i < Math.max(d1, d2); i++) {
    for (const block of blocks) if (i < block.data.length) out.push(block.data[i]!)
  }
  for (let i = 0; i < ec; i++) for (const block of blocks) out.push(block.ec[i]!)

  return { version, codewords: Uint8Array.from(out) }
}
