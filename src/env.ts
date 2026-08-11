// Runtime configuration, read once at boot and validated here rather than at the call
// site. A missing value that only surfaces on the request that needs it is the shape of
// outage the frozen tree's `src/env.ts` existed to prevent, and the reason is unchanged.

export type Env = {
  port: number
  dataDir: string
  /** Canonical origin for absolute URLs (feeds, OG, emails). Empty = derive per request. */
  siteUrl: string
  /**
   * Largest single upload the SOFTWARE will store, in bytes. `0` = no cap.
   *
   * This is the DEPLOYMENT'S CEILING, not the owner's preference: the admin setting can
   * lower it and can never raise it (`content/settings.ts`). That asymmetry is the whole
   * point — an operator hosting a blog for somebody else sets the number the blog cannot
   * argue with, and an operator hosting their own sets it once and forgets it.
   */
  maxUploadBytes: number
  /**
   * Largest the whole blob store may grow, in bytes. `0` = no cap. Same ceiling rule.
   *
   * Checked against a real walk of the store (`media/storage-stats.ts`), so it counts
   * derived variants and icons too — every byte on the disk, not the sum of what was
   * uploaded.
   */
  storeQuotaBytes: number
}

const MB = 1024 * 1024
const GB = 1024 * MB

/**
 * A byte size from a human-facing environment variable.
 *
 * Refuses rather than falls back, like `PORT` above and for the same reason: a typo in a
 * limit that silently becomes the default is a limit nobody can trust, and a quota is
 * exactly the setting somebody will check by reading the unit file.
 */
function readSize(source: NodeJS.ProcessEnv, name: string, unit: number, fallback: number): number {
  const raw = source[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`env: ${name} must be a non-negative number, got ${JSON.stringify(raw)}`)
  }
  return Math.round(value * unit)
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const port = Number(source.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`env: PORT must be a valid port number, got ${JSON.stringify(source.PORT)}`)
  }
  return {
    port,
    // Both database files live here. One directory, so the server and `import-v1` cannot
    // disagree about where they are.
    dataDir: source.DATA_DIR ?? './data',
    siteUrl: (source.SITE_URL ?? '').replace(/\/+$/, ''),
    // 64 MB matches the `client_max_body_size` in the recommended vhost, so the software
    // and the proxy in `docs/self-host.md` refuse the same upload rather than one of them
    // being the only thing that does.
    maxUploadBytes: readSize(source, 'MAX_UPLOAD_MB', MB, 64 * MB),
    storeQuotaBytes: readSize(source, 'STORAGE_QUOTA_GB', GB, 5 * GB),
  }
}
