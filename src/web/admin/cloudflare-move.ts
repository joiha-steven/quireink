// "Move to Cloudflare": the routes behind Settings → Server → Run on Cloudflare (G5.3). The move
// itself is `install/cloudflare/move.ts`; this is the gate, the password, and the three questions
// the card asks — will this token do, start, and how far has it got.
//
// ⚠️ THE PASSWORD IS ASKED AGAIN, for two reasons. The move copies the whole blog, accounts
// included, into somewhere else; a stolen session should not be enough to do that. And a password
// hashed with an older, heavier argon2id costs a Worker most of its 128 MB to verify (measured
// 2026-10-03: a 64 MiB hash took the isolate near 102 MB), so the right password, given here, is
// rehashed at today's parameters before the archive is taken — the account arrives light.
//
// Only on a Bun install. A Cloudflare install has nowhere to move to; its card is the update.
import type { Context } from 'hono'
import { needsRehash, verifyPassword } from '@/auth/password'
import { passwordHashFor, rehashPassword } from '@/auth/users'
import { readEnv } from '@/env'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { getPublicPosts } from '@/content/posts'
import { archiveStream, withArchiveRetry } from '@/server/archive'
import { logActivity } from '@/server/activity'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { CloudflareApi, CloudflareError } from '@/install/cloudflare/api'
import { attachDomain, moveStatus, scriptNameFor, startMove, type MoveArchive } from '@/install/cloudflare/move'
import { fail, json } from '@/web/api'
import { storageStats } from '@/media/storage-stats'
import { databaseBytes } from '@/runtime/impl/runtime-info'
import { openKept, removeKept, writeKept } from '@/runtime/impl/archive'
import type { KeptBody } from '@/runtime/ports'
import type { Sendable } from '@/server/restore-push'
import { owner, ownerRouter, QUIET } from '@/web/guard'

type Creds = { accountId: string; token: string }

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

async function creds(c: Context): Promise<Creds & Record<string, unknown>> {
  const input = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  return { ...input, accountId: str(input.accountId), token: str(input.token) }
}

/** The address the blog is read at, or null when it has none a Worker could be given. */
async function publicSiteUrl(): Promise<string | null> {
  const url = resolveSiteUrl(await getSettings())
  try {
    const host = new URL(url).hostname
    return host === 'localhost' || /^127\.|^\[?::1\]?$/.test(host) || !host.includes('.') ? null : url.replace(/\/+$/, '')
  } catch {
    return null
  }
}

/**
 * What the archive will about weigh: the uploads plus the databases. Shown at the check, so the owner
 * knows how long the upload step will take; any size moves, in 16 MB parts (`server/restore-push.ts`).
 */
async function blogBytes(): Promise<number> {
  return (await storageStats()).totalBytes + databaseBytes()
}

/**
 * The archive, written beside the backups and read back a part at a time as it is sent, so a blog of
 * gigabytes never sits in memory. Not a snapshot name, so retention and the off-site copy leave it
 * alone; removed when the move is done with it, and replaced by the next move if one died first.
 */
const MOVE_ARCHIVE = 'cloudflare-move.tar.gz'
async function archiveOnDisk(settings: Awaited<ReturnType<typeof getSettings>>): Promise<MoveArchive> {
  await withArchiveRetry(async () => writeKept(MOVE_ARCHIVE, await archiveStream(settings, { seal: false })))
  const kept = await openKept(MOVE_ARCHIVE)
  // The Move runs on Bun only (`here` above), where a kept archive is a `Bun.file`, which slices.
  if (!kept || !('slice' in kept)) throw new Error('the archive could not be read back from the backup directory')
  return { file: kept as KeptBody & Sendable, drop: () => removeKept(MOVE_ARCHIVE) }
}

export function cloudflareMoveRoutes() {
  const router = ownerRouter()
  const here = (c: Context) => (readEnv().package === 'cloudflare' ? fail(c, 'already_on_cloudflare', 404) : null)

  /**
   * Will this token do? The same two checks the installer starts with, and what the move would be
   * called — so the owner sees the Worker's name and their plan before anything is created.
   */
  router.post('/api/cloudflare/check', async (c) => {
    const no = here(c)
    if (no) return no
    const { accountId, token } = await creds(c)
    if (!accountId || !token) return fail(c, 'account_and_token_required', 400)
    if (rateLimited(`cf-check:${clientIp(c)}`, 20, 5 * 60_000)) return fail(c, 'too_many_attempts', 429)
    const site = await publicSiteUrl()
    const api = new CloudflareApi(token, accountId)
    try {
      await api.call('token', '/accounts/:account/tokens/verify').catch(async (e: unknown) => {
        if (e instanceof CloudflareError) await api.call('token', '/user/tokens/verify')
        else throw e
      })
    } catch (error) {
      return fail(c, `token: ${(error as Error).message}`, 400)
    }
    let plan: 'paid' | 'free' | 'unknown' = 'unknown'
    try {
      const subs = await api.call<{ rate_plan?: { id?: string } }[]>('plan', '/accounts/:account/subscriptions')
      plan = subs.some((s) => /workers_paid|workers_ent|partners_workers/i.test(s.rate_plan?.id ?? '')) ? 'paid' : 'free'
    } catch { /* no Billing · Read: the owner confirms instead */ }
    const scriptName = scriptNameFor(site ?? '')
    const bytes = await blogBytes()
    const exists = await api.call('script', `/accounts/:account/workers/scripts/${scriptName}/settings`).then(() => true, () => false)
    return json({ plan, scriptName, exists, siteUrl: site, bytes })
  }, QUIET)

  /** Start the move. The password first; one move at a time. */
  router.post('/api/cloudflare/move', async (c) => {
    const no = here(c)
    if (no) return no
    const input = await creds(c)
    if (!input.accountId || !input.token) return fail(c, 'account_and_token_required', 400)
    const { user } = owner(c)
    if (rateLimited(`security:${clientIp(c)}`, 10, 5 * 60_000)) return fail(c, 'too_many_attempts', 429)
    const given = str(input.current)
    const stored = passwordHashFor(user.username)
    if (!stored || !(await verifyPassword(stored.hash, given))) return fail(c, 'wrong_password', 403)
    if (needsRehash(stored.hash)) await rehashPassword(user.id, given)
    const site = await publicSiteUrl()
    if (!site) return fail(c, 'site_url_needed', 400)
    if (moveStatus()?.running) return fail(c, 'move_running', 409)
    const settings = await getSettings()
    const started = startMove({
      accountId: input.accountId, token: input.token, siteUrl: site,
      selfUpdate: input.selfUpdate === true, confirmedPaid: input.confirmedPaid === true,
      archive: () => archiveOnDisk(settings),
      newestPath: async () => {
        const newest = (await getPublicPosts())[0]
        return newest ? `/${newest.slug}` : null
      },
    })
    void logActivity('cloudflare.move', started.scriptName)
    return json(started, 202)
  }, QUIET)

  /** How far it has got. */
  router.get('/api/cloudflare/move', async (c) => {
    const no = here(c)
    if (no) return no
    return json(moveStatus())
  })

  /** Point the blog's domain at the Worker, with the token the move held. */
  router.post('/api/cloudflare/domain', async (c) => {
    const no = here(c)
    if (no) return no
    const site = await publicSiteUrl()
    if (!site) return fail(c, 'site_url_needed', 400)
    try {
      await attachDomain(new URL(site).hostname)
      return json({ attached: new URL(site).hostname })
    } catch (error) {
      return fail(c, (error as Error).message, 400)
    }
  }, QUIET)

  return router
}
