// The ZIP reader, against archives this repository did not write.
//
// THAT IS THE WHOLE POINT OF THE THREE CONSTANTS BELOW. A reader tested only against archives
// built by a writer in the same file agrees with itself: misread the format once and both halves
// misread it the same way, and the suite is green about nothing. So the fixtures come from
// Info-ZIP's `zip`, the tool on macOS and on the CI runner, and they are checked in as base64
// rather than as binary blobs so that a diff can still show when one changed.
//
// Each holds the same five members, so the three cases differ only in HOW they are stored:
//
//   posts/                    a directory entry, which is not a file and must be dropped
//   posts/one.html            60 bytes of repetition, so deflate actually compresses it
//   posts.csv                 short enough that deflate would grow it, so `zip` stores it
//   tiếng-việt.html           a name Info-ZIP writes as UTF-8 with the UTF-8 FLAG CLEAR
//   image.png                 not .html or .csv, so `keep` must never inflate it
//
// Regenerate with, from a directory holding those files:
//   zip -q -r normal.zip .      zip -q -0 -r stored.zip .      zip -q -fz -r zip64.zip .
//
// `zip64.zip` earns its place: every size in it is the 0xFFFFFFFF sentinel with the real number
// in each entry's own extra field, and the first version of this reader handled Zip64 only at
// the end-of-archive record. It read every entry as 4 GB long.
import { describe, expect, it } from 'bun:test'
import { unzip, ZipError } from './unzip'

const NORMAL =
  'UEsDBAoAAAAAAKVNLl0AAAAAAAAAAAAAAAAGABwAcG9zdHMvVVQJAAO1X6dqtV+nanV4CwABBPUBAAAEFAAAAFBLAwQUAAAA' +
  'CAClTS5dMoRrggwAAAA8AAAADgAcAHBvc3RzL29uZS5odG1sVVQJAAO1X6dqtV+nanV4CwABBPUBAAAEFAAAAMtIzcnJV8gg' +
  'h+QCAFBLAwQKAAAAAAClTS5deweXCggAAAAIAAAACQAcAHBvc3RzLmNzdlVUCQADtV+narVfp2p1eAsAAQT1AQAABBQAAABh' +
  'LGIKMSwyClBLAwQKAAAAAAClTS5dDRqHrQUAAAAFAAAAEwAcAHRp4bq/bmctdmnhu4d0Lmh0bWxVVAkAA7Vfp2q1X6dqdXgL' +
  'AAEE9QEAAAQUAAAAY2hhbwpQSwMECgAAAAAApU0uXUcYGtsHAAAABwAAAAkAHABpbWFnZS5wbmdVVAkAA7Vfp2q1X6dqdXgL' +
  'AAEE9QEAAAQUAAAAUE5HREFUQVBLAQIeAwoAAAAAAKVNLl0AAAAAAAAAAAAAAAAGABgAAAAAAAAAEADtQQAAAABwb3N0cy9V' +
  'VAUAA7Vfp2p1eAsAAQT1AQAABBQAAABQSwECHgMUAAAACAClTS5dMoRrggwAAAA8AAAADgAYAAAAAAABAAAApIFAAAAAcG9z' +
  'dHMvb25lLmh0bWxVVAUAA7Vfp2p1eAsAAQT1AQAABBQAAABQSwECHgMKAAAAAAClTS5deweXCggAAAAIAAAACQAYAAAAAAAB' +
  'AAAApIGUAAAAcG9zdHMuY3N2VVQFAAO1X6dqdXgLAAEE9QEAAAQUAAAAUEsBAh4DCgAAAAAApU0uXQ0ah60FAAAABQAAABMA' +
  'GAAAAAAAAQAAAKSB3wAAAHRp4bq/bmctdmnhu4d0Lmh0bWxVVAUAA7Vfp2p1eAsAAQT1AQAABBQAAABQSwECHgMKAAAAAACl' +
  'TS5dRxga2wcAAAAHAAAACQAYAAAAAAABAAAApIExAQAAaW1hZ2UucG5nVVQFAAO1X6dqdXgLAAEE9QEAAAQUAAAAUEsFBgAA' +
  'AAAFAAUAlwEAAHsBAAAAAA=='

const STORED =
  'UEsDBAoAAAAAAKVNLl0AAAAAAAAAAAAAAAAGABwAcG9zdHMvVVQJAAO1X6dqtV+nanV4CwABBPUBAAAEFAAAAFBLAwQKAAAA' +
  'AAClTS5dMoRrgjwAAAA8AAAADgAcAHBvc3RzL29uZS5odG1sVVQJAAO1X6dqtV+nanV4CwABBPUBAAAEFAAAAGhlbGxvIGhl' +
  'bGxvIGhlbGxvIGhlbGxvIGhlbGxvIGhlbGxvIGhlbGxvIGhlbGxvIGhlbGxvIGhlbGxvClBLAwQKAAAAAAClTS5deweXCggA' +
  'AAAIAAAACQAcAHBvc3RzLmNzdlVUCQADtV+narVfp2p1eAsAAQT1AQAABBQAAABhLGIKMSwyClBLAwQKAAAAAAClTS5dDRqH' +
  'rQUAAAAFAAAAEwAcAHRp4bq/bmctdmnhu4d0Lmh0bWxVVAkAA7Vfp2q1X6dqdXgLAAEE9QEAAAQUAAAAY2hhbwpQSwMECgAA' +
  'AAAApU0uXUcYGtsHAAAABwAAAAkAHABpbWFnZS5wbmdVVAkAA7Vfp2q1X6dqdXgLAAEE9QEAAAQUAAAAUE5HREFUQVBLAQIe' +
  'AwoAAAAAAKVNLl0AAAAAAAAAAAAAAAAGABgAAAAAAAAAEADtQQAAAABwb3N0cy9VVAUAA7Vfp2p1eAsAAQT1AQAABBQAAABQ' +
  'SwECHgMKAAAAAAClTS5dMoRrgjwAAAA8AAAADgAYAAAAAAAAAAAApIFAAAAAcG9zdHMvb25lLmh0bWxVVAUAA7Vfp2p1eAsA' +
  'AQT1AQAABBQAAABQSwECHgMKAAAAAAClTS5deweXCggAAAAIAAAACQAYAAAAAAAAAAAApIHEAAAAcG9zdHMuY3N2VVQFAAO1' +
  'X6dqdXgLAAEE9QEAAAQUAAAAUEsBAh4DCgAAAAAApU0uXQ0ah60FAAAABQAAABMAGAAAAAAAAAAAAKSBDwEAAHRp4bq/bmct' +
  'dmnhu4d0Lmh0bWxVVAUAA7Vfp2p1eAsAAQT1AQAABBQAAABQSwECHgMKAAAAAAClTS5dRxga2wcAAAAHAAAACQAYAAAAAAAA' +
  'AAAApIFhAQAAaW1hZ2UucG5nVVQFAAO1X6dqdXgLAAEE9QEAAAQUAAAAUEsFBgAAAAAFAAUAlwEAAKsBAAAAAA=='

const ZIP64 =
  'UEsDBC0AAAAAAKVNLl0AAAAA//////////8GADAAcG9zdHMvVVQJAAO1X6dqtV+nanV4CwABBPUBAAAEFAAAAAEAEAAAAAAA' +
  'AAAAAAAAAAAAAAAAUEsDBC0AAAAIAKVNLl0yhGuC//////////8OADAAcG9zdHMvb25lLmh0bWxVVAkAA7Vfp2q1X6dqdXgL' +
  'AAEE9QEAAAQUAAAAAQAQADwAAAAAAAAADAAAAAAAAADLSM3JyVfIIIfkAgBQSwMELQAAAAAApU0uXXsHlwr//////////wkA' +
  'MABwb3N0cy5jc3ZVVAkAA7Vfp2q1X6dqdXgLAAEE9QEAAAQUAAAAAQAQAAgAAAAAAAAACAAAAAAAAABhLGIKMSwyClBLAwQt' +
  'AAAAAAClTS5dDRqHrf//////////EwAwAHRp4bq/bmctdmnhu4d0Lmh0bWxVVAkAA7Vfp2q1X6dqdXgLAAEE9QEAAAQUAAAA' +
  'AQAQAAUAAAAAAAAABQAAAAAAAABjaGFvClBLAwQtAAAAAAClTS5dRxga2///////////CQAwAGltYWdlLnBuZ1VUCQADtV+n' +
  'arVfp2p1eAsAAQT1AQAABBQAAAABABAABwAAAAAAAAAHAAAAAAAAAFBOR0RBVEFQSwECHgMKAAAAAAClTS5dAAAAAAAAAAD/' +
  '////BgAkAAAAAAAAABAA7UEAAAAAcG9zdHMvVVQFAAO1X6dqdXgLAAEE9QEAAAQUAAAAAQAIAAAAAAAAAAAAUEsBAh4DLQAA' +
  'AAgApU0uXTKEa4IMAAAA/////w4AJAAAAAAAAQAAAKSBVAAAAHBvc3RzL29uZS5odG1sVVQFAAO1X6dqdXgLAAEE9QEAAAQU' +
  'AAAAAQAIADwAAAAAAAAAUEsBAh4DLQAAAAAApU0uXXsHlwoIAAAA/////wkAJAAAAAAAAQAAAKSBvAAAAHBvc3RzLmNzdlVU' +
  'BQADtV+nanV4CwABBPUBAAAEFAAAAAEACAAIAAAAAAAAAFBLAQIeAy0AAAAAAKVNLl0NGoetBQAAAP////8TACQAAAAAAAEA' +
  'AACkgRsBAAB0aeG6v25nLXZp4buHdC5odG1sVVQFAAO1X6dqdXgLAAEE9QEAAAQUAAAAAQAIAAUAAAAAAAAAUEsBAh4DLQAA' +
  'AAAApU0uXUcYGtsHAAAA/////wkAJAAAAAAAAQAAAKSBgQEAAGltYWdlLnBuZ1VUBQADtV+nanV4CwABBPUBAAAEFAAAAAEA' +
  'CAAHAAAAAAAAAFBLBgYsAAAAAAAAAB4DLQAAAAAAAAAAAAUAAAAAAAAABQAAAAAAAADTAQAAAAAAAN8BAAAAAAAAUEsGBwAA' +
  'AACyAwAAAAAAAAEAAABQSwUGAAAAAAUABQDTAQAA/////wAA'

const bytes = (b64: string): Uint8Array => Uint8Array.from(Buffer.from(b64, 'base64'))
const text = (b: Uint8Array): string => new TextDecoder().decode(b)

const ARCHIVES: [string, Uint8Array][] = [
  ['deflated', bytes(NORMAL)],
  ['stored', bytes(STORED)],
  ['zip64', bytes(ZIP64)],
]

const ONE_HTML = 'hello hello hello hello hello hello hello hello hello hello\n'

/** The offset of the nth record carrying `signature`, little-endian. Used to damage fixtures. */
function findRecord(b: Uint8Array, signature: number, nth = 0): number {
  let seen = 0
  for (let at = 0; at + 4 <= b.length; at++) {
    const word = (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0
    if (word === signature && seen++ === nth) return at
  }
  throw new Error(`no record 0x${signature.toString(16)} #${nth}`)
}

describe('the same five members, however they are stored', () => {
  for (const [how, archive] of ARCHIVES) {
    it(`${how}: reads every file and drops the directory entry`, () => {
      const found = unzip(archive)
      // Five members, four files: `posts/` is a directory and is not one of them.
      expect(found.map((e) => e.name).sort()).toEqual([
        'image.png',
        'posts.csv',
        'posts/one.html',
        'tiếng-việt.html',
      ])
      const by = Object.fromEntries(found.map((e) => [e.name, text(e.bytes)]))
      expect(by['posts/one.html']).toBe(ONE_HTML)
      expect(by['posts.csv']).toBe('a,b\n1,2\n')
      expect(by['tiếng-việt.html']).toBe('chao\n')
      expect(by['image.png']).toBe('PNGDATA')
    })

    it(`${how}: keep() decides before anything is decompressed`, () => {
      const found = unzip(archive, (n) => /\.(html|csv)$/i.test(n))
      expect(found.map((e) => e.name).sort()).toEqual([
        'posts.csv',
        'posts/one.html',
        'tiếng-việt.html',
      ])
    })
  }
})

// Info-ZIP writes this name as UTF-8 and leaves the UTF-8 flag CLEAR, which is why reading the
// flag rather than the bytes produces `tiáº¿ng-viá»t.html`. Both importers match the filename
// with an ASCII pattern, so the wrong answer was never a live bug here; it is still the wrong
// answer, and it would become one the moment a name reached a slug.
it('a UTF-8 name with the flag clear is still a UTF-8 name', () => {
  const flags = (() => {
    const at = findRecord(bytes(NORMAL), 0x02014b50, 3) // the fourth central record
    return bytes(NORMAL)[at + 8]! | (bytes(NORMAL)[at + 9]! << 8)
  })()
  expect((flags >> 11) & 1).toBe(0)
  expect(unzip(bytes(NORMAL)).map((e) => e.name)).toContain('tiếng-việt.html')
})

describe('an archive that is wrong says which way', () => {
  it('refuses bytes with no end record', () => {
    expect(() => unzip(bytes(NORMAL).slice(0, 200))).toThrow(ZipError)
    try {
      unzip(bytes(NORMAL).slice(0, 200))
    } catch (e) {
      expect((e as ZipError).code).toBe('not_a_zip')
    }
  })

  it('refuses an entry whose bytes do not match its checksum', () => {
    const damaged = bytes(STORED)
    // `stored.zip` keeps its text uncompressed, so one flipped letter in the data region is a
    // truncated-upload simulation that needs no knowledge of deflate. The whole phrase is
    // searched for, not one letter: the first `h` in this archive belongs to the name
    // `posts/one.html`, and flipping that renames the entry instead of corrupting it.
    const at = Buffer.from(damaged).indexOf('hello hello')
    expect(at).toBeGreaterThan(0)
    damaged[at] = 0x48 // 'H'
    try {
      unzip(damaged)
      throw new Error('a corrupt entry was accepted')
    } catch (e) {
      expect((e as ZipError).code).toBe('corrupt_entry')
    }
  })

  it('refuses a compression method it does not implement', () => {
    const odd = bytes(NORMAL)
    const at = findRecord(odd, 0x02014b50, 1) // posts/one.html, which is deflated
    odd[at + 10] = 12 // bzip2
    try {
      unzip(odd, (n) => n.endsWith('one.html'))
      throw new Error('an unknown method was accepted')
    } catch (e) {
      expect((e as ZipError).code).toBe('unsupported_compression')
    }
  })

  it('refuses an entry that would inflate past the limit', () => {
    try {
      unzip(bytes(NORMAL), (n) => n.endsWith('one.html'), 8)
      throw new Error('an oversized entry was accepted')
    } catch (e) {
      expect((e as ZipError).code).toBe('entry_too_large')
    }
  })

  it('holds the limit even when the entry lies about its size', () => {
    // The declared size is checked first, so a hostile archive understates it. zlib's own
    // `maxOutputLength` is what actually stops the read, which is why the cap is passed down
    // rather than compared against the header and forgotten.
    const lying = bytes(NORMAL)
    const at = findRecord(lying, 0x02014b50, 1)
    lying[at + 24] = 1 // uncompressed size: 1 byte, says the directory
    lying[at + 25] = 0
    lying[at + 26] = 0
    lying[at + 27] = 0
    try {
      unzip(lying, (n) => n.endsWith('one.html'), 8)
      throw new Error('a lying entry was accepted')
    } catch (e) {
      expect((e as ZipError).code).toBe('entry_too_large')
    }
  })
})
