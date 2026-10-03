// Cloudflare: satori's standalone build, given its layout engine as a module workerd compiled at
// deploy time. Initialised once per isolate.
import satori, { init } from 'satori/standalone'
import yoga from 'satori/yoga.wasm'
import type { SatoriPort } from '@/runtime/ports'

let ready: Promise<void> | null = null

export const loadSatori: SatoriPort['loadSatori'] = async () => {
  await (ready ??= init(yoga))
  return satori as unknown as Awaited<ReturnType<SatoriPort['loadSatori']>>
}
