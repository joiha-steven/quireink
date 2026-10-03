// Modules that exist only in the Cloudflare build (`scripts/build-worker.ts`).

/**
 * The admin's built bundle as facts (`runtime/admin-dist.ts`), so its chunk names are known
 * synchronously; `path` is where the bytes sit in Static Assets.
 */
declare module 'quire:admin-dist' {
  const files: { name: string; type: string; hash: string; imports: string[]; path: string }[]
  export default files
}

/**
 * Where each Shiki language's grammars sit in Static Assets: `files` is every grammar once, by path;
 * `langs` maps a grammar id (`render/shiki-langs.ts`) to the indexes of the files it needs, in order.
 */
declare module 'quire:grammars' {
  const grammars: { files: string[]; langs: Record<string, number[]> }
  export default grammars
}

/** A WebAssembly module imported statically; workerd compiles it at deploy time. */
declare module '*.wasm' {
  const module: WebAssembly.Module
  export default module
}
