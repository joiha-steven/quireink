// The Cloudflare package of a release (`scripts/pack-worker.ts`), unpacked whole into memory: it is
// small (about 20 MB) and read once per install. The reading itself is the archive's reader
// (`server/tar.ts`: ustar, PAX and GNU long names, every header's checksum), so there is one tar
// reader in the codebase rather than two that disagree about an edge.
import { tarEntries } from '@/server/tar'

async function* once(bytes: Uint8Array): AsyncGenerator<Uint8Array> {
  yield bytes
}

export async function readTar(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>()
  for await (const item of tarEntries(once(bytes))) {
    if (item.kind !== 'file') {
      await item.skip()
      continue
    }
    const parts: Uint8Array[] = []
    for await (const chunk of item.body()) parts.push(chunk)
    const body = new Uint8Array(item.size)
    let at = 0
    for (const p of parts) { body.set(p, at); at += p.length }
    out.set(item.name.replace(/^\.\//, ''), body)
  }
  return out
}
