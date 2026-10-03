// The short hash in an asset's URL (`site.<hash>.css`, `core.<hash>.js`, `boot.<hash>.js`).
//
// Not a security boundary: its whole job is to change whenever the bytes change, so a browser and
// a CDN can keep the file forever. SHA-256 from `node:crypto`, cut to twelve hex characters, since
// 2026-10-03 — it was `Bun.hash` (wyhash), which only Bun has. These run once per file when a
// module loads, never per request, so the difference in speed costs nothing, and the same function
// now names the same file the same way on both runtimes (ADR 0066), which is what lets the parity
// crawl compare pages without rewriting their asset URLs first.
import { createHash } from 'node:crypto'

export function contentHash(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 12)
}
