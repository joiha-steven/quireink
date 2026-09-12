// Runtime configuration, read once at boot and validated here rather than at the call
// site. A missing value that only surfaces on the request that needs it is the shape of
// outage the frozen tree's `src/env.ts` existed to prevent, and the reason is unchanged.

export type Env = {
  port: number
  /**
   * The interface to listen on. Defaults to `127.0.0.1`.
   *
   * It used to be nothing at all: `Bun.serve` with no `hostname` listens on `0.0.0.0`, while
   * the line printed underneath it said `127.0.0.1`. Measured 2026-08-01 on two servers, all
   * four instances were `*:port`, and nothing was exposed only because a firewall rule said
   * so — a defence one rule deep, under a log telling whoever checked the opposite of the
   * truth. Every instance sits behind nginx on the same box (`proxy_pass http://127.0.0.1:…`
   * in all four vhosts, checked), so loopback is the right default for every one of them.
   *
   * A self-hoster whose proxy is on another machine, or who runs this in a container that has
   * to be reachable from outside it, sets `HOST=0.0.0.0` and means it.
   */
  host: string
  dataDir: string
  /**
   * Canonical origin for absolute URLs (feeds, OG, emails).
   *
   * Empty means the admin field is asked next and then `http://localhost:3000` is used — NOT
   * "derive per request", which is what this comment said until 2026-08-11 while nothing
   * derived anything. `content/settings.ts` has the reason it must stay a constant, and it is
   * a cache-poisoning one rather than a taste.
   */
  siteUrl: string
  /**
   * A Content-Security-Policy to send on every response, or '' to send none.
   *
   * EMPTY BY DEFAULT, and that is the safe answer rather than the lazy one. A browser
   * enforces the INTERSECTION of every policy it receives, so a default from here would
   * silently narrow a policy a proxy has already tuned — the recommended nginx and Caddy
   * configs both widen `frame-src` for YouTube, Vimeo and Spotify, and an embed that stops
   * loading reports nothing to the owner. So the app says nothing unless an operator asks.
   *
   * It exists because two shipped install paths put no proxy of ours in front: a Kubernetes
   * cluster terminates TLS at its own ingress, and a NAS has its own reverse proxy with its
   * own header UI. Both were serving the whole site with no policy at all, and the only
   * documented one lived in a vhost neither of them uses. `docs/self-host.md` carries a
   * policy to paste.
   */
  csp: string
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
    host: source.HOST || '127.0.0.1',
    // Both database files live here. One directory, so the server and `import-v1` cannot
    // disagree about where they are.
    dataDir: source.DATA_DIR ?? './data',
    siteUrl: (source.SITE_URL ?? '').replace(/\/+$/, ''),
    // One line, verbatim. Not assembled from parts: a policy is a sentence an operator has
    // to be able to read back and compare against the one in the docs.
    csp: (source.CSP ?? '').trim(),
    // 64 MB matches the `client_max_body_size` in the recommended vhost, so the software
    // and the proxy in `docs/self-host.md` refuse the same upload rather than one of them
    // being the only thing that does.
    maxUploadBytes: readSize(source, 'MAX_UPLOAD_MB', MB, 64 * MB),
    storeQuotaBytes: readSize(source, 'STORAGE_QUOTA_GB', GB, 5 * GB),
  }
}
