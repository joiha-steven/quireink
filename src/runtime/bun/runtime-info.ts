// Bun: the runtime and its version, as the dashboard's system line has always printed it.
import { readFileSync, statSync } from 'node:fs'
import { release, type } from 'node:os'
import { join, resolve } from 'node:path'
import type { RuntimeInfoPort } from '@/runtime/ports'

export const runtimeLabel: RuntimeInfoPort['runtimeLabel'] = () => `Bun ${Bun.version}`

/**
 * The machine, for the dashboard's system line: the distribution's own name when it has one, and
 * the kernel's otherwise, with the architecture. Read once; it cannot change under a running
 * process. (Moved here from `web/admin/views-home.ts` with the comments that explain each choice.)
 */
let osCache: string | null = null
export const machineLabel: RuntimeInfoPort['machineLabel'] = (): string => {
  if (osCache === null) {
    let name = ''
    try {
      // PRETTY_NAME="Ubuntu 26.04 LTS" — quoted by the spec, and some distributions leave the
      // quotes off, so both shapes are accepted.
      const found = /^PRETTY_NAME="?([^"\n]+)"?/m.exec(readFileSync('/etc/os-release', 'utf8'))
      name = found?.[1]?.trim() ?? ''
    } catch {
      /* not a Linux with an os-release, or it is unreadable — the kernel answers instead */
    }
    if (!name) {
      const version = (release().match(/^\d+\.\d+/) ?? [''])[0]
      name = `${type()}${version ? ` ${version}` : ''}`
    }
    osCache = name
  }
  // The arch in parentheses, not behind a third `·`: the footer joins ITS facts with the
  // same separator, and two weights of the same mark turn one fact into two.
  return `${osCache} (${process.arch})`
}

/** The text of `build-sha` beside the checkout, or null when there is none. */
export const readBuildSha: RuntimeInfoPort['readBuildSha'] = () => {
  try {
    return readFileSync(resolve(process.cwd(), 'build-sha'), 'utf8')
  } catch {
    return null
  }
}

export const databaseBytes: RuntimeInfoPort['databaseBytes'] = () => {
  const dir = process.env.DATA_DIR || './data'
  let n = 0
  for (const f of ['quire.db', 'quire.db-wal', 'analytics.db', 'analytics.db-wal']) {
    try { n += statSync(join(dir, f)).size } catch { /* not there: nothing to count */ }
  }
  return n
}
