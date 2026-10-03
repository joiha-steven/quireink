// "Move to Cloudflare" (G5.3): a blog running on Bun — source, Docker, a NAS — copied into a new
// Worker in the owner's own Cloudflare account, by the same doors a person would use by hand:
//
//   1. check     the token works and the account is on Workers Paid (ADR 0066);
//   2. package   this version's Cloudflare package from its GitHub Release, checked (`package.ts`);
//   3. install   the Worker, its Durable Object, its bucket, on workers.dev (`install.ts`);
//   4. archive   a backup of this blog, unsealed — it goes over TLS to the owner's own Worker;
//   5. upload    into the empty Worker through `/setup/restore`, with a SETUP_CODE minted here;
//   6. verify    the Worker answers as this version, and the newest post opens there.
//
// This blog keeps running throughout and afterwards: nothing here changes it. Pointing the domain
// at the Worker is the owner's next step (`attachDomain`, when the token may, or by hand).
//
// One move at a time per process, its state in memory. The token is held only while the move
// runs and for half an hour after, for the domain step, then forgotten; it is never written down
// here, and reaches the Worker as a secret only when the owner asked for self-updates.
import { installOnCloudflare } from './install'
import { CloudflareApi, CloudflareError } from './api'
import { fetchPackage } from './package'
import { APP_VERSION } from '@/version'

export const MOVE_STEPS = ['check', 'package', 'install', 'archive', 'upload', 'verify'] as const
export type MoveStep = (typeof MOVE_STEPS)[number]
export type StepState = 'wait' | 'run' | 'done' | 'fail'

export type MoveStatus = {
  running: boolean
  steps: Record<MoveStep, StepState>
  /** What the running or failed step is doing, in a few words (an installer step, a size). */
  detail: string
  /** The Worker's address once installed. */
  url: string
  scriptName: string
  /** The blog's own address, which the domain step points at the Worker. */
  siteUrl: string
  error: string
  startedAt: number
  finishedAt: number
}

export type MoveOptions = {
  accountId: string
  token: string
  /** The address the blog is read at; becomes the Worker's SITE_URL. */
  siteUrl: string
  /** Store the token in the Worker so it can update itself (G5.4). */
  selfUpdate: boolean
  /** The owner said the account is on Workers Paid, for a token without Billing · Read. */
  confirmedPaid: boolean
  /** The archive of this blog, unsealed, built when the step comes (so it is fresh). */
  archive: () => Promise<Blob>
  /** The newest published post's path, e.g. `/hello`, or null when there is none. */
  newestPath: () => Promise<string | null>
  /** For tests. */
  apiBase?: string
  fetchImpl?: typeof fetch
}

/**
 * The Worker's name from the blog's address: `quireink-` and the host, as Cloudflare allows names
 * (lowercase letters, digits, hyphens, at most 63) — `stevensdesk.com` → `quireink-stevensdesk-com`.
 * The bucket takes the same name, which R2's rules also allow.
 */
export function scriptNameFor(siteUrl: string): string {
  let host = 'blog'
  try { host = new URL(siteUrl).hostname || host } catch { /* no address yet: the generic name */ }
  const slug = host.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'blog'
  return `quireink-${slug}`.slice(0, 63).replace(/-+$/, '')
}

const blank = (): MoveStatus => ({
  running: false,
  steps: Object.fromEntries(MOVE_STEPS.map((s) => [s, 'wait'])) as Record<MoveStep, StepState>,
  detail: '', url: '', scriptName: '', siteUrl: '', error: '', startedAt: 0, finishedAt: 0,
})

let status: MoveStatus | null = null
let held: { accountId: string; token: string; until: number; apiBase?: string } | null = null
const HOLD_MS = 30 * 60_000

/** The last move's state, or null when none has run since this process started. */
export const moveStatus = (): MoveStatus | null => (status ? structuredClone(status) : null)

/** For tests. */
export function resetMove(): void {
  status = null
  held = null
}

/** A random SETUP_CODE: 24 characters of base64url, well past the twelve the setup screen asks for. */
function setupCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * A Worker by this name already in the account: carry on only if it holds no blog yet (an empty one
 * a failed move left behind), and find that out BEFORE anything is uploaded. The installer would
 * otherwise replace its code first — this blog's version over a blog that may have been updated past
 * it, on a database that version already migrated — and only the archive upload would be refused.
 * A Worker that cannot be asked (its workers.dev address switched off) is treated as occupied.
 */
async function refuseOccupied(o: MoveOptions, scriptName: string, using: typeof fetch): Promise<void> {
  const api = new CloudflareApi(o.token, o.accountId, o.apiBase)
  const exists = await api.call('script', `/accounts/:account/workers/scripts/${scriptName}/settings`).then(() => true, () => false)
  if (!exists) return
  const { subdomain } = await api.call<{ subdomain: string }>('script', '/accounts/:account/workers/subdomain')
  const setup = await using(`https://${scriptName}.${subdomain}.workers.dev/setup`, { redirect: 'manual' }).then((r) => r.status, () => 0)
  if (setup !== 200) {
    throw new CloudflareError('script', 409, `a Worker named ${scriptName} already holds a blog (or cannot be asked), so nothing was changed; delete it in the Cloudflare dashboard to move again`)
  }
}

/** The installer's own first two steps, asked before anything is fetched or created. */
async function checkAccount(o: MoveOptions): Promise<void> {
  const api = new CloudflareApi(o.token, o.accountId, o.apiBase)
  await api.call('token', '/accounts/:account/tokens/verify').catch(async (error: unknown) => {
    if (error instanceof CloudflareError) await api.call('token', '/user/tokens/verify')
    else throw error
  })
  let paid: boolean | null = null
  try {
    const subs = await api.call<{ rate_plan?: { id?: string } }[]>('plan', '/accounts/:account/subscriptions')
    paid = subs.some((x) => /workers_paid|workers_ent|partners_workers/i.test(x.rate_plan?.id ?? ''))
  } catch { /* no Billing · Read */ }
  if (paid === false) throw new CloudflareError('plan', 402, 'this account is on the Workers Free plan; Quire Ink needs Workers Paid ($5/month)')
  if (paid === null && !o.confirmedPaid) throw new CloudflareError('plan', 0, 'the token cannot read the plan; confirm the account is on Workers Paid')
}

/**
 * Start a move and return at once; `moveStatus()` follows it. Refuses while one is running.
 * Every failure lands in `status.error` with the step it happened at; nothing is thrown out.
 */
export function startMove(o: MoveOptions): MoveStatus {
  if (status?.running) throw new Error('a move is already running')
  status = { ...blank(), running: true, startedAt: Date.now(), scriptName: scriptNameFor(o.siteUrl), siteUrl: o.siteUrl }
  held = { accountId: o.accountId, token: o.token, until: Number.POSITIVE_INFINITY, apiBase: o.apiBase }
  void run(o, status).finally(() => {
    if (status) { status.running = false; status.finishedAt = Date.now() }
    if (held) held.until = Date.now() + HOLD_MS
  })
  return structuredClone(status)
}

async function run(o: MoveOptions, s: MoveStatus): Promise<void> {
  const using = o.fetchImpl ?? fetch
  let current: MoveStep = 'check'
  const step = (name: MoveStep, detail = ''): void => {
    if (current !== name && s.steps[current] === 'run') s.steps[current] = 'done'
    current = name
    s.steps[name] = 'run'
    s.detail = detail
  }
  try {
    // The token and the plan FIRST, as the card lists them: a wrong token stops the move here,
    // before twenty megabytes of package are fetched for nothing. The installer asks both again.
    step('check')
    await checkAccount(o)
    await refuseOccupied(o, s.scriptName, using)
    step('package', APP_VERSION)
    const pkg = await fetchPackage(APP_VERSION, using)
    s.steps.package = 'done'

    const code = setupCode()
    const secrets: Record<string, string> = { SETUP_CODE: code }
    if (o.selfUpdate) {
      secrets.CLOUDFLARE_API_TOKEN = o.token
      secrets.CLOUDFLARE_ACCOUNT_ID = o.accountId
    }
    const installed = await installOnCloudflare({
      token: o.token, accountId: o.accountId, scriptName: s.scriptName, bucket: s.scriptName,
      manifest: pkg.manifest, files: pkg.files, confirmedPaid: o.confirmedPaid, apiBase: o.apiBase,
      vars: { SITE_URL: o.siteUrl, QUIREINK_SCRIPT: s.scriptName, QUIREINK_BUCKET: s.scriptName },
      secrets,
      // Every installer step is part of ours; its own token, plan and per-file package checks
      // included, since the account was checked above.
      onStep: (name, detail) => step('install', detail ?? name),
    })
    s.url = installed.url
    if (!installed.firstInstall) {
      // A Worker by that name already existed. If it holds a blog, the upload below is refused
      // (409) and nothing of it is changed; if it is an empty one left by a failed move, carry on.
      s.detail = 'an existing Worker of that name'
    }

    step('archive')
    const archive = await o.archive()
    s.detail = `${Math.round(archive.size / 1024 / 1024 * 10) / 10} MB`

    step('upload', s.detail)
    await waitForSetup(installed.url, using)
    await upload(installed.url, code, archive, using)

    step('verify')
    const health = await (await using(`${installed.url}/api/health`)).json() as { version?: string; package?: string }
    if (health.version !== APP_VERSION || health.package !== 'cloudflare') {
      throw new Error(`the Worker answers as ${health.package} ${health.version}, not cloudflare ${APP_VERSION}`)
    }
    const newest = await o.newestPath()
    if (newest) {
      const page = await using(`${installed.url}${newest}`, { redirect: 'manual' })
      if (page.status !== 200) throw new Error(`the newest post (${newest}) answers ${page.status} on the Worker`)
    }
    s.steps.verify = 'done'
    s.detail = ''
  } catch (error) {
    s.steps[current] = 'fail'
    s.error = error instanceof CloudflareError ? error.message : (error as Error).message
  }
}

/**
 * A workers.dev name made a moment ago answers from some edges and 404s from others for a while
 * (measured 2026-10-03: the health check passed, the next request 404'd with Cloudflare's own page,
 * and the name settled within half a minute). Wait for the setup screen to answer.
 */
async function waitForSetup(url: string, using: typeof fetch): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const res = await using(`${url}/setup`, { redirect: 'manual' }).catch(() => null)
    if (res && (res.status === 200 || res.status === 404) && res.headers.get('content-type')?.includes('text/html')) {
      // 200 is an unclaimed blog's setup screen; a Quire Ink 404 here means it is claimed, which
      // the upload reports properly. Cloudflare's own not-found page is also HTML, so ask health.
      const health = await using(`${url}/api/health`).then((r) => r.ok, () => false)
      if (health) return
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`${url} did not settle on workers.dev within a minute`)
}

/** Through the first setup screen, as its form posts it (`web/setup-restore.ts`). */
async function upload(url: string, code: string, archive: Blob, using: typeof fetch): Promise<void> {
  const form = new FormData()
  form.set('token', code)
  form.set('identity', '')
  form.set('passphrase', '')
  form.set('archive', new File([archive], 'quire-backup.tar.gz', { type: 'application/gzip' }))
  const res = await using(`${url}/setup/restore`, { method: 'POST', body: form, redirect: 'manual' })
  if (res.status === 303) return
  const text = (await res.text().catch(() => '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (res.status === 409) throw new Error(`a blog already lives in that Worker, so nothing was changed there (${text.slice(0, 160)})`)
  throw new Error(`the Worker refused the backup: ${res.status} ${text.slice(0, 200)}`)
}

/**
 * Point the blog's own domain at the Worker (a Custom Domain), with the token the move used, while
 * it is still held. Needs the zone in the same account and the token's Zone · Workers Routes and
 * DNS edit permissions; Cloudflare refuses while the hostname still has its own DNS record, and the
 * error says so — the owner deletes that record and presses again, or does it in the dashboard.
 */
export async function attachDomain(hostname: string): Promise<void> {
  if (!held || Date.now() > held.until) throw new Error('the token is no longer held; run the move again or attach the domain in the Cloudflare dashboard')
  if (!status?.scriptName || status.running || status.error) throw new Error('there is no finished move to attach a domain to')
  const api = new CloudflareApi(held.token, held.accountId, held.apiBase)
  const zone = await zoneOf(api, hostname, held.accountId)
  if (!zone) throw new CloudflareError('domain', 404, `no zone in this Cloudflare account holds ${hostname}`)
  await api.json('domain', '/accounts/:account/workers/domains', 'PUT', {
    environment: 'production', hostname, service: status.scriptName, zone_id: zone,
  })
}

/**
 * The zone a hostname belongs to, asked suffix by suffix — `blog.example.co.uk`, then
 * `example.co.uk`, then `co.uk` — because which part is the zone is not something the name says.
 */
async function zoneOf(api: CloudflareApi, hostname: string, accountId: string): Promise<string | null> {
  const labels = hostname.toLowerCase().split('.')
  for (let i = 0; i < labels.length - 1; i++) {
    const name = labels.slice(i).join('.')
    const zones = await api.call<{ id: string }[]>('domain', `/zones?name=${encodeURIComponent(name)}&account.id=${encodeURIComponent(accountId)}`)
    if (zones[0]) return zones[0].id
  }
  return null
}
