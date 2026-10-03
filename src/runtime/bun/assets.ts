// Bun: files that ship with the code are files on disk beside it. `Bun.file` streams them without
// reading them into memory first, which is what a font on every article page wants.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AdminFile, AssetsPort } from '@/runtime/ports'
import { adminFile, adminFileType } from '@/runtime/admin-dist'

export const readAsset: AssetsPort['readAsset'] = (ref) => Bun.file(ref).arrayBuffer()

export const assetBody: AssetsPort['assetBody'] = async (ref) => Bun.file(ref)

const DIR = join(import.meta.dir, '../../admin/dist')

let dist: Map<string, AdminFile> | null = null

/**
 * Every built file of the admin, by name, read once: the bundle is code-split, so the chunk names
 * carry a hash the bundler chose and there is no fixed list to import. A change to it arrives
 * with a restart, and re-reading per request would buy nothing but syscalls. The bytes stay in
 * memory as they always have; `body` hands them over as they are.
 */
export const adminDist: AssetsPort['adminDist'] = () => {
  if (dist) return dist
  dist = new Map()
  try {
    for (const name of readdirSync(DIR)) {
      if (!adminFileType(name)) continue
      dist.set(name, adminFile(name, new Uint8Array(readFileSync(join(DIR, name)))))
    }
  } catch {
    // A source checkout that has not run `bun run build:admin` yet. The admin route says so in
    // plain words rather than serving a blank page that looks like a broken admin.
  }
  return dist
}
