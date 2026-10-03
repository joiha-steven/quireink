// What the Worker does to ITSELF (G5.4): update to a newer release, or delete the blog from
// Cloudflare. Here rather than in `src/worker.ts` so both can be driven by tests with a fake
// Cloudflare, a fake bucket and a fake object; the Worker only wires them to its real bindings.
//
// ⚠️ NEITHER ACTS ON ANYTHING BUT THE OBJECT'S ANSWER. Each first asks the Durable Object, through
// its owner gate (session, same-origin — `web/admin/cloudflare-update.ts`), whether this request
// is the owner's; a refusal is returned as it came. They run in the Worker because replacing or
// deleting the code restarts the object, and work running inside it would cut itself off.
import { CloudflareApi, CloudflareError } from './api'
import { newestRelease, updateSelf } from './update'
import { isNewer } from '@/server/update-check'

export type SelfEnv = {
  QUIREINK_SCRIPT?: string
  QUIREINK_BUCKET?: string
  CLOUDFLARE_API_TOKEN?: string
  CLOUDFLARE_ACCOUNT_ID?: string
}

/** The two calls of an R2 binding the delete needs. */
export type Bucket = {
  list(o: { limit: number }): Promise<{ objects: { key: string }[] }>
  delete(keys: string[]): Promise<void>
}

/** A POST to one of the object's own routes, carrying this request's cookie and origin headers. */
export type AskObject = (path: string, body: string) => Promise<Response>

export type SelfOptions = { apiBase?: string; fetchImpl?: typeof fetch }

/** Bodies here are a few short fields; anything past this is not one of ours. */
const MAX_BODY = 16 * 1024

const say = (error: string, status: number): Response => Response.json({ success: false, error }, { status })

/** The body as an object of strings, or null when it is too big or not JSON — never a throw. */
async function fields(request: Request): Promise<Record<string, string> | null> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return null
  const raw = await request.text().catch(() => '')
  if (raw.length > MAX_BODY) return null
  let parsed: unknown
  try { parsed = JSON.parse(raw || '{}') } catch { return null }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string') out[k] = v.trim()
  return out
}

/** The token: the one kept in the Worker, or the one the owner pasted for this request. */
const credsOf = (env: SelfEnv, input: Record<string, string>) => ({
  token: env.CLOUDFLARE_API_TOKEN || input.token || '',
  accountId: env.CLOUDFLARE_ACCOUNT_ID || input.accountId || '',
})

/**
 * Update to a newer release. The new version is asked for its health at the address the owner is
 * using right now — not SITE_URL, which after a move still points at the old server until the
 * domain is switched, and would answer as the old version until the update gave up and went back.
 */
export async function runUpdate(request: Request, env: SelfEnv, ask: AskObject, o: SelfOptions = {}): Promise<Response> {
  const input = await fields(request)
  if (!input) return say('bad_request', 400)
  const asked = await ask('/api/cloudflare/update/authorize', '{}')
  if (!asked.ok) return asked
  const { data } = (await asked.json()) as { data: { current: string; latest: string | null } }
  const wanted = /^\d+\.\d+\.\d+$/.test(input.target ?? '') ? input.target! : null
  // Unknown is not current (`update-check.ts`): with no answer from the daily check, ask GitHub.
  const target = wanted ?? data.latest ?? await newestRelease(o.fetchImpl)
  if (!target || !isNewer(target, data.current)) return say('already_newest', 409)
  const { token, accountId } = credsOf(env, input)
  if (!token || !accountId) return say('token_required', 400)
  if (!env.QUIREINK_SCRIPT || !env.QUIREINK_BUCKET) return say('not_installed_by_api', 409)
  try {
    const result = await updateSelf({
      token, accountId, scriptName: env.QUIREINK_SCRIPT, bucket: env.QUIREINK_BUCKET,
      siteUrl: new URL(request.url).origin, target, apiBase: o.apiBase, fetchImpl: o.fetchImpl,
    })
    return Response.json({ success: !result.error, data: result, ...(result.error ? { error: result.error } : {}) })
  } catch (error) {
    return say((error as Error).message, 502)
  }
}

/**
 * Delete the blog from Cloudflare: its uploads and backups, its bucket, then the Worker and with it
 * the Durable Object and its database.
 *
 * ⚠️ THE TOKEN IS PROVED BEFORE ANYTHING IS DELETED. The uploads go through the binding, which needs
 * no token, and a mistyped one used to be found out only at the API calls after them — a running
 * blog left with its database and none of its pictures, files or archives. Now the token is
 * verified and shown to reach both the Worker and the bucket first; any refusal stops it there.
 */
export async function runUninstall(request: Request, env: SelfEnv, bucket: Bucket, ask: AskObject, o: SelfOptions = {}): Promise<Response> {
  const input = await fields(request)
  if (!input) return say('bad_request', 400)
  // Only what the object checks travels to it: the password and the typed address, not the token.
  const asked = await ask('/api/cloudflare/uninstall/authorize', JSON.stringify({ current: input.current ?? '', confirm: input.confirm ?? '' }))
  if (!asked.ok) return asked
  const { token, accountId } = credsOf(env, input)
  if (!token || !accountId) return say('token_required', 400)
  if (!env.QUIREINK_SCRIPT || !env.QUIREINK_BUCKET) return say('not_installed_by_api', 409)
  const api = new CloudflareApi(token, accountId, o.apiBase)
  try {
    await api.call('token', '/accounts/:account/tokens/verify').catch(async (error: unknown) => {
      if (error instanceof CloudflareError) await api.call('token', '/user/tokens/verify')
      else throw error
    })
    await api.call('worker', `/accounts/:account/workers/scripts/${env.QUIREINK_SCRIPT}/settings`)
    await api.call('bucket', `/accounts/:account/r2/buckets/${env.QUIREINK_BUCKET}`)
  } catch (error) {
    return say(`token_cannot: ${(error as Error).message}`, 403)
  }
  try {
    for (;;) {
      const page = await bucket.list({ limit: 1000 })
      if (page.objects.length === 0) break
      await bucket.delete(page.objects.map((x) => x.key))
    }
    await api.call('bucket', `/accounts/:account/r2/buckets/${env.QUIREINK_BUCKET}`, { method: 'DELETE' })
    await api.call('worker', `/accounts/:account/workers/scripts/${env.QUIREINK_SCRIPT}?force=true`, { method: 'DELETE' })
    return Response.json({ success: true, data: { deleted: env.QUIREINK_SCRIPT } })
  } catch (error) {
    return say((error as Error).message, 502)
  }
}
