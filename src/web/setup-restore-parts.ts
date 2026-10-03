// First run, the other door, for a backup too large for one request (G4): the archive in parts.
//
//   POST   /setup/restore/parts                 begin: { size } → { id, partBytes, maxPartBytes }
//   GET    /setup/restore/parts/:id             what is held, to resume
//   PUT    /setup/restore/parts/:id/:part       one part, its bytes as the body (1-based)
//   POST   /setup/restore/parts/:id/load        load it: { identity?, passphrase? }
//   DELETE /setup/restore/parts/:id             give up, and free the store
//
// JSON in and out, for the setup page's script (`assets/js/restore-form.ts`) and for a program —
// the "Move to Cloudflare" step pushes a Bun blog's archive into a fresh Cloudflare blog with its
// SETUP_CODE through exactly these. `docs/backups.md` has the API; `server/restore-parts.ts` the
// rules and why there is no state but the parts.
//
// GUARDED EXACTLY LIKE `/setup/restore`, on every request and not once at the start: dead once the
// blog has an owner, the setup token or SETUP_CODE (here as `Authorization: Bearer …`, because a
// query string is written into access logs), and a wrong one charged to the same budget as the
// claim's. The token is checked before a byte of a part is read.
import type { Context } from 'hono'
import { getSettings } from '@/content/settings'
import { adminT } from '@/i18n/admin-i18n'
import { noUsersYet } from '@/auth/users'
import { clientIp, overLimit, recordHit } from '@/server/rate-limit'
import { forgetSetupToken, setupCodeConfigured, setupTokenMatches } from '@/server/setup-token'
import { ArchiveFault } from '@/server/archive-open'
import { LoadRefusal, backupLoading, loadBackupIntoEmptyBlog, logLoaded } from '@/server/load-backup'
import {
  MAX_PART_BYTES, PART_BYTES, PartRefusal, assembled, beginParts, dropParts, parsePartsId, partsStatus, putPart,
} from '@/server/restore-parts'
import { firstNonEmptyTable } from '@/store/archive-load'
import { TRIES, TRIES_WINDOW, tries } from '@/web/setup-routes'
import { verdict } from '@/web/setup-restore'

type Strings = ReturnType<typeof adminT>

/** The archive faults a program can do something about (supply a key, or the right one), by name. */
const KEY_FAULTS = new Set(['needs-key', 'no-matching-key', 'bad-identity', 'bad-kdf'])

/** The API's answers: the admin's `{ success, data }` envelope, and a `code` a program can branch on. */
const ok = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify({ success: true, data }), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
const no = (status: number, code: string, error: string): Response =>
  new Response(JSON.stringify({ success: false, code, error }), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

/**
 * The three questions every one of these routes asks first, in this order: is there still no owner,
 * is this address within its budget, and is the token right. Null when all three pass.
 */
async function gate(c: Context): Promise<{ refused: Response } | { s: Strings }> {
  const s = adminT((await getSettings()).language)
  if (!noUsersYet()) return { refused: no(409, 'claimed', s.setupClaimedTitle) }
  if (overLimit(tries(c), TRIES, TRIES_WINDOW)) return { refused: no(429, 'too-many', s.setupTooMany) }
  const token = /^Bearer\s+(.+)$/i.exec(c.req.header('authorization') ?? '')?.[1]?.trim() ?? ''
  if (!setupTokenMatches(token)) {
    recordHit(tries(c), TRIES_WINDOW)
    return { refused: no(403, 'bad-token', setupCodeConfigured() ? s.setupBadCode : s.setupBadLink) }
  }
  return { s }
}

/**
 * A part's body read to its end before a refusal goes out, as `handleRestore` does and for the same
 * reason: bytes left on a keep-alive connection are read as the next request.
 */
async function drained(c: Context, answer: Response): Promise<Response> {
  const body = c.req.raw.body
  try {
    if (body && !body.locked) for await (const _ of body) { /* not wanted */ }
  } catch { /* the client's to close */ }
  return answer
}

const partsOf = (c: Context) => parsePartsId(c.req.param('id') ?? '')

function refusedPart(error: unknown): Response | null {
  if (!(error instanceof PartRefusal)) return null
  if (error.code === 'unknown') return no(404, 'unknown', 'No upload by that id, or it was begun more than a day ago')
  if (error.code === 'incomplete') return no(409, 'incomplete', error.detail)
  if (error.code === 'part-number') return no(400, 'part-number', `Parts are numbered 1 and up, not ${error.detail}`)
  return no(413, error.code, error.code === 'part-size'
    ? `A part is 1 to ${MAX_PART_BYTES} bytes and no more than the upload, not ${error.detail}`
    : `The parts would come to ${error.detail} bytes, more than the upload said it was`)
}

/** `POST /setup/restore/parts`. */
export async function handlePartsBegin(c: Context): Promise<Response> {
  const g = await gate(c)
  if ('refused' in g) return g.refused
  const { size } = (await c.req.json().catch(() => ({}))) as { size?: unknown }
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 1) return no(400, 'size', 'size: the archive\'s length in bytes')
  // Asked now rather than after the upload: a blog that cannot take the backup should say so before
  // somebody spends an hour sending it gigabytes.
  if (backupLoading()) return no(409, 'busy', g.s.setupRestoreBusy)
  const occupied = firstNonEmptyTable()
  if (occupied) return no(409, 'not-empty', g.s.setupRestoreNotEmpty)
  const p = await beginParts(size)
  console.log(`[INFO] setup.restore.parts: begun ${p.id}, ${size} bytes, from ${clientIp(c)}`)
  return ok({ id: p.id, size, partBytes: PART_BYTES, maxPartBytes: MAX_PART_BYTES, parts: Math.ceil(size / PART_BYTES) }, 201)
}

/** `GET /setup/restore/parts/:id`. */
export async function handlePartsStatus(c: Context): Promise<Response> {
  const g = await gate(c)
  if ('refused' in g) return g.refused
  const p = partsOf(c)
  if (!p) return no(404, 'unknown', 'No upload by that id')
  return ok(await partsStatus(p))
}

/** `PUT /setup/restore/parts/:id/:part`. Streamed into the store; `Content-Length` is required. */
export async function handlePartPut(c: Context): Promise<Response> {
  const g = await gate(c)
  if ('refused' in g) return drained(c, g.refused)
  const p = partsOf(c)
  if (!p) return drained(c, no(404, 'unknown', 'No upload by that id'))
  const length = Number(c.req.header('content-length') ?? NaN)
  const body = c.req.raw.body
  if (!Number.isSafeInteger(length) || !body) return drained(c, no(411, 'length', 'A part needs its Content-Length'))
  try {
    return ok(await putPart(p, Number(c.req.param('part')), length, body))
  } catch (error) {
    const refused = refusedPart(error)
    if (refused) return drained(c, refused)
    console.error(`[ERROR] setup.restore.parts: part ${c.req.param('part')} of ${p.id}: ${(error as Error).message}`)
    return drained(c, no(400, 'part', 'The part did not arrive whole; send it again'))
  }
}

/** `POST /setup/restore/parts/:id/load`. */
export async function handlePartsLoad(c: Context): Promise<Response> {
  const g = await gate(c)
  if ('refused' in g) return g.refused
  const p = partsOf(c)
  if (!p) return no(404, 'unknown', 'No upload by that id')
  const keys = (await c.req.json().catch(() => ({}))) as { identity?: unknown; passphrase?: unknown }
  const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined)
  try {
    const report = await loadBackupIntoEmptyBlog(await assembled(p), { identity: text(keys.identity), passphrase: text(keys.passphrase) })
    forgetSetupToken()
    logLoaded(report.version)
    await dropParts(p).catch(() => undefined)
    console.log(`[INFO] setup.restore: ${report.tables.length} tables, ${report.uploads} uploads, ${p.size} bytes in parts, from ${clientIp(c)}`)
    return ok({ loaded: true, location: '/login', version: report.version, tables: report.tables.length, uploads: report.uploads })
  } catch (error) {
    // The parts stay: a wrong passphrase or key is put right and loaded again without sending the
    // archive a second time. The sweep takes them a day after the upload began.
    const refused = refusedPart(error)
    if (refused) return refused
    const { status, message } = verdict(error, g.s)
    const fault = error instanceof ArchiveFault && KEY_FAULTS.has(error.message) ? error.message : null
    const code = error instanceof LoadRefusal ? error.code : fault ?? (status === 500 ? 'failed' : 'bad-archive')
    console.error(`[ERROR] setup.restore.parts: ${p.id}: ${(error as Error).message}`)
    return no(status, code, message)
  }
}

/** `DELETE /setup/restore/parts/:id`. */
export async function handlePartsDrop(c: Context): Promise<Response> {
  const g = await gate(c)
  if ('refused' in g) return g.refused
  const p = partsOf(c)
  if (!p) return no(404, 'unknown', 'No upload by that id')
  await dropParts(p)
  return ok({ dropped: p.id })
}
