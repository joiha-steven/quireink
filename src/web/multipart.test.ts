// The streaming multipart reader, held to what a real `FormData` serialises to.
//
// The body is fed in chunks of every awkward size, because the one thing a streaming reader can
// get wrong that a whole-body parser cannot is a boundary that arrives split across two chunks.
import { describe, expect, it } from 'bun:test'
import { boundaryOf, fieldText, multipart } from '@/web/multipart'

async function encoded(): Promise<{ bytes: Uint8Array; type: string; file: Uint8Array }> {
  const file = new Uint8Array(200_000).map((_, i) => (i * 7) & 0xff)
  const form = new FormData()
  form.set('token', 'abc-123')
  form.set('passphrase', 'two words, ünïcode')
  form.set('archive', new File([file], 'quire.tar.gz'))
  const req = new Request('http://x/', { method: 'POST', body: form })
  // Read before the body: Bun forgets a FormData request's content type once it is consumed.
  const type = req.headers.get('content-type') ?? ''
  return { bytes: new Uint8Array(await req.arrayBuffer()), type, file }
}

async function* chunks(bytes: Uint8Array, size: number): AsyncGenerator<Uint8Array> {
  for (let at = 0; at < bytes.length; at += size) yield bytes.subarray(at, at + size)
}

describe('multipart', () => {
  it('reads fields and a file, in order, whatever the chunk size', async () => {
    const { bytes, type, file } = await encoded()
    const boundary = boundaryOf(type)!
    expect(boundary).toBeTruthy()
    for (const size of [1, 7, 70, 4096, 1_000_000]) {
      const seen: Record<string, string> = {}
      let got: Uint8Array | null = null
      const parts = multipart(chunks(bytes, size), boundary)
      for (let next = await parts.next(); !next.done; next = await parts.next()) {
        if (next.value.filename === null) { seen[next.value.name] = await fieldText(next.value); continue }
        const pieces: Uint8Array[] = []
        for await (const piece of next.value.body()) pieces.push(piece)
        got = new Uint8Array(Buffer.concat(pieces))
        expect(next.value.filename).toBe('quire.tar.gz')
      }
      expect(seen).toEqual({ token: 'abc-123', passphrase: 'two words, ünïcode' })
      expect(got).toEqual(file)
    }
  })

  it('skips a part nobody read, and refuses a body that ends inside one', async () => {
    const { bytes, type } = await encoded()
    const names: string[] = []
    for await (const part of multipart(chunks(bytes, 999), boundaryOf(type)!)) names.push(part.name)
    expect(names).toEqual(['token', 'passphrase', 'archive'])
    const cut = bytes.subarray(0, bytes.length - 5000)
    const read = async () => { for await (const part of multipart(chunks(cut, 999), boundaryOf(type)!)) for await (const _ of part.body()) { /* drain */ } }
    await expect(read()).rejects.toThrow('ends inside a part')
  })

  it('takes only multipart/form-data with a boundary', () => {
    expect(boundaryOf('application/json')).toBeNull()
    expect(boundaryOf('multipart/form-data')).toBeNull()
    expect(boundaryOf('multipart/form-data; boundary="a b"')).toBe('a b')
  })

  it('refuses a field longer than a field can be', async () => {
    const form = new FormData()
    form.set('token', 'x'.repeat(5000))
    const req = new Request('http://x/', { method: 'POST', body: form })
    const boundary = boundaryOf(req.headers.get('content-type')!)!
    const parts = multipart(chunks(new Uint8Array(await req.arrayBuffer()), 512), boundary)
    const first = await parts.next()
    await expect(fieldText(first.value!)).rejects.toThrow('longer than a field')
  })
})
