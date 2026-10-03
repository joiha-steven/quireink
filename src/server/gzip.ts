// gzip and gunzip as web stream stages, through `node:zlib` (which both runtimes have) rather
// than `CompressionStream` / `DecompressionStream`.
//
// Measured 2026-10-03, the backup archive of 200,000 analytics events built in one Bun process:
// `CompressionStream('gzip')` added 18 MB of resident memory over zlib's own stream, and on
// 600,000 events 40 MB — it grows with what it is fed, where zlib holds a few MB whatever the
// input. On a 128 MB Durable Object that difference is whether the backup happens.
//
// Each write waits for zlib to take it (`drain`), so a slow reader at the far end holds the
// producer back rather than letting its output pile up here.
import { createGunzip, createGzip, type Gunzip, type Gzip } from 'node:zlib'

function zlibStage(z: Gzip | Gunzip): TransformStream<Uint8Array, Uint8Array> {
  let failed: Error | null = null
  // The one write or flush waiting on zlib, woken by `drain`/`end` — or by an error, which zlib
  // reports INSTEAD of either: a damaged gzip that only waited for `drain` would wait for ever.
  let waiting: ((error: Error | null) => void) | null = null
  z.on('error', (error: Error) => {
    failed = error
    const wake = waiting
    waiting = null
    wake?.(error)
  })
  const wait = (event: 'drain' | 'end'): Promise<void> => new Promise<void>((done, fail) => {
    waiting = (error) => (error ? fail(error) : done())
    z.once(event, () => {
      const wake = waiting
      waiting = null
      wake?.(null)
    })
  })
  return new TransformStream<Uint8Array, Uint8Array>({
    start(controller) {
      z.on('data', (out: Buffer) => {
        // zlib may still be emptying its buffer after whoever reads this has gone away (a restore
        // that refused the archive half-way): enqueuing then throws inside an event emitter,
        // where nothing can catch it, so the stage stops zlib instead.
        try {
          controller.enqueue(new Uint8Array(out.buffer, out.byteOffset, out.byteLength))
        } catch {
          z.destroy()
        }
      })
    },
    async transform(chunk) {
      if (failed) throw failed
      if (!z.write(chunk)) await wait('drain')
      if (failed) throw failed
    },
    async flush() {
      if (failed) throw failed
      const ended = wait('end')
      z.end()
      await ended
    },
  })
}

export const gzipStage = (): TransformStream<Uint8Array, Uint8Array> => zlibStage(createGzip())

/** A damaged or truncated gzip fails the stream with zlib's own error. */
export const gunzipStage = (): TransformStream<Uint8Array, Uint8Array> => zlibStage(createGunzip())
