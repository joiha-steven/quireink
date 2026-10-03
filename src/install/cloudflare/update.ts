// The one-click update of a Quire Ink on Cloudflare (G5.4), for a blog installed through the API —
// by "Move to Cloudflare" or the installer (`QUIREINK_UPDATES=api`). A blog made with the Deploy
// button updates through its copy on GitHub instead (`.github/workflows/update-quireink.yml`):
// Workers Builds redeploys that copy on every push, so a Worker replaced here would be replaced back
// by the next push, older code over a database the newer one had already migrated.
//
// Runs in the stateless Worker, not in the Durable Object (`src/worker.ts`): replacing the code
// restarts the object, and an update running inside it would cut itself off halfway. A request in
// flight finishes on the version it started on.
//
//   1. note the version deployed now, to go back to;
//   2. fetch the target release's Cloudflare package and check it (`package.ts`);
//   3. upload it as an update — secrets and the owner's variables kept, workers.dev left as it is;
//   4. wait for the blog's own address to answer as the target version;
//   5. if it does not, deploy the noted version again, at 100%.
//
// The database migrates when the new version first starts, after a bookmark (ADR 0063's copy, the
// Cloudflare way). Going back puts the old CODE back; the data stays as the new version left it,
// which migrations keep readable by the version before, and the bookmark holds the rest for 30 days.
import { installOnCloudflare } from './install'
import { CloudflareApi } from './api'
import { fetchPackage } from './package'

export type UpdateOptions = {
  token: string
  accountId: string
  scriptName: string
  bucket: string
  /** The blog's address readers use, where the new version is asked for its health. */
  siteUrl: string
  target: string
  apiBase?: string
  fetchImpl?: typeof fetch
  /** Seconds to wait for the new version before going back. */
  healthTimeout?: number
}

export type UpdateResult = { from: string | null; to: string; rolledBack: boolean; error: string }

type Deployment = { id: string; versions: { version_id: string; percentage: number }[] }

/** The version serving 100% now, or null when the account will not say. */
async function deployedVersion(api: CloudflareApi, scriptName: string): Promise<string | null> {
  try {
    const r = await api.call<{ deployments: Deployment[] }>('versions', `/accounts/:account/workers/scripts/${scriptName}/deployments`)
    return r.deployments[0]?.versions.find((v) => v.percentage === 100)?.version_id ?? r.deployments[0]?.versions[0]?.version_id ?? null
  } catch {
    return null
  }
}

export async function updateSelf(o: UpdateOptions): Promise<UpdateResult> {
  const api = new CloudflareApi(o.token, o.accountId, o.apiBase)
  const before = await deployedVersion(api, o.scriptName)
  const pkg = await fetchPackage(o.target, o.fetchImpl ?? fetch)
  let uploaded = false
  try {
    await installOnCloudflare({
      token: o.token, accountId: o.accountId, scriptName: o.scriptName, bucket: o.bucket,
      manifest: pkg.manifest, files: pkg.files, confirmedPaid: true, apiBase: o.apiBase,
      update: true, healthUrl: o.siteUrl, healthTimeout: o.healthTimeout ?? 120,
      onStep: (step) => { if (step === 'address') uploaded = true },
    })
    return { from: before, to: o.target, rolledBack: false, error: '' }
  } catch (error) {
    const message = (error as Error).message
    // Before the upload nothing changed, so there is nothing to go back from.
    if (!uploaded || !before) return { from: before, to: o.target, rolledBack: false, error: message }
    await api.json('rollback', `/accounts/:account/workers/scripts/${o.scriptName}/deployments`, 'POST', {
      strategy: 'percentage', versions: [{ version_id: before, percentage: 100 }],
    })
    return { from: before, to: o.target, rolledBack: true, error: message }
  }
}

/** The newest release's version, from GitHub, for a blog whose update check is switched off. */
export async function newestRelease(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const res = await fetchImpl('https://api.github.com/repos/joiha-steven/quireink/releases/latest', {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'quireink-update' },
  }).catch(() => null)
  if (!res?.ok) return null
  const tag = ((await res.json()) as { tag_name?: string }).tag_name ?? ''
  const v = tag.replace(/^v/, '')
  return /^\d+\.\d+\.\d+$/.test(v) ? v : null
}
