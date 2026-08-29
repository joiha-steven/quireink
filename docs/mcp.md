> Split from CLAUDE.md — read when touching the MCP server (`/api/mcp`, `src/mcp/`), its tokens, or the OAuth flow.

# MCP server — `/api/mcp` + `src/mcp/`

- **What it is.** A remote MCP endpoint (Streamable HTTP, `mcp-handler` + `@modelcontextprotocol/sdk`)
  that lets an MCP client (Claude/ChatGPT) operate the blog. Tools are THIN wrappers over the same
  `lib/` functions the admin routes use — same slug rules, revisions, soft-delete, revalidation,
  activity log. **Off unless the owner enables it** (Admin → Settings → Connections toggle,
  `settings.mcp.enabled`); `verifyMcpToken` 401s every call while off.
- **The 2.0 transport is hand-written** (`src/web/admin/mcp-transport.ts`), because `mcp-handler`
  wraps the SDK for Next's route handlers and could not come along. Stateless: a fresh `McpServer`
  per request, no session id, no SSE stream. **A message with no `id` is a NOTIFICATION — deliver it
  and answer 202 immediately, never wait for a reply.** Nothing sends one, so waiting deadlocks the
  request, and the connector's first move after `initialize` is exactly such a notification
  (`notifications/initialized`). Symptom when this was wrong: the handshake succeeded, that POST
  never returned, and the client showed a spinner and then "server is currently unavailable".
- **Auth = admin-managed tokens + thin OAuth.** Manual tokens are created in the admin (up to 5,
  named, shown ONCE on creation, each with a **scope** — `full` (the default) or `read`, chosen at mint
  time; a `read` token's door registers only the tools marked `readOnly` (`src/mcp/registry.ts`,
  pinned by `src/mcp/scope.test.ts`), so write tools are absent from its `tools/list`, not merely
  refused — only the SHA-256 hash is kept in the `mcp_tokens` table; see
  `lib/mcp/tokens.ts`). Every token **expires 180 days after creation** (`expires_at`, set on insert,
  default in `schema.sql`); `verifyMcpToken` hashes the bearer, looks it up, **rejects it once past
  `expires_at`**, else stamps `last_used_at` (while the toggle is on). There is **no `MCP_TOKEN` env
  var.** Connectors that require OAuth run a minimal OAuth 2.1 authorization-code + PKCE flow gated by
  the owner's NextAuth login (`src/app/api/mcp/{authorize,token,register}` + `src/app/.well-known/oauth-*`);
  the `/token` exchange **mints a 180-day token via `mintOAuthToken`** (named "OAuth connector") and
  returns it. **`/register` PERSISTS the client** — it mints a unique `client_id` and stores the client's
  `redirect_uris` (`mcp_clients` table, `lib/mcp/clients.ts`); `/authorize` then accepts a `redirect_uri`
  ONLY if it **exactly matches one registered for that `client_id`** OR is a **loopback** address
  (`http://127.0.0.1:PORT`, `http://localhost:PORT`, IPv6 `[::1]` — the RFC 8252 native-app exception, since
  desktop clients use ephemeral ports). A non-matching `redirect_uri` is rejected **inline (400)** — the error
  is NEVER redirected to the unvalidated uri (open-redirect → owner-takeover fix). **Consent gate:** because
  `/register` is PUBLIC, the allowlist alone is insufficient (an attacker registers their own client+redirect,
  then phishes the logged-in owner). So a **non-loopback** `/authorize` does NOT auto-issue a code — it renders
  a minimal consent page (`lib/mcp/consent.ts`) showing the exact `client_id` + `redirect_uri`; the owner clicks
  Approve, which POSTs back to `/authorize`. The Approve POST re-checks owner auth + the allowlist and requires a
  **CSRF token bound to the owner's SESSION** (HMAC over `getToken({raw:true})`'s session JWT + the oauth params),
  so a forged cross-site auto-submit that rides the owner's cookies still can't mint a code. **Loopback redirects
  go through the same consent page since 2026-08-29** — GET auto-approve meant any web page could make the
  signed-in owner's browser fetch `/authorize`, and a code landed on whatever listened on that local port;
  loopback stays a valid redirect *target* without pre-registration, it just costs the same one Approve
  click as every other client. **Codes are single-use:**
  each carries a random `jti` that `/token` records in `mcp_used_codes` on first exchange (`lib/mcp/used-codes.ts`);
  a replay of the same code is rejected `invalid_grant`. **OAuth tokens are exempt from the manual 5-cap and are NEVER auto-deleted** (an expired
  row lingers as dead until the owner deletes it; a connector silently re-authorizes to mint a fresh one).
  **Lifecycle rule: the admin is the SOLE authority over a connection** — beyond the 180-day expiry a
  token persists (no prune) until the OWNER deletes it in the admin; deleting the connector in Claude
  alone just lets it re-authorize (a new token). So authorize once = stays connected (connector
  re-auths across the 180-day boundary), and an admin delete is final unless the owner re-authorizes.
  (A reconnect mints a new row; the prior one persists until the owner removes it — the admin
  lists/deletes them all.) Codes are HMAC-signed
  (`MCP_OAUTH_SECRET` → falls back to `serverSecret('mcp-oauth')`, generated into the database;
  `AUTH_SECRET` is gone) in `src/mcp/auth.ts`. Token CRUD: owner-only
  `/api/mcp/tokens` (+ `/:id`); UI in `src/admin/components/McpFields.tsx` (cap counts manual only),
  which also **shows the endpoint URL with a copy button** while the toggle is on — a client has
  to be pointed somewhere and nothing else on the card says where. It prefers `settings.siteUrl`
  and falls back to the browser's origin, since a blank `siteUrl` is resolved from the
  environment, which the admin cannot read.
- **The consent screen needs an nginx exception**, so anyone putting this behind a proxy with
  a CSP has to make it too:
  Approving POSTs to `/api/mcp/authorize` and is answered with a 302 to the client's own
  callback, and a browser enforces `form-action` across a form submission's WHOLE redirect
  chain — so under `form-action 'self'` the Approve button did nothing, silently. Only that
  directive is relaxed, and only on that location. **An `add_header` inside a `location`
  REPLACES the inherited ones**, so all five headers are repeated there.
- **The tool surface is a neutral registry** (`src/mcp/registry.ts`): every tool file
  registers against `ToolHost`, which `McpServer` satisfies, and `collectTools()` hands
  the same list out as data for any OTHER door (the planned in-admin assistant). One
  list, many doors, one rulebook — a door must never grow a private tool, and
  `registry.test.ts` pins the forbidden names (broadcast, token minting) at the registry
  level so they are absent from every door at once.
- **Tools** (`src/mcp/tools.ts` posts/pages/taxonomy, `src/mcp/tools-library.ts`
  media/files/settings, `src/mcp/tools-insight.ts` the READING half — traffic, audience
  counts, comments, owner search, update status — and `src/mcp/tools-steward.ts` the
  STEWARD half: front-page curation, appearance from the curated menus, per-post traffic,
  owner replies, the test send, snapshots; results via `src/mcp/result.ts`).
  **The steward half assumes an agent has no eyes**: appearance accepts preset ids only
  (the zod enums are built from `THEME_PRESETS`/`FONT_PRESETS`, so the schema tracks the
  menus), never free-form color. **`send_test_newsletter` mails only the owner** — the
  recipient is not a parameter — **and the real broadcast is deliberately not a tool**:
  an email cannot be unsent.
  **The reading half strips identities on purpose:** `get_audience` returns counts and
  never a subscriber address; `list_comments` drops the email and IP the admin shape
  carries. That line is held by `tools-insight.test.ts`, not by prose. Worked examples
  for owners: [`agent-cookbook.md`](./agent-cookbook.md). Content is Markdown verbatim — no HTML
  conversion. Deletes are soft (→ Trash). **`update_post` REPLACES the whole post; `patch_post`
  merges only the passed fields over the current post (body preserved)** — use it to change just
  the title/tags/categories/etc. **`update_settings` exposes only a safe allowlist
  (title/description/showDescription)** — the zod inputSchema IS the allowlist, so sensitive
  settings can't be written over MCP. `get_settings` reads all. **Adding a tool that mutates →
  `clearCache()` + `logActivity` like the admin routes.**
