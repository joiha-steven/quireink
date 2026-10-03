// Bun: satori as it ships, loaded on first use (`render/og-card.ts` says why it is not at boot).
import type { SatoriPort } from '@/runtime/ports'

export const loadSatori: SatoriPort['loadSatori'] = async () => (await import('satori')).default
