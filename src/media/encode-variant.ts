// ONE display variant, in a process of its own, and the process is the whole point.
//
// Run by `makeDisplay` in `image.ts`, once per width and format. It reads the original's
// bytes on stdin and writes the encoded ones to stdout, so nothing about it needs the
// database, the blob store or the app's configuration.
//
// WHY A CHILD AT ALL. libvips does not hand memory back. Measured 2026-09-21 in a container,
// six variants from one 2048px photograph in a single process: resident climbs 51 MB -> 66
// after the three WebP copies -> 106 after the 1024px AVIF -> 136 after the 1600px one, and
// stays there. In a long-lived server that climb is permanent, it lands on top of whatever
// the server already holds, and the sum is what the kernel kills: a blog of 33 posts and 18
// pictures was OOM-killed at 128, 160 AND 192 MB during the first variant sweep, two minutes
// after a boot that had looked healthy. Same work, one child per variant: the container's own
// high-water mark is 83 MB against 110 MB, and the parent — which never loads sharp on this
// path at all — peaks at 25 MB.
//
// `backup.ts` carries the same lesson in the other direction, and its comment is worth reading
// beside this one: it buffered a whole archive and was "OOM-killed with nothing in the log but
// a restart". This is that failure, arriving through the image codec instead of through tar.
//
// THE COST IS ONE BUN START PER VARIANT, measured at 113 ms over six of them — 1,821 ms
// against 1,708 ms for the same six encodes in one process. It runs on the maintenance tick,
// never on a request, so the 6.6% is spent where nobody is waiting.
//
// IT IS TOLD A WIDTH AND NOTHING ELSE, which is what keeps sharp out of the parent. The
// version this replaced computed `Math.min(width, originalWidth)`, so the caller had to know
// the original's width — and reading that in the parent loads the codec there and undoes the
// whole arrangement. The clamp turned out to be redundant anyway: `withoutEnlargement` is
// already the rule that a 900px source stays 900px at every larger size. Proved by removing
// it and watching `image.test.ts` still hold the widths, and by breaking `withoutEnlargement`
// and watching the same test go red.
import { sharp } from '@/media/sharp'

const [rawWidth, format, rawEffort] = process.argv.slice(2)
const width = Number(rawWidth)
if (!Number.isInteger(width) || width <= 0 || (format !== 'webp' && format !== 'avif')) {
  console.error(`usage: encode-variant.ts <width> <webp|avif> [effort]`)
  process.exit(2)
}

const draw = await sharp()
const source = Buffer.from(await Bun.readableStreamToArrayBuffer(Bun.stdin.stream()))
// `failOn: 'none'`, as everywhere else this codec is used: a truncated or slightly malformed
// upload should produce the best picture it can rather than refusing the whole image.
const pipe = draw(source, { failOn: 'none' })
  .rotate()
  .resize({ width, withoutEnlargement: true })
const encoded = await (format === 'webp'
  ? pipe.webp({ quality: 80 })
  : pipe.avif({ quality: 50, effort: Number(rawEffort) })
).toBuffer()
await Bun.write(Bun.stdout, encoded)
