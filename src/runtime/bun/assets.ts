// Bun: files that ship with the code are files on disk beside it. `Bun.file` streams them without
// reading them into memory first, which is what a font on every article page wants.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AssetsPort } from '@/runtime/ports'

export const readAsset: AssetsPort['readAsset'] = (ref) => Bun.file(ref).arrayBuffer()

export const assetBody: AssetsPort['assetBody'] = async (ref) => Bun.file(ref)

const DIR = join(import.meta.dir, '../../admin/dist')

const TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

let dist: Map<string, { body: Uint8Array; type: string }> | null = null

/**
 * Every built file of the admin, by name, read once: the bundle is code-split, so the chunk names
 * carry a hash the bundler chose and there is no fixed list to import. A change to it arrives
 * with a restart, and re-reading per request would buy nothing but syscalls.
 */
export const adminDist: AssetsPort['adminDist'] = () => {
  if (dist) return dist
  dist = new Map()
  try {
    for (const name of readdirSync(DIR)) {
      const type = TYPES[name.slice(name.lastIndexOf('.'))]
      if (type) dist.set(name, { body: new Uint8Array(readFileSync(join(DIR, name))), type })
    }
  } catch {
    // A source checkout that has not run `bun run build:admin` yet. The admin route says so in
    // plain words rather than serving a blank page that looks like a broken admin.
  }
  return dist
}
