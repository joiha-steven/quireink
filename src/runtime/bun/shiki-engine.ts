// Bun: Oniguruma, with its WASM handed over as the bytes Shiki ships. This is exactly what
// `createHighlighter` does when it is given no engine; it is spelled out because Cloudflare cannot
// do the same — a Worker may not compile WASM from bytes at run time ("Wasm code generation
// disallowed by embedder", measured 2026-10-03), so `cf/shiki-engine.ts` imports the module
// statically instead, and the two must stay the same engine to print the same HTML.
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import type { ShikiEnginePort } from '@/runtime/ports'

export const regexEngine: ShikiEnginePort['regexEngine'] = () => createOnigurumaEngine(import('shiki/wasm'))
