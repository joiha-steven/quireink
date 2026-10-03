// Cloudflare: how this runtime does the things the two do differently (`ports.ts`, `docs/runtimes.md`).
import type { Capabilities } from '@/runtime/ports'

export const CAPABILITIES: Capabilities = {
  compression: 'edge',
  imageEngine: 'cloudflare-images',
  cardRenderer: 'resvg',
  passwordHash: 'noble',
  preMigrationCopy: 'bookmark',
  clock: 'alarm',
  store: 'r2',
  clientAddress: 'edge',
  bodyLimits: 'isolate',
}
