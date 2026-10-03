// The tar writer is checked by the system's own tar, and the reader by archives it did not write.
//
// A writer and a reader from one hand can agree on the same misreading of the format, so each
// half here is held to an independent implementation: what `tarStream` writes has to list and
// extract with `tar` (bsdtar on a Mac, GNU tar on Linux and in CI), and what `tarEntries` reads
// includes an archive `tar` itself made.
import { describe, expect, it, afterAll } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { entryHeader, tarEntries, tarStream, type TarEntry } from '@/server/tar'

const DIR = './.tmp/test-tar'
rmSync(DIR, { recursive: true, force: true })
mkdirSync(DIR, { recursive: true })
afterAll(() => rmSync(DIR, { recursive: true, force: true }))

const enc = new TextEncoder()
const bytes = async (s: ReadableStream<Uint8Array>): Promise<Uint8Array> => new Uint8Array(await new Response(s).arrayBuffer())

async function readAll(archive: Uint8Array): Promise<{ name: string; kind: string; text: string }[]> {
  const out: { name: string; kind: string; text: string }[] = []
  for await (const item of tarEntries((async function* () { yield archive })())) {
    const parts: Uint8Array[] = []
    for await (const piece of item.body()) parts.push(piece)
    out.push({ name: item.name, kind: item.kind, text: Buffer.concat(parts).toString() })
  }
  return out
}

const LONG = `uploads/${'a-very-long-directory-name/'.repeat(5)}photo-élan-ünïcode.webp`

describe('tarStream', () => {
  it('writes what the system tar lists and extracts, long and non-ASCII names included', async () => {
    const entries: TarEntry[] = [
      { name: 'manifest.json', size: 2, body: enc.encode('{}') },
      { name: 'empty.txt', size: 0, body: new Uint8Array(0) },
      { name: LONG, size: 5, body: [enc.encode('he'), enc.encode('llo')] },
      { name: 'exact.bin', size: 512, body: new Uint8Array(512).fill(7) },
    ]
    const archive = await bytes(tarStream(entries))
    expect(archive.length % 512).toBe(0)
    const file = join(DIR, 'out.tar')
    writeFileSync(file, archive)
    const listed = (await Bun.$`tar -tf ${file}`.quiet().text()).trim().split('\n')
    // The long name is compared by extracting it below: bsdtar lists a non-ASCII name escaped
    // and decomposed, which is a fact about its terminal output and not about the archive.
    expect([listed[0], listed[1], listed[3]]).toEqual(['manifest.json', 'empty.txt', 'exact.bin'])
    expect(listed[2]).toStartWith('uploads/a-very-long-directory-name/')
    const into = join(DIR, 'x')
    mkdirSync(into, { recursive: true })
    await Bun.$`tar -xf ${file} -C ${into}`.quiet()
    expect(readFileSync(join(into, LONG), 'utf8')).toBe('hello')
    expect(readFileSync(join(into, 'exact.bin')).length).toBe(512)
  })

  it('refuses a body that is longer or shorter than the size it declared', async () => {
    await expect(bytes(tarStream([{ name: 'a', size: 2, body: enc.encode('abc') }]))).rejects.toThrow('longer')
    await expect(bytes(tarStream([{ name: 'a', size: 4, body: enc.encode('abc') }]))).rejects.toThrow('ended at 3')
  })

  it('puts a size past 8 GiB in a PAX record, which the ustar field cannot hold', () => {
    const blocks = entryHeader('big.bin', 9 * 1024 ** 3, 0)
    expect(blocks).toHaveLength(4)
    expect(new TextDecoder().decode(blocks[1])).toContain(`size=${9 * 1024 ** 3}\n`)
  })
})

describe('tarEntries', () => {
  it('reads back what the writer wrote, in order, byte for byte', async () => {
    const archive = await bytes(tarStream([
      { name: 'one.txt', size: 3, body: enc.encode('one') },
      { name: LONG, size: 3, body: enc.encode('two') },
    ]))
    expect(await readAll(archive)).toEqual([
      { name: 'one.txt', kind: 'file', text: 'one' },
      { name: LONG, kind: 'file', text: 'two' },
    ])
  })

  it('reads an archive the system tar made, directories and all', async () => {
    const src = join(DIR, 'src')
    mkdirSync(join(src, 'uploads', 'media'), { recursive: true })
    writeFileSync(join(src, 'quire.db'), 'db-bytes')
    writeFileSync(join(src, 'uploads', 'media', 'p.jpg'), 'jpeg')
    const file = join(DIR, 'sys.tar')
    await Bun.$`tar -cf ${file} -C ${src} quire.db uploads`.env({ ...process.env, COPYFILE_DISABLE: "1" }).quiet()
    const items = await readAll(new Uint8Array(readFileSync(file)))
    const files = items.filter((i) => i.kind === 'file').map((i) => [i.name.replace(/^\.\//, ''), i.text])
    expect(files).toEqual([['quire.db', 'db-bytes'], ['uploads/media/p.jpg', 'jpeg']])
    expect(items.some((i) => i.kind === 'dir')).toBe(true)
  })

  it('takes GNU tar\'s long-name entry, which the old archives carry for a deep upload path', async () => {
    const name = `uploads/${'x'.repeat(120)}.png`
    const longEntry = { name: '././@LongLink', size: name.length + 1, body: enc.encode(`${name}\0`) }
    // A writer's header with the type byte changed to `L` is exactly what GNU tar emits.
    const raw = await bytes(tarStream([longEntry, { name: name.slice(0, 100), size: 2, body: enc.encode('ok') }]))
    raw[156] = 'L'.charCodeAt(0)
    let sum = 0
    raw.fill(0x20, 148, 156)
    for (let i = 0; i < 512; i++) sum += raw[i]!
    raw.set(enc.encode(sum.toString(8).padStart(6, '0') + '\0 '), 148)
    expect(await readAll(raw)).toEqual([{ name, kind: 'file', text: 'ok' }])
  })

  it('skips a body nobody read, and one read halfway, and finds the next header', async () => {
    const archive = await bytes(tarStream([
      { name: 'a', size: 1000, body: new Uint8Array(1000).fill(1) },
      { name: 'b', size: 1000, body: new Uint8Array(1000).fill(2) },
      { name: 'c', size: 1, body: enc.encode('c') },
    ]))
    const seen: string[] = []
    let i = 0
    for await (const item of tarEntries((async function* () {
      for (let at = 0; at < archive.length; at += 300) yield archive.subarray(at, at + 300)
    })())) {
      seen.push(item.name)
      if (i++ === 1) for await (const _ of item.body()) break
    }
    expect(seen).toEqual(['a', 'b', 'c'])
  })

  it('refuses a damaged header rather than reading garbage as a file', async () => {
    const archive = await bytes(tarStream([{ name: 'a', size: 1, body: enc.encode('a') }]))
    archive[10] = 0x41
    await expect(readAll(archive)).rejects.toThrow('checksum')
  })
})
