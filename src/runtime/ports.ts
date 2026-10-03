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
  /**
   * What the databases take on disk, in bytes, or 0 when it cannot be read. Bun: the two files and
   * their write-ahead logs. Cloudflare: the Durable Object's SQLite, which is what it bills as storage.
   */
  databaseBytes: () => number
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
  /**
   * The next chunk, decoded as UTF-8; null once the server has closed the connection, and a
   * rejection with the error that ended it otherwise.
   *
   * ⚠️ PULLED, NOT PUSHED, and only while a reply is awaited. It was a listener until 2026-10-03,
   * which meant the Cloudflare side kept a read outstanding at all times — and workerd will not let
   * go of a stream with a read outstanding, so every STARTTLS on port 587 failed there with
   * "Cannot call releaseLock() on a reader with outstanding read promises". SMTP is strictly a
   * reply per command, so a client that reads only while it waits has nothing in flight when it
   * upgrades.
   */
  read: () => Promise<string | null>
  /** Errors surface on the next `read`. */
  write: (text: string) => void
  /**
   * STARTTLS: the same connection, encrypted from here on. This socket is spent; use the one
   * returned. Never called with a `read` outstanding (see `read`).
   */
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
  /**
   * Keep `text` aside, beside the data and out of every public path, for a person to recover by
   * hand (the settings that would not parse). Returns where it went, for the log.
   */
  keepAside: (dataDir: string, name: string, text: string) => string
  /**
   * A view of the database at `path` (open as `conn`) that holds still while the backup archive
   * reads it (ADR 0067), or null when this runtime reads the live connection instead. Bun: a
   * second, read-only connection holding one read transaction, which under WAL sees one moment
   * while the request path goes on writing. A Durable Object has no second connection and is
   * single-threaded besides. `dispose` ends the view; calling it twice is harmless.
   */
  consistentCopy: (conn: Connection, path: string) => { conn: Connection; dispose: () => void } | null
}

/** A snapshot kept by this runtime, as `archive.ts` lists it. */
export type KeptArchive = { name: string; size: number; mtimeMs: number }

/**
 * A kept archive handed out: its size now, its bytes only when `stream()` is called, and as a
 * stream. Bun answers the file itself (a `BunFile` is exactly this shape, and `Bun.S3Client` sends
 * one natively). It was a `Blob` until G4, and a Blob in a Worker is bytes in memory: an archive
 * past 64 MB was refused rather than read whole into 128 MB. Each `stream()` is a fresh read from
 * the start, so a caller that has to try again can.
 */
export type KeptBody = { readonly size: number; stream: () => ReadableStream<Uint8Array> }

/** One part of an archive arriving in pieces (`server/restore-parts.ts`), as the store holds it. */
export type HeldPart = { part: number; size: number }

/**
 * `archive.ts`: where finished backup archives live (ADR 0067). Bun: `BACKUP_DIR`, a directory
 * beside the data. Names reach here already checked by `isSnapshotName`; the implementation
 * refuses anything with a path in it all the same.
 */
export type ArchivePort = {
  /** Every file in the snapshot store; the caller keeps the ones whose names it made. */
  listKept: () => Promise<KeptArchive[]>
  /**
   * Write `body` under `name`, all of it or nothing: a failure leaves no file by that name and
   * no half-written one either. Returns the size.
   */
  writeKept: (name: string, body: ReadableStream<Uint8Array>) => Promise<number>
  /** The archive, its bytes read only as they are streamed, or null when there is none by that name. */
  openKept: (name: string) => Promise<KeptBody | null>
  removeKept: (name: string) => Promise<void>
  /**
   * Hold `body` somewhere until it has been sent once, for a download that has to declare its
   * length before the first byte (a browser shows no progress without one). The returned body
   * removes what it held when it ends or is cancelled.
   */
  stage: (name: string, body: ReadableStream<Uint8Array>) => Promise<{ size: number; body: ReadableStream<Uint8Array> }>

  // THE INCOMING HALF: an archive larger than one request may carry, arriving in numbered parts
  // for `/setup/restore/parts` (`server/restore-parts.ts`, which owns the ids and the rules). Bun:
  // files under `<DATA_DIR>/incoming/`; Cloudflare: objects under `private/incoming/` in the bucket,
  // which the blob port refuses to serve. An `id` reaches here already checked by its owner.

  /**
   * Keep `body`, exactly `size` bytes, as part `part` of `id`, replacing a part of that number. All
   * or nothing: a body that ends short or runs long leaves no part behind, and throws.
   */
  holdPart: (id: string, part: number, body: ReadableStream<Uint8Array>, size: number) => Promise<void>
  /** The parts of `id` held so far, in part order; none is an empty list. */
  heldParts: (id: string) => Promise<HeldPart[]>
  /** Parts 1..`count` of `id` read one after another as one stream, never more than a chunk in memory. */
  readHeld: (id: string, count: number) => ReadableStream<Uint8Array>
  /** Forget `id` and every part of it. Harmless for an id that holds nothing. */
  dropHeld: (id: string) => Promise<void>
  /** Every id with a part held, for the sweep of uploads abandoned half-way. */
  heldIds: () => Promise<string[]>
}

/**
 * The three verbs the off-site copy needs from a bucket (ADR 0035). `write` takes a kept archive
 * as `KeptBody` (a `Blob` is one), and must not read it whole when it is large: on Cloudflare that
 * is the 128 MB the isolate has.
 */
export type OffsiteClient = {
  write(key: string, data: KeptBody | string): Promise<number>
  list(opts?: { prefix?: string }): Promise<{ contents?: { key: string }[] } | null>
  delete(key: string): Promise<void>
}

export type OffsiteConfig = {
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  region: string
  endpoint?: string
}

/** `offsite.ts`: a client for an S3-compatible bucket. Bun: its own `S3Client`. */
export type OffsitePort = {
  s3Client: (config: OffsiteConfig) => OffsiteClient
}

/**
 * `satori.ts`: HTML and CSS to SVG, for the social card. Bun loads satori as it ships; Cloudflare loads
 * its standalone build and hands it `yoga.wasm` imported statically, because the default build carries
 * the layout engine as WASM bytes, which a Worker may not compile at run time.
 */
export type SatoriPort = {
  loadSatori: () => Promise<typeof import('satori').default>
}

/**
 * `capabilities.ts`: every way the two runtimes DIFFER, by name (ADR 0066, rule 2). A difference that
 * is not here is a bug; one that is here has a row in `docs/runtimes.md`, which
 * `check:install-matrix` holds to this list key for key.
 */
export type Capabilities = {
  /** Who compresses responses. */
  compression: 'origin' | 'edge'
  /** What makes the smaller copies of a picture. */
  imageEngine: 'sharp' | 'cloudflare-images'
  /** What draws the social card's PNG. */
  cardRenderer: 'sharp' | 'resvg'
  /** What hashes passwords (same PHC strings either way). */
  passwordHash: 'bun-native' | 'noble'
  /** What is kept before a migration changes the database. */
  preMigrationCopy: 'file' | 'bookmark'
  /** What winds the clock that publishes scheduled posts. */
  clock: 'timer' | 'alarm'
  /** Where uploads and backups live. */
  store: 'disk' | 'r2'
  /**
   * Who says where a request came from. `peer`: the socket, and `CF-Connecting-IP` only once the
   * owner has said Cloudflare is in front (`cloudflareInFront`). `edge`: the platform stamps
   * `CF-Connecting-IP` and `CF-IPCountry` on every request and no request reaches the code another
   * way — a Worker has no socket to ask, so without this every reader shared one rate-limit bucket.
   */
  clientAddress: 'peer' | 'edge'
  /**
   * What an upload and an import may weigh by default. `machine`: 64 MB and 100 MB, matching the
   * recommended proxy. `isolate`: 25 MB and 30 MB, because the request body is held whole, plus a
   * copy, in a 128 MB isolate.
   */
  bodyLimits: 'machine' | 'isolate'
}
