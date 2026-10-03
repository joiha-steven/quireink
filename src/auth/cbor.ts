// CBOR, read: as much of RFC 8949 as a passkey sends, and a refusal for the rest.
//
// A passkey's attestation object and its public key are CBOR (WebAuthn §6.5, COSE in RFC 9052),
// and nothing in either runtime reads it. ADR 0053 makes writing it here the default and a
// package the exception, and this is the case that rule was written for: the part WebAuthn uses
// is small, closed and frozen, and a general CBOR library is a parser of a much larger language
// sitting on a route that strangers can post to. What is NOT read is refused rather than
// skipped, so nothing outside the subset can reach the code that interprets the result.
//
// WHAT IS READ: unsigned and negative integers, byte strings, text strings, arrays, maps, and
// the four simple values (false, true, null, undefined). Every length is definite.
//
// WHAT IS REFUSED, each for a reason:
//   - indefinite lengths. CTAP2 requires its canonical form, which has none (CTAP 2.1 §8), so
//     an authenticator never sends one; a parser that accepts them is a parser with a second
//     way to say the same bytes.
//   - tags and floats. Nothing in an attestation object or a COSE key carries either.
//   - an integer past 2^53. No field here can need one, and a `number` cannot hold it exactly.
//   - a duplicate map key. Two answers to "what is the algorithm" is how a check and a use come
//     to disagree.
//   - any length longer than the bytes that remain, checked BEFORE anything is allocated, so a
//     header claiming four gigabytes costs nothing.
//   - nesting past `MAX_DEPTH`. A COSE key is two deep; an attestation object, three.
//
// Maps come back as `Map`, because COSE keys its fields with integers (1, 3, -1, -2) and an
// object would turn -1 into the string "-1".

export type CborValue =
  | number | string | boolean | null | undefined
  | Uint8Array | CborValue[] | Map<number | string, CborValue>

export class CborError extends Error {}

const MAX_DEPTH = 16

/** One value, and where the bytes after it begin. The authenticator data needs the second half. */
export function decodeCborPrefix(bytes: Uint8Array, offset = 0): { value: CborValue; end: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = offset

  const need = (n: number): void => {
    if (n < 0 || at + n > bytes.length) throw new CborError(`cbor: ${n} byte(s) wanted at ${at}, ${bytes.length - at} left`)
  }

  /** The argument after the initial byte: the value itself, a length, or a count. */
  const argument = (info: number): number => {
    if (info < 24) return info
    if (info === 24) { need(1); return bytes[at++]! }
    if (info === 25) { need(2); const v = view.getUint16(at); at += 2; return v }
    if (info === 26) { need(4); const v = view.getUint32(at); at += 4; return v }
    if (info === 27) {
      need(8)
      const v = view.getBigUint64(at)
      at += 8
      if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new CborError('cbor: an integer past 2^53')
      return Number(v)
    }
    // 28-30 are reserved; 31 is an indefinite length.
    throw new CborError(info === 31 ? 'cbor: an indefinite length' : `cbor: reserved additional information ${info}`)
  }

  const read = (depth: number): CborValue => {
    if (depth > MAX_DEPTH) throw new CborError('cbor: nested too deep')
    need(1)
    const initial = bytes[at++]!
    const major = initial >> 5
    const info = initial & 0x1f
    switch (major) {
      case 0: return argument(info)
      case 1: return -1 - argument(info)
      case 2: {
        const n = argument(info)
        need(n)
        // A copy, not a view: the caller keeps these (a credential id, a public key) long after
        // the request whose body they came out of has gone.
        const out = bytes.slice(at, at + n)
        at += n
        return out
      }
      case 3: {
        const n = argument(info)
        need(n)
        let text: string
        try {
          text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes.subarray(at, at + n))
        } catch {
          throw new CborError('cbor: a text string that is not UTF-8')
        }
        at += n
        return text
      }
      case 4: {
        const n = argument(info)
        // Every element takes at least one byte, so a count larger than what is left is a lie.
        need(n)
        const out: CborValue[] = []
        for (let i = 0; i < n; i++) out.push(read(depth + 1))
        return out
      }
      case 5: {
        const n = argument(info)
        need(n * 2)
        const out = new Map<number | string, CborValue>()
        for (let i = 0; i < n; i++) {
          const key = read(depth + 1)
          if (typeof key !== 'number' && typeof key !== 'string') throw new CborError('cbor: a map key that is not an integer or a text string')
          if (out.has(key)) throw new CborError(`cbor: the map key ${JSON.stringify(key)} twice`)
          out.set(key, read(depth + 1))
        }
        return out
      }
      case 6: throw new CborError('cbor: a tag')
      default: {
        if (info === 20) return false
        if (info === 21) return true
        if (info === 22) return null
        if (info === 23) return undefined
        throw new CborError(info >= 25 && info <= 27 ? 'cbor: a float' : `cbor: simple value ${info}`)
      }
    }
  }

  const value = read(0)
  return { value, end: at }
}

/** Exactly one value, and nothing after it. Trailing bytes are a different message, not padding. */
export function decodeCbor(bytes: Uint8Array): CborValue {
  const { value, end } = decodeCborPrefix(bytes)
  if (end !== bytes.length) throw new CborError(`cbor: ${bytes.length - end} byte(s) after the value`)
  return value
}
