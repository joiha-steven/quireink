// Install or upgrade a Quire Ink blog on Cloudflare from the Cloudflare package of a release
// (ADR 0065 package C, ADR 0066; G5.3). Plain `fetch`, so the same code runs inside a Bun install —
// "Move to Cloudflare" — and inside a Cloudflare one — the one-click upgrade. No machine of this
// project is in the path: the package comes from the GitHub Release, the calls go to Cloudflare.
//
// The steps, each idempotent, so running it again after a failure carries on rather than duplicates:
//   1. the token works;                         5. the static assets are uploaded;
//   2. the account is on Workers Paid;          6. the Worker is uploaded with its bindings;
//   3. the package's every file matches;        7. it is reachable on workers.dev;
//   4. the R2 bucket exists;                    8. /api/health answers with the package's version.
//
// Measured on 2026-10-03 with a probe Worker, steps 4–7 by REST alone took 8.4 s.
import { CloudflareApi, CloudflareError } from './api'

export type Manifest = {
  format: 'quireink-cf/1'
  version: string
  main: string
  compatibilityDate: string
  compatibilityFlags: string[]
  durableObjects: { binding: string; className: string }[]
  bindings: { r2: string; assets: string; images: string }
  files: { path: string; bytes: number; sha256: string }[]
}

export type InstallOptions = {
  token: string
  accountId: string
  /** The Worker's name, which is also its workers.dev subdomain. */
  scriptName: string
  bucket: string
  manifest: Manifest
  /** Every file of the package by its path in the archive (`worker/…`, `public/…`). */
  files: Map<string, Uint8Array>
  /** Plain variables (SITE_URL…). QUIREINK_PACKAGE is always `cloudflare`. */
  vars?: Record<string, string>
  /** Secrets (SETUP_CODE…). An upgrade passes none and keeps the ones already set. */
  secrets?: Record<string, string>
  /**
   * The owner said they are on Workers Paid, for a token without Billing · Read. The installer
   * still refuses a plan it can SEE is Free.
   */
  confirmedPaid?: boolean
  onStep?: (step: string, detail?: string) => void
  /** How long to wait for the new version to answer, in seconds. */
  healthTimeout?: number
  /**
   * An UPDATE of a blog already running (G5.4): keep the plain variables it has — SITE_URL and
   * whatever the owner set in the dashboard — rather than replacing them with `vars`, and leave its
   * workers.dev address as it is (an owner on a Custom Domain may have switched it off).
   */
  update?: boolean
  /** Where to ask `/api/health` once deployed, instead of the workers.dev address. */
  healthUrl?: string
  /** For tests. */
  apiBase?: string
}

export type InstallResult = { url: string; firstInstall: boolean; version: string }

const hex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = async (bytes: Uint8Array): Promise<string> => hex(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))
const b64 = (bytes: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

const TYPES: Record<string, string> = {
  woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', png: 'image/png', ico: 'image/x-icon',
  svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg', css: 'text/css', js: 'text/javascript',
}

export async function installOnCloudflare(o: InstallOptions): Promise<InstallResult> {
  const api = new CloudflareApi(o.token, o.accountId, o.apiBase)
  const say = o.onStep ?? (() => {})

  // 1. The token.
  say('token')
  await api.call('token', '/accounts/:account/tokens/verify').catch(async (error: unknown) => {
    // A user token verifies at a different address; try it before giving up.
    if (error instanceof CloudflareError) await api.call('token', '/user/tokens/verify')
    else throw error
  })

  // 2. The plan (ADR 0066: Workers Paid only).
  say('plan')
  try {
    const subs = await api.call<{ rate_plan?: { id?: string } }[]>('plan', '/accounts/:account/subscriptions')
    const paid = subs.some((s) => /workers_paid|workers_ent|partners_workers/i.test(s.rate_plan?.id ?? ''))
    if (!paid) {
      throw new CloudflareError('plan', 402, 'this account is on the Workers Free plan. Quire Ink needs Workers Paid ($5/month): the Free plan stops a blog at 100,000 requests a day and cannot send mail')
    }
  } catch (error) {
    if (!(error instanceof CloudflareError) || error.status === 402 || !o.confirmedPaid) {
      if (error instanceof CloudflareError && error.status !== 402) {
        throw new CloudflareError('plan', error.status, 'the token cannot read the plan. Give it Account · Billing · Read, or confirm you are on Workers Paid')
      }
      throw error
    }
  }

  // 3. The package, file by file, before anything is changed.
  say('package', `${o.manifest.version}, ${o.manifest.files.length} files`)
  if (o.manifest.format !== 'quireink-cf/1') throw new CloudflareError('package', 0, `unknown package format ${o.manifest.format}`)
  for (const f of o.manifest.files) {
    const bytes = o.files.get(f.path)
    if (!bytes) throw new CloudflareError('package', 0, `${f.path} is missing from the archive`)
    if ((await sha256(bytes)) !== f.sha256) throw new CloudflareError('package', 0, `${f.path} does not match the manifest`)
  }

  // 4. The bucket.
  say('bucket', o.bucket)
  const buckets = await api.call<{ buckets: { name: string }[] }>('bucket', `/accounts/:account/r2/buckets?name_contains=${encodeURIComponent(o.bucket)}`)
  if (!buckets.buckets.some((b) => b.name === o.bucket)) {
    await api.json('bucket', '/accounts/:account/r2/buckets', 'POST', { name: o.bucket })
  }

  // Is this an install or an upgrade? The answer decides whether the Durable Object class is created.
  const existing = await api.call('script', `/accounts/:account/workers/scripts/${o.scriptName}/settings`).then(() => true, () => false)

  // 5. The static assets.
  say('assets')
  const assets = o.manifest.files.filter((f) => f.path.startsWith('public/'))
  const manifest: Record<string, { hash: string; size: number }> = {}
  const byHash = new Map<string, { bytes: Uint8Array; type: string }>()
  for (const f of assets) {
    const bytes = o.files.get(f.path)!
    const ext = f.path.split('.').pop() ?? ''
    const hash = (await sha256(new TextEncoder().encode(b64(bytes) + ext))).slice(0, 32)
    manifest[`/${f.path.slice('public/'.length)}`] = { hash, size: bytes.length }
    byHash.set(hash, { bytes, type: TYPES[ext] ?? 'application/octet-stream' })
  }
  const session = await api.json<{ jwt: string; buckets?: string[][] }>('assets', `/accounts/:account/workers/scripts/${o.scriptName}/assets-upload-session`, 'POST', { manifest })
  let completion = session.jwt
  for (const group of session.buckets ?? []) {
    const form = new FormData()
    for (const hash of group) {
      const file = byHash.get(hash)!
      form.append(hash, new File([b64(file.bytes)], hash, { type: file.type }))
    }
    const done = await api.call<{ jwt?: string }>('assets', '/accounts/:account/workers/assets/upload?base64=true', { method: 'POST', body: form }, session.jwt)
    if (done.jwt) completion = done.jwt
  }

  // 6. The Worker.
  say('worker', existing ? 'upgrade' : 'first install')
  // `QUIREINK_UPDATES: api`: this blog updates the way it was installed, through the API (Settings).
  // The Worker's own name and bucket go in too: the one-key update and the delete in Settings need
  // them to act on the Worker they run in, whoever installed it — the move, or a script of its own.
  const vars = { QUIREINK_UPDATES: 'api', QUIREINK_SCRIPT: o.scriptName, QUIREINK_BUCKET: o.bucket, ...(o.vars ?? {}), QUIREINK_PACKAGE: 'cloudflare' }
  const metadata = {
    main_module: o.manifest.main.replace(/^worker\//, ''),
    compatibility_date: o.manifest.compatibilityDate,
    compatibility_flags: o.manifest.compatibilityFlags,
    bindings: [
      ...o.manifest.durableObjects.map((d) => ({ type: 'durable_object_namespace', name: d.binding, class_name: d.className })),
      { type: 'r2_bucket', name: o.manifest.bindings.r2, bucket_name: o.bucket },
      { type: 'assets', name: o.manifest.bindings.assets },
      { type: 'images', name: o.manifest.bindings.images },
      ...Object.entries(vars).map(([name, text]) => ({ type: 'plain_text', name, text })),
      ...Object.entries(o.secrets ?? {}).map(([name, text]) => ({ type: 'secret_text', name, text })),
    ],
    // An upgrade keeps the secrets the blog already has (its SETUP_CODE, anything added later).
    keep_bindings: o.update ? ['secret_text', 'plain_text'] : ['secret_text'],
    assets: { jwt: completion },
    observability: { enabled: true },
    // The same five minutes of CPU as wrangler.jsonc gives: the hourly backup of a big blog needs it.
    limits: { cpu_ms: 300_000 },
    ...(existing ? {} : { migrations: { new_tag: 'v1', new_sqlite_classes: o.manifest.durableObjects.map((d) => d.className) } }),
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  for (const f of o.manifest.files.filter((x) => x.path.startsWith('worker/'))) {
    const name = f.path.slice('worker/'.length)
    const type = name.endsWith('.wasm') ? 'application/wasm' : 'application/javascript+module'
    form.append(name, new File([new Uint8Array(o.files.get(f.path)!)], name, { type }))
  }
  await api.call('worker', `/accounts/:account/workers/scripts/${o.scriptName}`, { method: 'PUT', body: form })

  // 7. workers.dev.
  say('address')
  if (!o.update) await api.json('address', `/accounts/:account/workers/scripts/${o.scriptName}/subdomain`, 'POST', { enabled: true, previews_enabled: false })
  const { subdomain } = await api.call<{ subdomain: string }>('address', '/accounts/:account/workers/subdomain')
  const url = o.healthUrl?.replace(/\/+$/, '') || `https://${o.scriptName}.${subdomain}.workers.dev`

  // 8. The new version answers.
  say('health', url)
  const deadline = Date.now() + (o.healthTimeout ?? 180) * 1000
  for (;;) {
    try {
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(10_000) })
      const body = (await res.json()) as { status?: string; version?: string }
      if (res.ok && body.status === 'ok' && body.version === o.manifest.version) break
    } catch { /* a new workers.dev name takes a little while to resolve */ }
    if (Date.now() > deadline) throw new CloudflareError('health', 0, `${url} did not answer as ${o.manifest.version} in time`)
    await new Promise((r) => setTimeout(r, 3000))
  }
  return { url, firstInstall: !existing, version: o.manifest.version }
}

/** Delete what `installOnCloudflare` made: the Worker (and its Durable Object) and the bucket. */
export async function uninstallFromCloudflare(o: { token: string; accountId: string; scriptName: string; bucket: string; apiBase?: string }): Promise<void> {
  const api = new CloudflareApi(o.token, o.accountId, o.apiBase)
  await api.call('worker', `/accounts/:account/workers/scripts/${o.scriptName}?force=true`, { method: 'DELETE' })
  // A bucket must be empty to be deleted: list, delete, and list again until nothing comes back.
  for (;;) {
    const page = await api.call<{ key: string }[] | { objects?: { key: string }[] }>('bucket', `/accounts/:account/r2/buckets/${o.bucket}/objects?per_page=1000`)
    const keys = Array.isArray(page) ? page.map((x) => x.key) : (page.objects ?? []).map((x) => x.key)
    if (keys.length === 0) break
    for (const key of keys) await api.call('bucket', `/accounts/:account/r2/buckets/${o.bucket}/objects/${encodeURIComponent(key)}`, { method: 'DELETE' })
  }
  await api.call('bucket', `/accounts/:account/r2/buckets/${o.bucket}`, { method: 'DELETE' })
}
