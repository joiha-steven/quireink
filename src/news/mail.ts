// SMTP mail. Config lives on the `integration_keys` row (server-only
// secrets, like the Turnstile/Cloudflare keys) — NEVER in settings.data / the client
// payload. Env vars of the same name are a fallback. No-lock-in: the owner points this
// at their own SMTP server; nothing proprietary. SERVER-ONLY.

// The SMTP client is loaded on the FIRST SEND, not at boot — see `makeTransport`. This module
// is on the reader's path (`getMailStatus` decides whether a page draws a subscribe form), so a
// static import here put `node:net` and `node:tls` into every process that has never sent mail.
import { logSend, type SendKind } from '@/news/newsletter-log'
import { htmlToText } from '@/news/mail-text'
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

  closeMailPool()
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

/**
 * ONE CONNECTION FOR A WHOLE BROADCAST, NOT ONE PER RECIPIENT.
 *
 * `createTransport` sat inside the send loop, so a thousand subscribers cost a thousand TCP
 * connections and a thousand TLS handshakes, strictly one after another, inside a request the
 * server closes after two minutes. The admin was then told the broadcast had failed while the
 * mail was still going out, and the button offered to send the whole list again.
 *
 * So one connection is held open for a run and closed with it, and a message sent outside a
 * run gets its own and still closes it. Holding one open forever is the other failure: a
 * transport left standing after a single confirmation email keeps a socket against the owner's
 * relay until the process ends.
 *
 * ONE connection, not three. `nodemailer` was configured with a pool of three, which buys
 * nothing here: `broadcast.ts` awaits each message before starting the next, so two of the
 * three never carried anything.
 */
type Transport = {
  sendMail: (m: { to: string; subject: string; html: string; text: string }) => Promise<void>
  close: () => Promise<void>
}
type Pool = { key: string; transport: Transport }

let pooled: Pool | null = null

const poolKey = (cfg: SmtpConfig) => JSON.stringify([cfg.host, cfg.port, cfg.secure, cfg.user, cfg.pass])

// Loaded on the FIRST SEND, not at boot: a blog with no SMTP configured never loads the socket
// stack at all, and one that has it pays the import once per process.
async function makeTransport(cfg: SmtpConfig): Promise<Transport> {
  const { SmtpSession, SmtpError } = await import('@/news/smtp')
  const { buildMessage, bareAddress } = await import('@/news/mime')
  const options = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  }

  let session = await SmtpSession.open(options)
  const from = bareAddress(cfg.from)

  /**
   * True when the failure was the CONNECTION rather than the message.
   *
   * The difference decides whether retrying is a repair or a second delivery. A relay that
   * said 550 means it; a socket that died between two messages of a long run means nothing,
   * and every relay closes one eventually.
   */
  const droppedUs = (error: unknown): boolean =>
    !(error instanceof SmtpError) || error.code === 0

  return {
    async sendMail(msg) {
      const body = buildMessage({
        from: cfg.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      })
      const envelope = { from, to: bareAddress(msg.to), body }
      try {
        await session.send(envelope)
      } catch (error) {
        if (!droppedUs(error)) throw error
        // Exactly once. A second failure is a failure, and a retry loop against a relay that
        // has stopped answering is how a broadcast turns into an outage.
        session = await SmtpSession.open(options)
        await session.send(envelope)
      }
    },
    close: () => session.close(),
  }
}

/**
 * Open the pool for a run of many messages. `close()` ends it, and must always be called.
 *
 * Returns null when SMTP is not configured, so a caller can treat "no pool" and "nothing to
 * send over" the same way.
 */
export async function openMailPool(): Promise<{ close: () => void } | null> {
  const cfg = await getSmtpConfig()
  if (!isMailConfigured(cfg)) return null
  closeMailPool()
  let transport: Transport
  try {
    transport = await makeTransport(cfg)
  } catch (error) {
    // OPENING THE CONNECTION IS WHERE THE RELAY IS FIRST REACHED, and it can refuse. Nodemailer
    // built a transport object without connecting, so this function could not fail and no
    // caller was written to expect it to. A relay that is down must not throw past
    // `broadcast.ts`'s own try: it must look the same as no SMTP at all, which is one failure
    // recorded per subscriber, each with its reason, and a run that finishes and says so.
    console.error(`[ERROR] mail.openMailPool: ${(error as Error).message}`)
    return null
  }
  pooled = { key: poolKey(cfg), transport }
  const mine = pooled
  return {
    close: () => {
      // Only if it is still ours: a config saved mid-run has already closed and replaced it.
      if (pooled === mine) closeMailPool()
    },
  }
}

export function closeMailPool(): void {
  // Not awaited: every caller is a `close()` on the way out of a run, and a QUIT this process
  // never hears the answer to has still delivered everything before it.
  void pooled?.transport.close()
  pooled = null
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
  // Inside a run, the open pool. Outside one, a transport of its own, closed below.
  const shared = pooled?.key === poolKey(cfg) ? pooled.transport : null
  try {
    const transport = shared ?? (await makeTransport(cfg))
    try {
      await transport.sendMail({
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        // The plain-text part, from the HTML one. `news/mail-text.ts` carries what it does
        // and why it is a scanner rather than the tag-strip regex that stood here.
        text: msg.text || htmlToText(msg.html),
      })
    } finally {
      if (!shared) await transport.close()
    }
    await record(true)
    return { sent: true }
  } catch (error) {
    console.error(`[ERROR] mail.sendMail: ${(error as Error).message}`)
    await record(false, (error as Error).message)
    return { sent: false, error: (error as Error).message }
  }
}
