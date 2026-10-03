// THE SEAM BETWEEN QUIRE INK AND WHAT RUNS IT (ADR 0066).
//
// One codebase, two runtimes: Bun (a process: the source checkout and the image) and Cloudflare
// (a Worker and a Durable Object). Everything that differs between them — files, sockets, child
// processes, a WASM module that has to be loaded one way here and another way there — lives in one
// file per runtime with the SAME path and the SAME exports:
//
//   src/runtime/bun/<name>.ts     what Bun runs
//   src/runtime/cf/<name>.ts      what Cloudflare runs
//
// and the rest of the tree imports it as `@/runtime/impl/<name>`. `tsconfig.json` points that at
// `bun/` (which is what `bun test`, `bun src/index.ts` and the image resolve); the Cloudflare build
// points it at `cf/`, and its own type-check proves the `cf/` files fit every call site the `bun/`
// files do. Nothing chooses at run time, so nothing that one runtime cannot load is ever loaded.
//
// THE RULE THE SEAM EXISTS FOR, and `check:runtime` holds it: outside `src/runtime/bun/` and
// `src/runtime/cf/`, no file imports `bun:*`, `node:fs`, `node:net`, `node:tls`,
// `node:child_process` or `cloudflare:*`, or touches the `Bun` global. A pure-JS implementation
// both runtimes can share beats two adapters, because one implementation cannot drift from itself.
//
// The contracts below are what both sides must satisfy. Each implementation file says
// `satisfies` against its contract, so a missing or mistyped export fails to compile on that side.
import type { RegexEngine } from 'shiki'

/** `shiki-engine.ts`: the regex engine syntax highlighting runs on. */
export type ShikiEnginePort = {
  regexEngine: () => Promise<RegexEngine>
}
