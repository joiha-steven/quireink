// First run, the other door: a backup loaded into a blog nobody has claimed (ADR 0067 rule 4).
//
//   GET  /setup/restore   the form
//   POST /setup/restore   the archive, streamed into `server/load-backup.ts`
//
// Exactly as guarded as the claim beside it (`setup-routes.ts`), because it ends the same way —
// with an owner: it refuses once an account exists, it needs the setup token or `SETUP_CODE`,
// and a wrong one is charged to the same budget. The token is the first field of the form and is
// checked before a byte of the archive is read; the archive is never held whole, on its way in or
// anywhere after (`web/multipart.ts`).
//
// NOT under `/api/setup/`, whose bodies are capped at 64 KB before any handler runs: an archive
// is megabytes. The process ceiling still applies (`web/body-cap.ts`), and so does Cloudflare's
// 100 MB per request: past `CHUNK_ABOVE_BYTES` the page's script sends the file in parts instead
// (`setup-restore-parts.ts`), and this form is what runs with the script off.
import type { Context } from 'hono'
import { getSettings } from '@/content/settings'
import { adminT } from '@/i18n/admin-i18n'
import { noUsersYet } from '@/auth/users'
import { clientIp, overLimit, recordHit } from '@/server/rate-limit'
import { setupTokenMatches, forgetSetupToken, setupCodeConfigured } from '@/server/setup-token'
import { ArchiveFault } from '@/server/archive-open'
import { LoadRefusal, loadBackupIntoEmptyBlog, logLoaded } from '@/server/load-backup'
import { errorBox, fillTemplate, loginShell } from '@/web/login-page'
import { claimedScreen } from '@/web/setup-claim-page'
import { boundaryOf, fieldText, multipart, type Part } from '@/web/multipart'
import { TRIES, TRIES_WINDOW, tries } from '@/web/setup-routes'
import { escapeAttr, escapeHtml } from '@/utils'
import { scriptTag } from '@/web/assets'
import { CHUNK_ABOVE_BYTES, PART_BYTES } from '@/server/restore-parts'
import type { SiteSettings } from '@/types'
import { APP_VERSION } from '@/version'

/** The fields the form sends before its file — token, identity, passphrase — with room to spare. */
const MAX_FIELDS = 8

const html = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })

/**
 * A refusal, and the connection closed after it: the client is told not to send the next
 * request down a connection this one may have left untidy. `handleRestore` drains the body as
 * well, which is what actually keeps the next request parseable (see there).
 */
const refusal = (body: string, status: number): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', connection: 'close' } })

/**
 * The form. The token rides in a hidden field when it came in the link, as on the claim screen;
 * without one the field is shown — labelled as the setup code when the operator chose one, and
 * otherwise as the token at the end of the link in the log. The archive is LAST, because the
 * server reads the parts in order and must have the token before the file starts.
 */
export function restoreScreen(settings: SiteSettings, opts: { token?: string; error?: string } = {}): string {
  const s = adminT(settings.language)
  const askCode = setupCodeConfigured()
  const tokenField = opts.token
    ? `<input type="hidden" name="token" value="${escapeAttr(opts.token)}">`
    : `<label for="token">${escapeHtml(askCode ? s.setupCodeLabel : s.setupRestoreTokenLabel)}</label>
<input id="token" name="token" type="text" required autocomplete="off" autocapitalize="none" spellcheck="false">
${askCode ? '' : `<p class="login-hint">${escapeHtml(s.setupRestoreTokenHint)}</p>`}`
  return loginShell(settings, s.setupRestoreTitle, `
<h1>${escapeHtml(s.setupRestoreTitle)}</h1>
<p class="login-lede">${escapeHtml(s.setupRestoreLede)}</p>
${errorBox(opts.error)}
<form method="post" action="/setup/restore" enctype="multipart/form-data" class="login-form" data-setup-restore
 data-chunk-above="${CHUNK_ABOVE_BYTES}" data-part-bytes="${PART_BYTES}" data-sending="${escapeAttr(s.setupRestoreSending)}"
 data-loading="${escapeAttr(s.setupRestoreLoading)}" data-retrying="${escapeAttr(s.setupRestoreRetrying)}" data-stopped="${escapeAttr(s.setupRestoreStopped)}">
${tokenField}
<label for="identity">${escapeHtml(s.setupRestoreIdentity)}</label>
<input id="identity" name="identity" type="password" autocomplete="off" spellcheck="false">
<label for="passphrase">${escapeHtml(s.setupRestorePassphrase)}</label>
<input id="passphrase" name="passphrase" type="password" autocomplete="off">
<p class="login-hint">${escapeHtml(s.setupRestoreSealed)}</p>
<label for="archive">${escapeHtml(s.setupRestoreFile)}</label>
<input id="archive" name="archive" type="file" required accept=".gz,.enc,application/gzip,application/octet-stream">
<p class="login-hint">${escapeHtml(fillTemplate(s.setupRestoreFileHint, { version: APP_VERSION }))}</p>
<button type="submit" class="login-submit">${escapeHtml(s.setupRestoreGo)}</button>
<p class="login-hint" data-restore-status aria-live="polite" hidden></p>
</form>`, scriptTag('login') + scriptTag('setup-restore'))
}

/** `GET /setup/restore`. */
export async function handleRestorePage(c: Context): Promise<Response> {
  const settings = await getSettings()
  if (!noUsersYet()) return html(claimedScreen(settings), 404)
  return html(restoreScreen(settings, { token: c.req.query('token') || undefined }))
}

/** What went wrong, in the reader's language, and the status that goes with it. */
export function verdict(error: unknown, s: ReturnType<typeof adminT>): { status: number; message: string } {
  if (error instanceof LoadRefusal) {
    if (error.code === 'version') return { status: 422, message: fillTemplate(s.setupRestoreVersion, { theirs: error.detail, ours: APP_VERSION }) }
    if (error.code === 'old-format') return { status: 422, message: s.setupRestoreOldFormat }
    if (error.code === 'busy') return { status: 409, message: s.setupRestoreBusy }
    return { status: 409, message: s.setupRestoreNotEmpty }
  }
  const why = (error as Error).message ?? String(error)
  if (error instanceof ArchiveFault) {
    if (why === 'needs-key') return { status: 422, message: s.setupRestoreNeedsKey }
    if (['no-matching-key', 'bad-identity', 'bad-kdf'].includes(why)) return { status: 422, message: s.setupRestoreWrongKey }
    return { status: 422, message: s.setupRestoreBad }
  }
  // A gzip that will not inflate, or a tar that ends early: the file, not the server.
  const code = (error as { code?: unknown }).code
  if ((typeof code === 'string' && code.startsWith('Z_')) || /^tar: |^truncated$/.test(why)) {
    return { status: 422, message: s.setupRestoreBad }
  }
  return { status: 500, message: fillTemplate(s.setupRestoreFailed, { why }) }
}

/**
 * `POST /setup/restore`.
 *
 * Every answer waits until the request body has been read to its end, refusals included. A
 * refusal sent with most of an upload still unread leaves those bytes on the connection, and the
 * HTTP parser reads the next request out of them: seen in the tour, where the right setup code,
 * sent second on the same keep-alive connection, came back a bare 400 that no handler had written.
 * `Connection: close` alone did not stop it.
 */
export async function handleRestore(c: Context): Promise<Response> {
  const body = c.req.raw.body
  const boundary = boundaryOf(c.req.header('content-type') ?? '')
  const parts = body && boundary ? multipart(body, boundary) : null
  const answer = await decide(c, parts)
  try {
    if (parts) {
      for (let next = await parts.next(); !next.done; next = await parts.next()) { /* the rest is not wanted */ }
    } else if (body && !body.locked) {
      for await (const _ of body) { /* the rest is not wanted */ }
    }
  } catch { /* a body that will not even drain is the client's to close */ }
  return answer
}

async function decide(c: Context, parts: AsyncGenerator<Part> | null): Promise<Response> {
  const settings = await getSettings()
  const s = adminT(settings.language)
  if (!noUsersYet()) return refusal(claimedScreen(settings), 409)
  if (!parts) return refusal(restoreScreen(settings, { error: s.setupRestoreBad }), 400)
  if (overLimit(tries(c), TRIES, TRIES_WINDOW)) return refusal(restoreScreen(settings, { error: s.setupTooMany }), 429)

  const fields: Record<string, string> = {}
  let archive: Part | null = null
  try {
    // By hand rather than `for await`: leaving that loop at the file would close the reader the
    // file is about to be read from.
    // Counted as well as each one capped, because all of this happens before the token is
    // checked: the form has four fields, and a stranger posting ten thousand small ones is not
    // filling it in.
    let count = 0
    for (let next = await parts.next(); !next.done; next = await parts.next()) {
      if (next.value.filename !== null) { archive = next.value; break }
      if (++count > MAX_FIELDS) throw new Error('multipart: more fields than the form has')
      fields[next.value.name] = (await fieldText(next.value)).trim()
    }
  } catch {
    return refusal(restoreScreen(settings, { error: s.setupRestoreBad }), 400)
  }
  const token = fields.token ?? ''
  if (!setupTokenMatches(token)) {
    recordHit(tries(c), TRIES_WINDOW)
    return refusal(restoreScreen(settings, { error: setupCodeConfigured() ? s.setupBadCode : s.setupBadLink }), 403)
  }
  if (!archive) return refusal(restoreScreen(settings, { token, error: s.setupRestoreBad }), 400)

  try {
    const report = await loadBackupIntoEmptyBlog(archive.body(), {
      identity: fields.identity || undefined, passphrase: fields.passphrase || undefined,
    })
    forgetSetupToken()
    logLoaded(report.version)
    console.log(`[INFO] setup.restore: ${report.tables.length} tables, ${report.uploads} uploads, from ${clientIp(c)}`)
    // Into the sign-in, as the archive's owner: their password and authenticator came with it.
    return c.redirect('/login', 303)
  } catch (error) {
    if (error instanceof LoadRefusal && error.code === 'claimed') return refusal(claimedScreen(settings), 409)
    const { status, message } = verdict(error, s)
    console.error(`[ERROR] setup.restore: ${(error as Error).message}`)
    return refusal(restoreScreen(settings, { token, error: message }), status)
  }
}
