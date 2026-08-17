// SMTP mail (Nodemailer). Config lives on the `integration_keys` row (server-only
// secrets, like the Turnstile/Cloudflare keys) — NEVER in settings.data / the client
// payload. Env vars of the same name are a fallback. No-lock-in: the owner points this
// at their own SMTP server; nothing proprietary. SERVER-ONLY.

// Nodemailer is loaded on the FIRST SEND, not at boot — see `sendMail`. This module is on
// the reader's path (`getMailStatus` decides whether a page draws a subscribe form), so a
// static import here put the whole SMTP stack into every process that has never sent mail.
import { logSend, type SendKind } from '@/news/newsletter-log'
import { clearCache } from '@/server/cache'
import { one, run } from '@/store/query'

export type SmtpConfig = {
  host: string
  port: number
  user: string
  pass: string
  from: string // From: address (e.g. "Blog <hi@example.com>")
  secure: boolean // true = implicit TLS (465); false = STARTTLS (587)
}

// `smtp_secure` is a NULLABLE 0/1 column: NULL means "not chosen", which is what makes
// the port-based fallback below reachable.
type Row = {
  smtp_host: string | null
  smtp_port: number | null
  smtp_user: string | null
  smtp_pass: string | null
  smtp_from: string | null
  smtp_secure: number | null
}

const env = (k: string) => process.env[k] ?? ''

function readRow(): Row | null {
  return one<Row>(
    `select smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_secure
       from integration_keys where id = 1`,
  )
}

// Resolve the SMTP config: stored values win, else same-named env vars.
export async function getSmtpConfig(): Promise<SmtpConfig> {
  let row: Row | null = null
  try {
    row = readRow()
  } catch (error) {
    console.error(`[ERROR] mail.getSmtpConfig: ${(error as Error).message}`)
  }
  const port = row?.smtp_port ?? (Number(env('SMTP_PORT')) || 587)
  return {
    host: row?.smtp_host || env('SMTP_HOST'),
    port,
    user: row?.smtp_user || env('SMTP_USER'),
    pass: row?.smtp_pass || env('SMTP_PASS'),
    from: row?.smtp_from || env('SMTP_FROM'),
    secure: row?.smtp_secure == null ? port === 465 : !!row.smtp_secure,
  }
}

// Configured enough to send: a host and a From address.
export function isMailConfigured(cfg: SmtpConfig): boolean {
  return !!(cfg.host && cfg.from)
}

// Client-safe status (no secrets): whether mail can send + the From address.
export async function getMailStatus(): Promise<{ configured: boolean; from: string }> {
  const cfg = await getSmtpConfig()
  return { configured: isMailConfigured(cfg), from: cfg.from }
}

// Save the SMTP config on integration_keys. `undefined` leaves a field untouched;
// '' clears a string field (back to the env fallback).
//
// Merged here rather than as a partial upsert, for the same reason as
// store/integration-keys.ts: a partial SET clause would have to be assembled from the
// payload, and no SQL is assembled in this codebase.
export async function saveSmtpConfig(input: Partial<SmtpConfig>): Promise<void> {
  const current = readRow()
  const text = (next: string | undefined, stored: string | null | undefined) =>
    next === undefined ? (stored ?? null) : next.trim() || null

  run(
    `insert into integration_keys (id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_secure)
     values (1, $host, $port, $user, $pass, $from, $secure)
     on conflict(id) do update set
       smtp_host   = excluded.smtp_host,
       smtp_port   = excluded.smtp_port,
       smtp_user   = excluded.smtp_user,
       smtp_pass   = excluded.smtp_pass,
       smtp_from   = excluded.smtp_from,
       smtp_secure = excluded.smtp_secure`,
    {
      host: text(input.host, current?.smtp_host),
      user: text(input.user, current?.smtp_user),
      pass: text(input.pass, current?.smtp_pass),
      from: text(input.from, current?.smtp_from),
      port: input.port === undefined ? (current?.smtp_port ?? null) : (input.port || null),
      secure: input.secure === undefined ? (current?.smtp_secure ?? null) : (input.secure ? 1 : 0),
    },
  )
  clearCache()
}

// Send one email. Returns { sent } — degrades gracefully (never throws) when SMTP is
// unconfigured or the send fails, so a caller (subscribe/broadcast) can decide what to
// tell the user without a 500.
//
// EVERY send is written to `newsletter_sends` from here, success or failure — the one
// choke point, so no path can email an address without it showing up in the admin.
// `kind` is therefore required; `postSlugs`/`openToken` apply to broadcasts (a digest
// carries several posts in ONE email, hence a list).
export async function sendMail(msg: {
  to: string
  subject: string
  html: string
  text?: string
  kind: SendKind
  postSlugs?: string[]
  openToken?: string
}): Promise<{ sent: boolean; error?: string }> {
  const cfg = await getSmtpConfig()
  const record = (ok: boolean, error?: string) =>
    logSend({ email: msg.to, kind: msg.kind, ok, postSlugs: msg.postSlugs, error, openToken: msg.openToken })
  if (!isMailConfigured(cfg)) {
    await record(false, 'smtp_not_configured')
    return { sent: false, error: 'smtp_not_configured' }
  }
  try {
    // After the `isMailConfigured` guard on purpose: a blog with no SMTP configured never
    // loads nodemailer at all, and one that has it pays the import once per process.
    const { default: nodemailer } = await import('nodemailer')
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    })
    await transport.sendMail({
      from: cfg.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      // Tag-strip for the plain-text alternative. Deliberately naive, and CodeQL flags it
      // as an incomplete sanitizer (alert #10, dismissed): it is not a sanitizer. The
      // output is the `text/plain` part of an email, never an HTML context, and the input
      // is HTML this codebase generated. If either of those ever stops being true, this
      // needs a real html-to-text pass, not a better regex.
      text: msg.text || msg.html.replace(/<[^>]+>/g, ''),
    })
    await record(true)
    return { sent: true }
  } catch (error) {
    console.error(`[ERROR] mail.sendMail: ${(error as Error).message}`)
    await record(false, (error as Error).message)
    return { sent: false, error: (error as Error).message }
  }
}
