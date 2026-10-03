// The CBOR reader, held to RFC 8949's own examples (Appendix A) for what it reads, and to a
// refusal for each thing it was written to refuse.
import { describe, expect, it } from 'bun:test'
import { CborError, decodeCbor, decodeCborPrefix } from './cbor'
import { encodeCbor } from '@/test/webauthn'

const hex = (h: string): Uint8Array => new Uint8Array((h.match(/../g) ?? []).map((b) => parseInt(b, 16)))

describe('decodeCbor reads', () => {
  // Each pair is straight out of RFC 8949 Appendix A.
  const cases: [string, unknown][] = [
    ['00', 0], ['01', 1], ['0a', 10], ['17', 23], ['1818', 24], ['1819', 25], ['1864', 100],
    ['1903e8', 1000], ['1a000f4240', 1000000], ['1b000000e8d4a51000', 1000000000000],
    ['20', -1], ['29', -10], ['3863', -100], ['3903e7', -1000],
    ['f4', false], ['f5', true], ['f6', null], ['f7', undefined],
    ['60', ''], ['6161', 'a'], ['6449455446', 'IETF'], ['62225c', '"\\'], ['62c3bc', 'ü'], ['63e6b0b4', '水'],
    ['80', []], ['83010203', [1, 2, 3]], ['8301820203820405', [1, [2, 3], [4, 5]]],
  ]
  for (const [h, want] of cases) {
    it(`0x${h}`, () => expect(decodeCbor(hex(h))).toEqual(want as never))
  }

  it('byte strings as copies, not views into the input', () => {
    const input = hex('4401020304')
    const out = decodeCbor(input) as Uint8Array
    expect([...out]).toEqual([1, 2, 3, 4])
    input[1] = 9
    expect(out[0]).toBe(1)
  })

  it('maps as Maps, so a COSE key keeps its negative integer labels', () => {
    const m = decodeCbor(hex('a201020304')) as Map<number, number>
    expect(m).toBeInstanceOf(Map)
    expect([...m]).toEqual([[1, 2], [3, 4]])
    const cose = decodeCbor(encodeCbor(new Map<number, number>([[1, 2], [3, -7], [-1, 1]]))) as Map<number, number>
    expect(cose.get(-1)).toBe(1)
    expect(cose.get(3)).toBe(-7)
  })

  it('what the test encoder writes, back unchanged', () => {
    const value = new Map<string, unknown>([['fmt', 'none'], ['attStmt', new Map()], ['authData', new Uint8Array(300).fill(7)]])
    expect(decodeCbor(encodeCbor(value as never))).toEqual(value as never)
  })

  it('one value and where the next begins, for the authenticator data', () => {
    expect(decodeCborPrefix(hex('0102ff'), 1)).toEqual({ value: 2, end: 2 })
  })
})

describe('decodeCbor refuses', () => {
  const refused: [string, string][] = [
    ['an indefinite-length byte string', '5f42010243030405ff'],
    ['an indefinite-length array', '9f01ff'],
    ['an indefinite-length map', 'bf6161f5ff'],
    ['a tag', 'c11a514b67b0'],
    ['a half float', 'f93c00'],
    ['a double', 'fb3ff199999999999a'],
    ['a reserved additional value', '1c'],
    ['an integer past 2^53', '1bffffffffffffffff'],
    ['a duplicate map key', 'a201020103'],
    ['a map key that is an array', 'a18001'],
    ['a length longer than the input', '5a00010000'],
    ['an array count longer than the input', '9a7fffffff'],
    ['text that is not UTF-8', '62c328'],
    ['bytes after the value', '0001'],
    ['nothing at all', ''],
  ]
  for (const [what, h] of refused) {
    it(what, () => expect(() => decodeCbor(hex(h))).toThrow(CborError))
  }

  it('nesting past the depth limit, without walking the stack down', () => {
    expect(() => decodeCbor(new Uint8Array(40).fill(0x81))).toThrow(/too deep/)
  })
})
