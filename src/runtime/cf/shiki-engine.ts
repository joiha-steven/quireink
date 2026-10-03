// Cloudflare: Oniguruma from a STATICALLY imported WebAssembly module. A Worker may not compile WASM
// from bytes at run time ("Wasm code generation disallowed by embedder", G0), so Shiki's usual way —
// handing over the bytes — falls back to uncoloured code. Imported like this, workerd compiles the
// module at deploy time; measured: 174 of 174 samples byte-identical to Bun's output.
import onig from 'shiki/onig.wasm'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import type { LanguageRegistration } from 'shiki/core'
import grammars from 'quire:grammars'
import type { ShikiEnginePort } from '@/runtime/ports'
import { readAsset } from './assets'

// Shiki types its argument with the DOM's WebAssembly; workerd's is the same object under another name.
export const regexEngine: ShikiEnginePort['regexEngine'] = () =>
  createOnigurumaEngine(onig as unknown as Parameters<typeof createOnigurumaEngine>[0])

/**
 * THE GRAMMARS ARE STATIC ASSETS, NOT CODE, since 2026-10-03. Bun reaches each one through a
 * dynamic `import()`, and a Worker built without code splitting has nowhere to put a module it may
 * never load, so all of them went INTO `worker.js`: 7.8 MB of the 16.14 MB, parsed by every isolate
 * that started, including the front Worker that only forwards. `scripts/build-worker.ts` now writes
 * each grammar Shiki ships ONCE, as the JSON it was parsed from, under `/static/shiki/`, and
 * `quire:grammars` names which files make up each language, in the order Shiki's module lists them.
 *
 * One fetch per grammar per isolate, through the binding (never the network), and the parsed
 * object is kept: `markdown` and `mdx` share forty grammars, and Bun's module cache hands both the
 * same objects too. Frozen at the top level because Shiki's own modules freeze theirs, so the
 * registry receives the same kind of object on both runtimes. A fetch that fails is forgotten, so
 * the next fence retries rather than inheriting the failure for the life of the isolate.
 */
const parsed = new Map<number, Promise<LanguageRegistration>>()

function grammarFile(index: number): Promise<LanguageRegistration> {
  let p = parsed.get(index)
  if (!p) {
    const path = grammars.files[index]
    if (!path) return Promise.reject(new Error(`no grammar file ${index} in this build`))
    p = readAsset(path).then((bytes) => Object.freeze(JSON.parse(new TextDecoder().decode(bytes)) as LanguageRegistration))
    p.catch(() => parsed.delete(index))
    parsed.set(index, p)
  }
  return p
}

export const grammar: ShikiEnginePort['grammar'] = async (id) => {
  const files = grammars.langs[id]
  if (!files) throw new Error(`Shiki has no grammar called ${id}`)
  return Promise.all(files.map(grammarFile))
}
