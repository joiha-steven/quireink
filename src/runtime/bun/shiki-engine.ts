// Bun: Oniguruma, with its WASM handed over as the bytes Shiki ships. This is exactly what
// `createHighlighter` does when it is given no engine; it is spelled out because Cloudflare cannot
// do the same — a Worker may not compile WASM from bytes at run time ("Wasm code generation
// disallowed by embedder", measured 2026-10-03), so `cf/shiki-engine.ts` imports the module
// statically instead, and the two must stay the same engine to print the same HTML.
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import type { LanguageRegistration } from 'shiki/core'
import type { ShikiEnginePort } from '@/runtime/ports'

export const regexEngine: ShikiEnginePort['regexEngine'] = () => createOnigurumaEngine(import('shiki/wasm'))

type GrammarModule = () => Promise<{ default: LanguageRegistration[] }>

/**
 * The grammar module Shiki's full bundle would have imported for this id, imported the same way:
 * `bundledLanguages` is one static `import()` per language, which `bun build --compile` follows into
 * the binary and Bun resolves only when called, so a blog still pays for the languages it writes and
 * no others. Deduplicated as Shiki's own `resolveLangs` does it, so what reaches the registry is what
 * reached it through `createHighlighter` before 2026-10-03, object for object.
 */
export const grammar: ShikiEnginePort['grammar'] = async (id) => {
  const { bundledLanguages } = await import('shiki/langs')
  const load = (bundledLanguages as Record<string, GrammarModule | undefined>)[id]
  if (!load) throw new Error(`Shiki has no grammar called ${id}`)
  return [...new Set((await load()).default)]
}
