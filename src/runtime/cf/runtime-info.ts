// Cloudflare: what the dashboard's system line says, and the commit the build was made from (the
// build script defines `__QUIRE_BUILD_SHA__`; there is no file to read).
import type { RuntimeInfoPort } from '@/runtime/ports'
import { bound } from './bindings'

declare const __QUIRE_BUILD_SHA__: string

export const runtimeLabel: RuntimeInfoPort['runtimeLabel'] = () => 'Cloudflare Workers'
export const machineLabel: RuntimeInfoPort['machineLabel'] = () => 'a Durable Object'
export const readBuildSha: RuntimeInfoPort['readBuildSha'] = () =>
  typeof __QUIRE_BUILD_SHA__ === 'string' && __QUIRE_BUILD_SHA__ ? __QUIRE_BUILD_SHA__ : null

export const databaseBytes: RuntimeInfoPort['databaseBytes'] = () => {
  try { return bound().ctx.storage.sql.databaseSize } catch { return 0 }
}
