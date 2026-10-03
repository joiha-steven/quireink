// What the admin shell needs to know about one built file of the admin WITHOUT reading it on the
// request path: its content type, its content hash, and the chunks it imports statically.
//
// Shared by both runtimes and by `scripts/build-worker.ts`, so the three agree by construction.
// Bun works these out when it reads `src/admin/dist/` (`bun/assets.ts`). The Cloudflare build works
// them out once, at build time, and the Worker carries only the answers (`cf/assets.ts`): until
// 2026-10-03 it carried every file instead, as base64 decoded at module load — 50.7 ms of CPU in
// every isolate that started, the front Worker included, for bytes only an owner's page ever asks
// for. The bytes are Static Assets now, and the shell can still be drawn from the facts alone.
import { contentHash } from '@/web/content-hash'
import type { AdminFile } from '@/runtime/ports'

const TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

/** The content type of a built file, or null when it is not one the admin serves. */
export const adminFileType = (name: string): string | null => TYPES[name.slice(name.lastIndexOf('.'))] ?? null

/**
 * Every chunk a built module imports STATICALLY, by its `./name.js`.
 *
 * `from"./x.js"` and the bare side-effect form `import"./x.js"`. A dynamic import has a parenthesis
 * between the keyword and the string, so it cannot match — which is the point: the shell preloads
 * what an entry needs before it can run (`web/admin/spa.ts`, `bootChunks`), and a dynamic import is
 * a thing the owner may never open.
 */
export function staticImports(code: string): string[] {
  const found: string[] = []
  for (const match of code.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) {
    const dep = match[1] ?? ''
    if (dep && !found.includes(dep)) found.push(dep)
  }
  return found
}

/**
 * One built file, from its bytes in memory: Bun's, and the build's on its way to writing the facts
 * down. The hash and the imports are worked out on first use and kept, so a Bun boot still pays only
 * for the few files the shell actually asks about (the two sheets, the rail and what it imports),
 * as it did when `spa.ts` hashed and scanned them itself.
 */
export function adminFile(name: string, bytes: Uint8Array): AdminFile {
  let hash: string | null = null
  let imports: string[] | null = null
  return {
    type: adminFileType(name) ?? 'application/octet-stream',
    get hash() { return (hash ??= contentHash(bytes)) },
    get imports() { return (imports ??= name.endsWith('.js') ? staticImports(new TextDecoder().decode(bytes)) : []) },
    body: async () => bytes,
  }
}
