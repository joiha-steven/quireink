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

/**
 * `blob.ts`: where uploaded bytes live, under the facade in `media/blob.ts` (which owns the URL
 * rules and the size ceilings). Bun: a directory on disk. Cloudflare: an R2 bucket.
 */
export type BlobPort = {
  ensureBlobStore: () => void
  /** `exclusive`: refuse to overwrite a file that exists (the import's name-collision rule). */
  put: (pathname: string, body: Buffer | ArrayBuffer, opts?: { exclusive?: boolean }) => Promise<string>
  read: (pathname: string) => Promise<Buffer>
  statSize: (pathname: string) => Promise<number>
  stream: (pathname: string, range?: { start: number; end: number }) => ReadableStream
  del: (pathname: string) => Promise<void>
  list: (under?: string) => Promise<{ pathname: string; size: number }[]>
  storageWritable: () => Promise<boolean>
}

/**
 * `image.ts`: the operations the product does to pictures, not a codec's API. Bun runs sharp
 * (libvips), each display variant in a child process (ADR 0061); Cloudflare runs its Images binding,
 * and rasterises the OG card with a WASM renderer. The POLICY — which widths, which formats, the
 * cap on an original — stays in `media/image.ts`, shared.
 */
export type ImagePort = {
  /** Downscale to `cap` px wide keeping the format; anything that will not decode comes back untouched. */
  capOriginal: (buf: Buffer, contentType: string, cap: number) => Promise<Buffer>
  /** Pixel dimensions, auto-oriented. Throws when the bytes are not an image. */
  imageSize: (buf: Buffer) => Promise<{ width: number; height: number }>
  /** The library thumbnail: WebP, `width` px, never enlarged. */
  makeThumb: (buf: Buffer, width: number) => Promise<Buffer>
  /** One display variant, never enlarged. Throws when it could not be made; the sweep retries. */
  encodeVariant: (buf: Buffer, width: number, format: 'webp' | 'avif') => Promise<Buffer>
  /** The site logo at @2x of `cssWidth`: WebP for the page, PNG (alpha kept) for email or null. */
  renderLogo: (src: Buffer, cssWidth: number) => Promise<{ webp: Buffer; width: number; height: number; png: Buffer | null }>
  /** An SVG drawn to PNG at `density` dpi (the OG card). */
  rasterizeSvg: (svg: string, density: number) => Promise<Uint8Array>
}

/**
 * A value SQLite binds. A boolean goes in as 1 or 0 and a bigint as an integer, and both come back
 * as a `number`; a `Uint8Array` is a blob and comes back as one.
 */
export type SqlValue = string | number | bigint | boolean | null | Uint8Array

/**
 * Named parameters: `$name` in the SQL, BARE keys here (`{ name: … }`, not `{ $name: … }`). The wide
 * inserts use them, where counting seventeen question marks is how a column ends up in the wrong
 * place. Cloudflare binds positionally only, so its side rewrites `$name` to `?` in order.
 */
export type SqlNamed = Record<string, SqlValue>

/** Positional values for `?`, or ONE object of named ones. Never both. */
export type SqlParams = SqlValue[] | [SqlNamed]

/** What a write did: rows affected, and the rowid of the last row inserted on this connection. */
export type Changes = { changes: number; lastInsertRowid: number }

/**
 * `db.ts`: one open SQLite database. SYNCHRONOUS on both runtimes (`bun:sqlite`, and a Durable
 * Object's `ctx.storage.sql`), which is what lets the store have exactly one writer and no pool.
 *
 * `all`, `one` and `run` take ONE statement with bound values; nothing here interpolates. `exec`
 * takes a script of several statements and no values: the schema, a migration step, and the few
 * statements SQLite gives no bound form (`VACUUM INTO` a filename). `transaction` nests — an inner
 * one that throws rolls back only its own part, and the outer one goes on if it catches.
 * `body` must be synchronous: an async body would commit at its first `await`.
 */
export type Connection = {
  all: <T>(sql: string, ...params: SqlParams) => T[]
  /** The first row, or null when there is none. */
  one: <T>(sql: string, ...params: SqlParams) => T | null
  run: (sql: string, ...params: SqlParams) => Changes
  exec: (script: string) => void
  transaction: <T>(body: () => T) => T
  close: () => void
}

/**
 * `db.ts`: open (creating it if missing) the database at `path`. `synchronous` is how hard a commit
 * waits for the disk: content is worth an fsync per commit, analytics is not. A runtime with no
 * such setting (a Durable Object) ignores it.
 */
export type DbPort = {
  open: (path: string, synchronous: 'FULL' | 'NORMAL') => Connection
}

/**
 * `snapshot.ts`: the two halves of what an upgrade owes the person running it (ADR 0063), where
 * they need a FILE. A runtime with no file to copy or compact (a Durable Object: recovering from a
 * bad upgrade there is Cloudflare's point-in-time restore) answers null and false.
 *
 * `emptyCaches` is the store's, handed in so the copy carries the writing and not the cache; it
 * runs inside the same attempt as the copy and fails with it.
 */
export type SnapshotPort = {
  /** The copy's path, or null when this runtime keeps no copy. Throws when one cannot be written. */
  copyBeforeMigrating: (
    conn: Connection, path: string, step: string, emptyCaches: (conn: Connection) => void,
  ) => string | null
  /** Whether it compacted, in which case `conn` IS CLOSED and the caller opens `path` again. */
  compactIfMostlyFree: (
    conn: Connection, path: string, thresholds?: { minShare?: number; minBytes?: number },
  ) => boolean
}
