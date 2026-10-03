// What the Durable Object was handed: its storage, and the bindings in `wrangler.jsonc`. Set once by
// `src/worker.ts` when the object is constructed, read by every `src/runtime/cf/*` module that needs
// one. One object per blog (ADR 0066), so there is exactly one of these per isolate in practice.
export type CfEnv = {
  BLOG: DurableObjectNamespace
  /** Uploads and backups. */
  BLOBS: R2Bucket
  /** The files that ship with the code (fonts, icons), deployed as Static Assets. */
  ASSETS: Fetcher
  /** Cloudflare Images, for picture variants. */
  IMAGES?: ImagesBinding
  /** Set by the API installer (`install/cloudflare/install.ts`), read by the one-click update. */
  QUIREINK_SCRIPT?: string
  QUIREINK_BUCKET?: string
  QUIREINK_UPDATES?: string
  SITE_URL?: string
  /** Secrets, present when the owner let the blog update itself (G5.3's checkbox). */
  CLOUDFLARE_API_TOKEN?: string
  CLOUDFLARE_ACCOUNT_ID?: string
}

let current: { env: CfEnv; ctx: DurableObjectState } | null = null

export function bind(env: CfEnv, ctx: DurableObjectState): void {
  current = { env, ctx }
}

export function bound(): { env: CfEnv; ctx: DurableObjectState } {
  if (!current) throw new Error('runtime/cf: used before the Durable Object bound its environment')
  return current
}
