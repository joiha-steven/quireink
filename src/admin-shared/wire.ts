// THE SHAPES OF THE THREE REPLIES THE SERVER COULD NOT DRAW.
//
// Settings ships every state drawn (ADR 0054), with three exceptions: the signed-in devices,
// the MCP tokens and the snapshots on disk all come from routes the page has not called when
// it is rendered. The island fetches them and fills a `<template>`.
//
// Which means a payload crosses a seam where NOTHING checked it. The island declared its own
// idea of each reply, one file away from the route that builds it, and both ideas were wrong:
// a session's `lastSeenAt` was typed `string` and is epoch milliseconds, so `.slice()` on it
// threw and the device list stayed empty on a screen whose whole job is showing who is signed
// in; and a snapshot's date was read as `s.at` when the route sends `createdAt`, so every
// backup row would have thrown the same way. Both type-checked. Both were invisible until the
// browser's console was read, because an island that throws leaves the server's empty state on
// the glass and looks exactly like a list with nothing in it.
//
// So the description lives HERE, once. The route annotates what it returns with it and the
// island annotates what it reads with it, and the compiler is standing at the seam.
//
// Types only, on purpose: this file is imported by both faces and must stay free of anything
// either of them cannot have.

/** One signed-in device, as `/api/security` sends it. */
export type SessionWire = {
  id: string
  /** The user agent, or null when the browser sent none. */
  device: string | null
  /**
   * ⚠️ EPOCH MILLISECONDS, NOT AN ISO STRING. `sessions` stores both stamps as integers and
   * the route passes them through untouched. Anything that formats one must go through a
   * `Date`, never through string arithmetic.
   */
  createdAt: number
  lastSeenAt: number
  current: boolean
}

/** Everything the account card asks for in one round trip. */
export type SecurityWire = {
  currentSessionId: string
  recoveryLeft: number
  totpEnabled: boolean
  sessions: SessionWire[]
}

/** One archive on disk, as `/api/backup/list` sends it. ISO 8601, from the file's own mtime. */
export type SnapshotWire = {
  name: string
  size: number
  createdAt: string
}

export type BackupListWire = {
  snapshots: SnapshotWire[]
  /** The newest snapshot's stamp, or null when there has never been one. */
  lastRunAt: string | null
}

/**
 * One MCP token, as `/api/mcp/tokens` sends it. No secret is in here: the plaintext exists
 * only in the reply that mints it, and `prefix` is the non-secret display hint.
 *
 * `scope` is a string rather than the server's union because the island only ever compares it
 * to a literal, and narrowing it here would drag the server's vocabulary across the seam.
 */
export type McpTokenWire = {
  id: number
  name: string
  prefix: string
  scope: string
  createdAt: string
  expiresAt: string
  /** Computed by the server against its own clock, not the browser's. */
  expired: boolean
  lastUsedAt: string | null
}

/**
 * The SMTP card's stored values, as `/api/mail` sends them.
 *
 * ⚠️ `hasPass`, NEVER `pass`. The password is a secret and this reply goes to a browser: the
 * card shows a filled placeholder from the boolean instead, on a box that stays empty, because
 * a blank credential field means KEEP and sending the dots back would store the dots.
 */
export type MailWire = {
  host: string
  port: number
  user: string
  from: string
  secure: boolean
  hasPass: boolean
  /** Whether the far end has everything it needs, decided by the server. */
  configured: boolean
  /**
   * WHY it cannot send, when it cannot. `smtp_off` is the environment's switch and is not a
   * fault: every field is right and this machine is simply not allowed to send.
   */
  blocked: 'smtp_off' | 'smtp_not_configured' | null
}
