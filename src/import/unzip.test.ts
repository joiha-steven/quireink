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
    it(`${how}: reads every file and drops the directory entry`, async () => {
      const found = await unzip(archive)
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

    it(`${how}: keep() decides before anything is decompressed`, async () => {
      const found = await unzip(archive, (n) => /\.(html|csv)$/i.test(n))
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
it('a UTF-8 name with the flag clear is still a UTF-8 name', async () => {
  const flags = (() => {
    const at = findRecord(bytes(NORMAL), 0x02014b50, 3) // the fourth central record
    return bytes(NORMAL)[at + 8]! | (bytes(NORMAL)[at + 9]! << 8)
  })()
  expect((flags >> 11) & 1).toBe(0)
  expect((await unzip(bytes(NORMAL))).map((e) => e.name)).toContain('tiếng-việt.html')
})

describe('an archive that is wrong says which way', () => {
  it('refuses bytes with no end record', async () => {
    await expect(unzip(bytes(NORMAL).slice(0, 200))).rejects.toThrow(ZipError)
    try {
      await unzip(bytes(NORMAL).slice(0, 200))
    } catch (e) {
      expect((e as ZipError).code).toBe('not_a_zip')
    }
  })

  it('refuses an entry whose bytes do not match its checksum', async () => {
    const damaged = bytes(STORED)
    // `stored.zip` keeps its text uncompressed, so one flipped letter in the data region is a
    // truncated-upload simulation that needs no knowledge of deflate. The whole phrase is
    // searched for, not one letter: the first `h` in this archive belongs to the name
    // `posts/one.html`, and flipping that renames the entry instead of corrupting it.
    const at = Buffer.from(damaged).indexOf('hello hello')
    expect(at).toBeGreaterThan(0)
    damaged[at] = 0x48 // 'H'
    try {
      await unzip(damaged)
      throw new Error('a corrupt entry was accepted')
    } catch (e) {
      expect((e as ZipError).code).toBe('corrupt_entry')
    }
  })

  it('refuses a compression method it does not implement', async () => {
    const odd = bytes(NORMAL)
    const at = findRecord(odd, 0x02014b50, 1) // posts/one.html, which is deflated
    odd[at + 10] = 12 // bzip2
    try {
      await unzip(odd, (n) => n.endsWith('one.html'))
      throw new Error('an unknown method was accepted')
    } catch (e) {
      expect((e as ZipError).code).toBe('unsupported_compression')
    }
  })

  it('refuses an entry that would inflate past the limit', async () => {
    try {
      await unzip(bytes(NORMAL), (n) => n.endsWith('one.html'), 8)
      throw new Error('an oversized entry was accepted')
    } catch (e) {
      expect((e as ZipError).code).toBe('entry_too_large')
    }
  })

  // Each entry was capped and the sum was not: a thousand small entries could inflate to
  // gigabytes between them (2026-09-30).
  it('refuses an archive whose kept entries together pass the total', async () => {
    try {
      await unzip(bytes(NORMAL), () => true, 1024 * 1024, 8)
      throw new Error('an archive past its total was accepted')
    } catch (e) {
      expect((e as ZipError).code).toBe('entry_too_large')
    }
  })

  it('holds the limit even when the entry lies about its size', async () => {
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
      await unzip(lying, (n) => n.endsWith('one.html'), 8)
      throw new Error('a lying entry was accepted')
    } catch (e) {
      expect((e as ZipError).code).toBe('entry_too_large')
    }
  })
})

// The import reads an uploaded archive a slice at a time (`unzipBlob`): the directory from the
// end, then only the entries kept. Held here by counting what was asked for — a reader that
// fetched the pictures too would pass every test above and still hold a 100 MB upload in memory.
it('reads only the end, the directory and the kept entries — never the rest', async () => {
  const { unzipFrom } = await import('@/import/unzip')
  const archive = bytes(NORMAL)
  let read = 0
  const found = await unzipFrom(async (start, end) => { read += end - start; return archive.subarray(start, end) }, archive.length, (n) => n.endsWith('.csv'))
  expect(found.map((e) => e.name)).toEqual(['posts.csv'])
  // The tail scan reads up to 64 KB, which on this small fixture is the whole file; so ask a
  // big archive instead: a megabyte of picture behind a small text entry.
  const { ZipWriter } = await import('@/import/zip-write')
  const parts: Uint8Array[] = []
  const zip = new ZipWriter({ write: (b: Uint8Array) => { parts.push(new Uint8Array(b)) } }, new Date('2026-10-03T00:00:00Z'))
  zip.addText('post.md', 'hello')
  // Random, so it does not deflate to nothing: a real picture's bytes stay its size in the archive.
  zip.addText('picture.png', Buffer.from(crypto.getRandomValues(new Uint8Array(750_000))).toString('base64'))
  zip.finish()
  const big = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { big.set(p, at); at += p.length }
  read = 0
  const md = await unzipFrom(async (start, end) => { read += end - start; return big.subarray(start, end) }, big.length, (n) => n.endsWith('.md'))
  expect(md.map((e) => e.name)).toEqual(['post.md'])
  expect(big.length).toBeGreaterThan(750_000)
  expect(read).toBeLessThan(80_000)
})
