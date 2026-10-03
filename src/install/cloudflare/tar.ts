// Read a tar archive held in memory: the Cloudflare package of a release (`scripts/pack-worker.ts`),
// which is small (about 20 MB) and read once per install. ustar, plus the PAX `path` record for a
// name longer than the header holds. Plain JS, so it runs on both runtimes.
const dec = new TextDecoder()

const field = (block: Uint8Array, at: number, len: number): string => {
  const raw = block.subarray(at, at + len)
  const end = raw.indexOf(0)
  return dec.decode(end < 0 ? raw : raw.subarray(0, end))
}

export function readTar(bytes: Uint8Array): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>()
  let at = 0
  let longName: string | null = null
  while (at + 512 <= bytes.length) {
    const header = bytes.subarray(at, at + 512)
    if (header.every((b) => b === 0)) break
    const prefix = field(header, 345, 155)
    const name = field(header, 0, 100)
    const size = parseInt(field(header, 124, 12).trim() || '0', 8)
    const type = String.fromCharCode(header[156] || 48)
    const body = bytes.subarray(at + 512, at + 512 + size)
    at += 512 + Math.ceil(size / 512) * 512
    if (type === 'x') {
      const path = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(dec.decode(body))
      longName = path ? path[1]! : null
      continue
    }
    if (type !== '0' && type !== '\0') { longName = null; continue }
    const path = (longName ?? (prefix ? `${prefix}/${name}` : name)).replace(/^\.\//, '')
    longName = null
    out.set(path, body)
  }
  return out
}
