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
  z.on('error', (error: Error) => { failed = error })
  return new TransformStream<Uint8Array, Uint8Array>({
    start(controller) {
      z.on('data', (out: Buffer) => controller.enqueue(new Uint8Array(out.buffer, out.byteOffset, out.byteLength)))
    },
    transform(chunk) {
      return new Promise<void>((done, fail) => {
        if (failed) { fail(failed); return }
        if (z.write(chunk)) done()
        else z.once('drain', () => done())
      })
    },
    flush() {
      return new Promise<void>((done, fail) => {
        if (failed) { fail(failed); return }
        z.once('end', () => done())
        z.once('error', fail)
        z.end()
      })
    },
  })
}

export const gzipStage = (): TransformStream<Uint8Array, Uint8Array> => zlibStage(createGzip())

/** A damaged or truncated gzip fails the stream with zlib's own error. */
export const gunzipStage = (): TransformStream<Uint8Array, Uint8Array> => zlibStage(createGunzip())
