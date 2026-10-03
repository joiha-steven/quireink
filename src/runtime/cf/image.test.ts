// What the Cloudflare image port hands its binding: the picture in hand, not a copy of it.
//
// It handed `new Blob([new Uint8Array(buf)]).stream()`, which copies the bytes twice per call, and
// an upload makes up to nine calls: a 25 MB original came to 450 MB of copies in a 128 MB isolate.
// The binding here is a fake that reads what it is given; the real one, in workerd, is
// `bun run test:cf`, which also holds the outputs to the old path's byte for byte.
import { describe, expect, it } from 'bun:test'
import { bind, type CfEnv } from '@/runtime/cf/bindings'
import { encodeVariant, imageSize, makeThumb } from '@/runtime/cf/image'

const chunks: Uint8Array[] = []
const read = async (s: ReadableStream<Uint8Array>) => { for await (const c of s) chunks.push(c) }
const IMAGES = {
  async info(s: ReadableStream<Uint8Array>) { await read(s); return { width: 3000, height: 2000, format: 'image/png', fileSize: 0 } },
  input(s: ReadableStream<Uint8Array>) {
    const fed = read(s)
    const chain = {
      transform: () => chain,
      output: async () => { await fed; return { response: () => new Response(new Uint8Array(4)) } },
    }
    return chain
  },
}
bind({ IMAGES } as unknown as CfEnv, {} as DurableObjectState)

describe('cf/image input', () => {
  it('hands over a view of the buffer it was given, every byte, and leaves the buffer as it was', async () => {
    // A view into a larger buffer, as `Buffer.from(arrayBuffer, offset)` and the pool make.
    const backing = new ArrayBuffer(4096)
    const buf = Buffer.from(backing, 100, 3000).fill(9)
    await imageSize(buf)
    await makeThumb(buf, 400)
    await encodeVariant(buf, 1024, 'avif')
    expect(chunks).toHaveLength(3)
    for (const c of chunks) {
      expect(c.buffer).toBe(backing) // no copy made on this side
      expect(c.byteOffset).toBe(100)
      expect(c.byteLength).toBe(3000)
    }
    expect(buf.byteLength).toBe(3000)
    expect(buf.every((b) => b === 9)).toBe(true)
  })
})
