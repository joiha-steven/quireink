// The scripts the image carries can run inside it.
//
// The runtime stage copies `scripts/` file by file, on purpose (the Dockerfile says why), and that
// is how `restore.ts` stayed out of the image for a whole release cycle while every doc called
// restoring one command: inside the container it answered `Module not found`. The matrix took the
// image's archive and restored it with the CHECKOUT's script, so nothing went red. A script that
// is copied without the file it imports fails the same way, at the same moment, so both are held.
//
// `src/` and `tsconfig.json` are copied whole, so an `@/…` import resolves in the image; only a
// relative import out of `scripts/` can be left behind.
import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8')

/** Every `scripts/…` path the runtime stage copies, after the last `FROM`. */
function shipped(): Set<string> {
  const runtime = dockerfile.slice(dockerfile.lastIndexOf('\nFROM '))
  const copies = runtime.replace(/\\\n/g, ' ').split('\n').filter((l) => /^COPY --from=build /.test(l))
  const out = new Set<string>()
  for (const line of copies) for (const m of line.matchAll(/\/app\/(scripts\/[^\s]+)/g)) out.add(m[1]!)
  return out
}

/** The relative imports of one script, as paths from the repository root. */
function relativeImports(path: string): string[] {
  const text = readFileSync(join(ROOT, path), 'utf8')
  return [...text.matchAll(/\bfrom\s+'(\.{1,2}\/[^']+)'|import\(\s*'(\.{1,2}\/[^']+)'\s*\)/g)]
    .map((m) => normalize(join(dirname(path), m[1] ?? m[2]!)))
    .map((p) => (p.endsWith('.ts') ? p : `${p}.ts`))
}

describe('the image', () => {
  const files = shipped()

  it('carries the commands the docs tell an owner to run inside it', () => {
    for (const script of ['scripts/restore.ts', 'scripts/backup-decrypt.ts', 'scripts/user.ts']) {
      expect(files.has(script)).toBe(true)
    }
  })

  it('carries every file a copied script imports from outside src/', () => {
    const missing: string[] = []
    for (const script of files) {
      if (!script.endsWith('.ts')) continue
      expect(existsSync(join(ROOT, script))).toBe(true)
      for (const dep of relativeImports(script)) {
        if (!dep.startsWith('src/') && !files.has(dep)) missing.push(`${script} imports ${dep}`)
      }
    }
    expect(missing).toEqual([])
  })
})
