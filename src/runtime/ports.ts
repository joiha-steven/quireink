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

/** `password.ts`: argon2id, with the parameters `@/auth/password` passes (ADR 0068). */
export type PasswordPort = {
  hash: (password: string, params: { memoryCost: number; timeCost: number }) => Promise<string>
  /** False for a wrong password AND for a hash that will not parse; never throws. */
  verify: (password: string, hash: string) => Promise<boolean>
}

/** `runtime-info.ts`: what to call this runtime on the dashboard's system line. */
export type RuntimeInfoPort = {
  runtimeLabel: () => string
  /** The machine it runs on, e.g. `Ubuntu 26.04 LTS (x64)`. */
  machineLabel: () => string
  /** The raw contents of the build's commit file, or null; `server/build-info.ts` validates it. */
  readBuildSha: () => string | null
}

/**
 * `compress.ts`: the response-compression middleware. Bun compresses here (brotli and gzip, with a
 * content-addressed cache, `bun/compress.ts`); on Cloudflare the edge compresses, and doing it in
 * the Worker as well sent `br(br(html))` (measured 2026-10-03), so the Cloudflare side passes
 * responses through untouched.
 */
export type CompressPort = {
  compression: () => import('hono').MiddlewareHandler
}

/**
 * `socket.ts`: a text connection to a mail server, for `news/smtp.ts`, whose protocol stays ONE
 * implementation on both runtimes. Bun opens it with `node:net`/`node:tls`; Cloudflare with
 * `connect()` from `cloudflare:sockets` and its `startTls()` (ports 587 and 465; 25 is blocked).
 */
export type TextSocket = {
  /** Every chunk as it arrives, decoded as UTF-8. One listener; set again after `startTls`. */
  onData: (listener: (chunk: string) => void) => void
  /** The connection ended: with the error that ended it, or null when the server closed it. */
  onEnd: (listener: (error: Error | null) => void) => void
  write: (text: string) => void
  /** STARTTLS: the same connection, encrypted from here on. This socket is spent; use the one returned. */
  startTls: (host: string) => Promise<TextSocket>
  close: () => void
  readonly encrypted: boolean
}

export type SocketPort = {
  /** Connected and, when `secure`, already through the TLS handshake. Rejects after `timeoutMs`. */
  openSocket: (opts: { host: string; port: number; secure: boolean }, timeoutMs: number) => Promise<TextSocket>
  /** The name this machine gives itself in EHLO. */
  mailHostname: () => string
}

/**
 * `assets.ts`: files that ship with the code — fonts, icons, the admin's built bundle. A file is
 * named by what `import x from '…' with { type: 'file' }` gives (`ref`): on Bun a path on disk, on
 * Cloudflare a path in the Static Assets the Worker was deployed with.
 */
export type AssetsPort = {
  /** The bytes, e.g. a font for the OG card. */
  readAsset: (ref: string) => Promise<ArrayBuffer>
  /** A body to stream the file in a Response. */
  assetBody: (ref: string) => Promise<Blob | ReadableStream<Uint8Array> | ArrayBuffer>
  /** The admin's built files by name, loaded once and synchronously (the shell needs their names). */
  adminDist: () => ReadonlyMap<string, { body: Uint8Array; type: string }>
}
