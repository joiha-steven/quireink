// Bun: how this runtime does the things the two do differently (`ports.ts`, `docs/runtimes.md`).
import type { Capabilities } from '@/runtime/ports'

export const CAPABILITIES: Capabilities = {
  compression: 'origin',
  imageEngine: 'sharp',
  cardRenderer: 'sharp',
  passwordHash: 'bun-native',
  preMigrationCopy: 'file',
  clock: 'timer',
  store: 'disk',
  clientAddress: 'peer',
}
