// MCP access tokens, managed from Admin → Settings → Advanced. Each token is a
// high-entropy random string shown ONCE on creation; only its SHA-256 hash is
// stored (`mcp_tokens` table), so a leaked DB never yields a usable token. Up to
// MAX_TOKENS may exist at once. SERVER-ONLY.
//
// The hash format is load-bearing across the cutover: it is plain hex SHA-256 of the
// presented string, exactly as before, so every token the owner's connectors already hold
// keeps working. Changing it would break AI publishing silently (docs/spec/00-rationale.md, parity exception #4).

import { createHash, randomBytes } from 'node:crypto'
import { all, one, run } from '@/store/query'
import { nowMs, toIso } from '@/store/db'

const MAX_TOKENS = 5 // manual (admin-created) tokens only
const TOKEN_PREFIX = 'vbmcp_'
const TOKEN_TTL_DAYS = 180 // every token expires this long after creation

// Expiry stamp for a freshly minted token (created_at + TTL).
const expiryMs = (): number => nowMs() + TOKEN_TTL_DAYS * 86_400_000

// OAuth-issued tokens share this name and are managed separately from manual ones:
// exempt from MAX_TOKENS. They are NEVER auto-deleted — a connection persists until
// the owner deletes it in the admin (the admin is the sole authority over a
// connection's lifecycle); deleting from Claude alone just lets it re-authorize.
export const OAUTH_TOKEN_NAME = 'OAuth connector'

/** What a token may do. 'read' registers only the read-only tools on its door. */
export type McpScope = 'full' | 'read'

// What the admin UI sees — never the secret itself.
export type McpTokenInfo = {
  id: number
  name: string
  prefix: string // short non-secret display hint, e.g. "vbmcp_AbCd"
  scope: McpScope
  createdAt: string
  expiresAt: string // created_at + 180d; rejected once past
  expired: boolean // computed server-side (past expiresAt) for display
  lastUsedAt: string | null
  oauth: boolean // true = machine-issued via OAuth (not a manual admin token)
}

type TokenRow = {
  id: number; name: string; prefix: string; scope: McpScope
  created_at: number; expires_at: number; last_used_at: number | null
}

const INFO_COLS = 'id, name, prefix, scope, created_at, expires_at, last_used_at'

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')

const toInfo = (r: TokenRow): McpTokenInfo => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  scope: r.scope,
  createdAt: toIso(r.created_at),
  expiresAt: toIso(r.expires_at),
  expired: r.expires_at <= nowMs(),
  lastUsedAt: r.last_used_at == null ? null : toIso(r.last_used_at),
  oauth: r.name === OAUTH_TOKEN_NAME,
})

// All tokens (metadata only), newest first.
export async function listTokens(): Promise<McpTokenInfo[]> {
  try {
    return all<TokenRow>(
      `select ${INFO_COLS} from mcp_tokens order by created_at desc, id desc`,
    ).map(toInfo)
  } catch (error) {
    console.error(`[ERROR] mcp.listTokens: ${(error as Error).message}`)
    return []
  }
}

// Count manual (admin-created) tokens — OAuth-issued ones are exempt from the cap.
function countManualTokens(): number {
  return one<{ n: number }>(
    `select count(*) as n from mcp_tokens where name != ?`, OAUTH_TOKEN_NAME,
  )?.n ?? 0
}

const newSecret = (): { token: string; prefix: string } => {
  const token = `${TOKEN_PREFIX}${randomBytes(24).toString('base64url')}`
  return { token, prefix: token.slice(0, 12) }
}

function insertToken(name: string, scope: McpScope): { token: string; info: McpTokenInfo } {
  const { token, prefix } = newSecret()
  const row = one<TokenRow>(
    `insert into mcp_tokens (name, token_hash, prefix, scope, created_at, expires_at)
     values ($name, $hash, $prefix, $scope, $now, $expires)
     returning ${INFO_COLS}`,
    { name, hash: sha256(token), prefix, scope, now: nowMs(), expires: expiryMs() },
  )
  if (!row) throw new Error('insertToken: no row')
  return { token, info: toInfo(row) }
}

// Mint a named MANUAL token. Returns the PLAINTEXT once (never stored again).
// Throws 'token_limit' when MAX_TOKENS manual tokens already exist.
export async function createToken(name: string, scope: McpScope = 'full'): Promise<{ token: string; info: McpTokenInfo }> {
  if (countManualTokens() >= MAX_TOKENS) throw new Error('token_limit')
  return insertToken(name.trim().slice(0, 80) || 'Token', scope)
}

// Mint the OAuth-connector token (called by the token endpoint). NEVER deletes any token
// (the in-use one survives a re-authorize; nothing auto-prunes — the owner alone removes
// connections in the admin). Exempt from the manual cap → authorizing never fails with
// "limit reached". Expires 180 days after creation like every token; a connector silently
// re-authorizes across that boundary to mint a fresh one, so it stays connected.
// An OAuth connector negotiates no scope UI, so it gets what it always got: full.
export async function mintOAuthToken(): Promise<{ token: string; info: McpTokenInfo }> {
  return insertToken(OAUTH_TOKEN_NAME, 'full')
}

export async function deleteToken(id: number): Promise<void> {
  run(`delete from mcp_tokens where id = ?`, id)
}

// Verify a presented bearer: hash + lookup. Rejects an expired token (past expires_at).
// On a live match, stamps last_used_at and returns the token's id/name; otherwise null.
export async function verifyTokenHash(bearer: string): Promise<{ id: number; name: string; scope: McpScope } | null> {
  const r = one<{ id: number; name: string; scope: McpScope; expires_at: number }>(
    `select id, name, scope, expires_at from mcp_tokens where token_hash = ?`, sha256(bearer),
  )
  if (!r) return null
  if (r.expires_at <= nowMs()) return null // expired → treat as invalid
  run(`update mcp_tokens set last_used_at = ? where id = ?`, nowMs(), r.id)
  return { id: r.id, name: r.name, scope: r.scope }
}
