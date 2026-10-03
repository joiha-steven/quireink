// Cloudflare: Oniguruma from a STATICALLY imported WebAssembly module. A Worker may not compile WASM
// from bytes at run time ("Wasm code generation disallowed by embedder", G0), so Shiki's usual way —
// handing over the bytes — falls back to uncoloured code. Imported like this, workerd compiles the
// module at deploy time; measured: 174 of 174 samples byte-identical to Bun's output.
import onig from 'shiki/onig.wasm'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import type { ShikiEnginePort } from '@/runtime/ports'

// Shiki types its argument with the DOM's WebAssembly; workerd's is the same object under another name.
export const regexEngine: ShikiEnginePort['regexEngine'] = () =>
  createOnigurumaEngine(onig as unknown as Parameters<typeof createOnigurumaEngine>[0])
