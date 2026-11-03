// The MCP endpoint at /api/mcp: Streamable HTTP, wired to the SDK by hand.
//
// The frozen tree used `mcp-handler`, which wraps the SDK for Next's route handlers and
// cannot be moved here. So this is the one piece of M3 that is a rewrite rather than a
// port — and it is a small one, because the protocol's stateless mode is exactly what a
// blog needs: every call is a JSON-RPC request in a POST body and a JSON-RPC response in
// the reply. No session id, no SSE stream, no server-initiated messages.
//
// A fresh `McpServer` per request. That sounds wasteful and is not: registering the tools
// is building a table of closures, the tools hold no state between calls, and the
// alternative — one long-lived server plus a session registry — is a cache to invalidate
// and a leak to bound, bought for nothing.

// The SDK is imported inside `handleMcp`, on the first MCP request a process ever serves —
// not here. Nothing else in the tree pulls it in, so a blog whose owner has not pointed an
// agent at `/api/mcp` never loads it at all. `registerTools` takes the type from
// `@/mcp/tools`, which imports it type-only and therefore costs nothing at runtime.
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import type { Context } from 'hono'
import { registerTools } from '@/mcp/tools'
import { verifyMcpToken } from '@/mcp/auth'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { refusalFor } from '@/mcp/guarded-paths'
import { asError } from '@/mcp/result'
import { THEME_LIMITS } from '@/theme/types'
import { clientIp, overLimit, rateLimited, recordHit } from '@/server/rate-limit'

/**
 * A transport that carries exactly one exchange.
 *
 * `send` resolves the promise the handler is awaiting rather than writing to a socket:
 * the reply IS the HTTP response body, so there is nowhere else for it to go.
 */
class SingleExchange implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  private resolve!: (message: JSONRPCMessage | null) => void
  readonly reply = new Promise<JSONRPCMessage | null>((r) => { this.resolve = r })

  async start(): Promise<void> {}

  async send(message: JSONRPCMessage): Promise<void> {
    this.resolve(message)
  }

  async close(): Promise<void> {
    // A notification produces no reply, and the caller must not hang waiting for one.
    this.resolve(null)
    this.onclose?.()
  }

  /** Hand an incoming message to the server and wait for what it sends back. */
  async exchange(message: JSONRPCMessage): Promise<JSONRPCMessage | null> {
    // A notification carries no `id` and the protocol answers it with nothing. Waiting for
    // a reply anyway is a DEADLOCK, not merely a wasted await: the promise below is
    // resolved by `send` or by `close`, `send` never runs for a notification, and `close`
    // runs in the caller's `finally` — which is unreachable while the caller is still
    // parked on this line. The connector's very first move after `initialize` is the
    // `notifications/initialized` notification, so this hung on every connection: the
    // handshake looked fine, that POST never came back, and the client sat waiting for a
    // tool list it had not asked for yet.
    const expectsReply = 'id' in message
    this.onmessage?.(message)
    return expectsReply ? this.reply : null
  }
}

const jsonRpcError = (id: unknown, code: number, message: string, status = 200) =>
  Response.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { status })

/**
 * THE LARGEST BODY THIS DOOR READS: 16,078,168 bytes.
 *
 * Nothing else caps it. `web/body-cap.ts` leaves a bearer door's body to the owner, so until
 * 2026-11-03 any token, a read one included, could post a JSON body of any size and the process
 * held all of it before parsing it. The number is the largest honest call there is, worked out
 * rather than guessed: `install_theme` with a package at its expanded limit (`THEME_LIMITS.
 * totalBytes`, 10 MiB) sent as base64 is ceil(10485760 / 3) × 4 = 13,981,016 bytes, and 2 MiB on
 * top pays for the JSON around it: up to 66 file entries' names and keys, the envelope, and the
 * escaping a theme.css or theme.json sent as text costs (a quote or a newline doubles; two 64 KiB
 * text files at the worst `\uXXXX` rate are 786,432). Derived from the limit, so a package limit
 * raised later raises this with it.
 */
export const MCP_BODY_LIMIT = Math.ceil(THEME_LIMITS.totalBytes / 3) * 4 + 2 * 1024 * 1024

/**
 * The body as text, or null once it passes `limit`. Read as it arrives, so a body that lies about
 * its length, or declares none, is stopped at the limit rather than after it.
 */
async function readCapped(req: Request, limit: number): Promise<string | null> {
  if (req.body === null) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.byteLength
  }
  return new TextDecoder().decode(out)
}

/** A refusal a client can read: the HTTP status says too large, the JSON-RPC error says the number. */
const tooLarge = (): Response =>
  jsonRpcError(null, -32600, `Request too large: an MCP request body is at most ${MCP_BODY_LIMIT} bytes`, 413)

/**
 * WRONG BEARERS ONE ADDRESS MAY SEND IN FIFTEEN MINUTES: 20.
 *
 * Until 2026-11-04 nothing counted them: 500 wrong bearers answered 401 in 75 ms. A 192-bit token
 * is not guessed at any rate, so this is not what keeps a token secret; it is what tells a script,
 * or a client holding a revoked token in a retry loop, to back off (`retry-after`) instead of being
 * answered 401 forever. Failures only, like the sign-in lockout, so an agent working is never charged
 * for working.
 *
 * ASKED AFTER THE LOOKUP, never before it. Refusing a locked address before looking was tried first
 * and measured against a running instance: one stale client looping on a revoked token locked a
 * working client on the same address out for fifteen minutes, which on the owner's own laptop is the
 * owner. A right token always gets in; only a wrong one is answered 429.
 */
export const MCP_AUTH_FAILURES = 20
const AUTH_WINDOW_MS = 15 * 60_000

/**
 * CALLS ONE TOKEN MAY MAKE IN A MINUTE: 600, ten a second.
 *
 * An agent waiting on a model between calls makes a few a minute; a script tagging an archive makes
 * one per post as fast as the server answers, and this leaves that room. What it stops is the loop
 * nobody is watching: 300 calls measured at 1.9 s were all answered. Keyed by the token rather than
 * the address, so a runaway connector is stopped and the owner's other connections are not.
 */
export const MCP_CALLS_PER_MINUTE = 600

const tooMany = (body: unknown, retryAfterSec: number): Response =>
  Response.json(body, { status: 429, headers: { 'retry-after': String(retryAfterSec) } })

export async function handleMcp(c: Context): Promise<Response> {
  const settings = await getSettings()
  // The owner's switch. Off means the endpoint is not there, rather than there and
  // refusing: a disabled feature should not leave a probe-able surface behind.
  if (!settings.mcp.enabled) return c.text('Not found', 404)

  const site = resolveSiteUrl(settings)
  // A 401 has to point the client at the metadata that starts the OAuth flow, or a
  // connector has no way to discover how to authenticate. That header IS the handshake.
  const unauthorized = () => new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: {
      'content-type': 'application/json',
      'www-authenticate':
        `Bearer resource_metadata="${site}/.well-known/oauth-protected-resource"`,
    },
  })

  const auth = c.req.header('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  const verified = token ? await verifyMcpToken(token) : undefined
  if (!verified) {
    const failures = `mcp-auth:${clientIp(c)}`
    if (overLimit(failures, MCP_AUTH_FAILURES, AUTH_WINDOW_MS)) {
      return tooMany({ error: 'too_many_requests' }, AUTH_WINDOW_MS / 1000)
    }
    recordHit(failures, AUTH_WINDOW_MS)
    return unauthorized()
  }
  if (rateLimited(`mcp-call:${verified.clientId}`, MCP_CALLS_PER_MINUTE)) {
    return tooMany({ jsonrpc: '2.0', id: null, error: { code: -32000, message: `Too many requests: a token makes at most ${MCP_CALLS_PER_MINUTE} calls a minute` } }, 60)
  }
  const readOnlyDoor = !verified.scopes.includes('full') && !verified.scopes.includes('admin')
  const adminDoor = verified.scopes.includes('admin')

  // DELETE ends a session, and there are no sessions to end. GET would open the SSE
  // stream this deliberately does not implement. Both are answered, not ignored.
  if (c.req.method === 'DELETE') return new Response(null, { status: 204 })
  if (c.req.method === 'GET') return c.text('Method Not Allowed', 405)

  // BEFORE THE PARSE, and twice: the declared length refuses without reading a byte, and the read
  // itself stops at the limit for a body that declares none or declares less than it sends.
  const declared = Number(c.req.header('content-length') ?? '')
  if (Number.isFinite(declared) && declared > MCP_BODY_LIMIT) return tooLarge()
  const text = await readCapped(c.req.raw, MCP_BODY_LIMIT)
  if (text === null) return tooLarge()

  let message: JSONRPCMessage
  try {
    message = JSON.parse(text) as JSONRPCMessage
  } catch {
    return jsonRpcError(null, -32700, 'Parse error')
  }

  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js')
  const server = new McpServer({ name: 'quire', version: '2.0' })
  // The cast is one-way narrowing, not a lie: ToolHost is the SUBSET of registerTool the
  // tool files use (the SDK's config is a superset, and a callback that ignores the SDK's
  // second `extra` argument is an ordinary JS callback). TS refuses to prove generic
  // method assignability here; the wire test proves the part that matters.
  const host = server as unknown as import('@/mcp/registry').ToolHost
  // A 'read' token's door registers only the tools marked readOnly, so a write tool is
  // not refused to it — it does not EXIST for it, in the tool list or anywhere else.
  // Withholding at registration rather than checking inside handlers is the same shape as
  // Invariant 4: a rule about where something is mounted cannot be forgotten per call.
  //
  // And the write tools that DO register get Invariant 1 the same structural way the
  // owner router now applies it: whatever a mutating tool did, the cache is flushed after
  // it ran. The flushes inside tool bodies remain where they are sharper; this wrapper is
  // the one a new tool cannot forget.
  registerTools({
    registerTool: (name, meta, handler) => {
      if (readOnlyDoor && !meta.readOnly) return
      if (meta.readOnly) { host.registerTool(name, meta, handler); return }
      host.registerTool(name, meta, async (args) => {
        // AT THE DOOR, not inside the tool, for the same reason the read gate is: a rule
        // about which door a call came through cannot be forgotten by a handler that does
        // not know there are doors. The tool itself stays one tool with one behaviour.
        const refusal = adminDoor ? null : refusalFor(name, args as Record<string, unknown>)
        if (refusal) return asError(refusal)
        try { return await handler(args) } finally { clearCache() }
      })
    },
  })
  const transport = new SingleExchange()
  await server.connect(transport)

  try {
    const reply = await transport.exchange(message)
    // A notification gets 202 with no body, which is what the specification asks for.
    if (reply === null) return new Response(null, { status: 202 })
    return Response.json(reply)
  } catch (error) {
    console.error(`[ERROR] mcp: ${(error as Error).message}`)
    return jsonRpcError((message as { id?: unknown }).id, -32603, 'Internal error')
  } finally {
    await server.close().catch(() => {})
  }
}
