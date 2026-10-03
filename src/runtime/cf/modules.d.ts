// Modules that exist only in the Cloudflare build (`scripts/build-worker.ts`).

/** The admin's built bundle, compiled into the Worker so its chunk names are known synchronously. */
declare module 'quire:admin-dist' {
  const files: { name: string; type: string; body: Uint8Array }[]
  export default files
}

/** A WebAssembly module imported statically; workerd compiles it at deploy time. */
declare module '*.wasm' {
  const module: WebAssembly.Module
  export default module
}
