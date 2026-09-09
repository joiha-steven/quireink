> Read when touching the MCP server (`/api/mcp`, `src/mcp/`), its tokens, or the OAuth flow.

# MCP server — `/api/mcp` + `src/mcp/`

- **What it is.** A remote MCP endpoint (Streamable HTTP, `@modelcontextprotocol/sdk`)
  that lets an MCP client (Claude/ChatGPT) operate the blog. Tools are THIN wrappers over the same
  `src/content/` and `src/server/` functions the admin routes use — same slug rules, revisions, soft-delete, revalidation,
  activity log. **Off unless the owner enables it** (Admin → Settings → Server & connections toggle,
  `settings.mcp.enabled`); `verifyMcpToken` 401s every call while off.
- **The 2.0 transport is hand-written** (`src/web/admin/mcp-transport.ts`), because `mcp-handler`
  wraps the SDK for Next's route handlers and could not come along. Stateless: a fresh `McpServer`
  per request, no session id, no SSE stream. **A message with no `id` is a NOTIFICATION — deliver it
  and answer 202 immediately, never wait for a reply.** Nothing sends one, so waiting deadlocks the
  request, and the connector's first move after `initialize` is exactly such a notification
  (`notifications/initialized`). Symptom when this was wrong: the handshake succeeded, that POST
  never returned, and the client showed a spinner and then "server is currently unavailable".
- **Tokens, minted in the admin.** Up to five manual ones, named, shown ONCE, stored as a
  SHA-256 hash in `mcp_tokens` (`src/mcp/tokens.ts`). Each carries a **scope** chosen at mint
  time — `full` (the default) or `read`; a `read` token's door registers only the tools marked
  `readOnly`, so write tools are ABSENT from its `tools/list` rather than refused
  (`src/mcp/registry.ts`, pinned by `src/mcp/scope.test.ts`). Every token **expires 180 days
  after creation**; `verifyMcpToken` hashes the bearer, rejects it past `expires_at`, else
  stamps `last_used_at`. There is **no `MCP_TOKEN` env var**.
- **OAuth, for connectors that require it.** A minimal OAuth 2.1 authorization-code + PKCE flow
  gated by the owner's own sign-in: `/api/mcp/{authorize,token,register}` plus the two
  `/.well-known/oauth-*` documents, all in `src/web/admin/mcp.ts`. The `/token` exchange mints a
  180-day token named "OAuth connector". Codes are HMAC-signed (`MCP_OAUTH_SECRET`, falling back
  to `serverSecret('mcp-oauth')` in the database) in `src/mcp/auth.ts`, and are **single-use**:
  each carries a random `jti` recorded in `mcp_used_codes` on first exchange, so a replay is
  `invalid_grant`.
- **IndieAuth on the same server** ([ADR 0046](decisions/0046-the-notebook-speaks-the-open-standards.md)):
  an `https:` `client_id` whose `redirect_uri` shares its origin passes the redirect gate without
  registering (the consent page still names both); the requested `scope` rides inside the code and
  a writing scope mints `full`, anything else `read`; `/token` returns `me`; `POST /authorize` with
  `grant_type=authorization_code` is the sign-in-only exchange and returns `{ me }`. The Micropub
  endpoint (`/micropub`, `docs/features/notes.md`) takes these tokens. All of it is behind the same
  switch as MCP, and the head advertises the `rel` links only while it is on.
- **Three gates on `/authorize`, and each closed a real hole.** (1) `/register` persists the
  client and its `redirect_uris` (`mcp_clients`, `src/mcp/clients.ts`); `/authorize` accepts a
  `redirect_uri` only on an exact match for that `client_id`, or a **loopback** address (the RFC
  8252 native-app exception, since desktop clients take ephemeral ports). A non-matching one is
  refused **inline with a 400** and never redirected to, or the endpoint would be an open
  redirect. (2) `/register` is PUBLIC, so an allowlist alone is not enough — an attacker can
  register their own client and phish the signed-in owner. So `/authorize` never auto-issues a
  code: it renders a consent page (`src/mcp/consent.ts`) naming the exact `client_id` and
  `redirect_uri`, and the owner clicks Approve. (3) That POST re-checks owner auth and the
  allowlist and requires a **CSRF token bound to the session**, so a forged auto-submit riding
  the owner's cookies still mints nothing. **Loopback goes through the same page since
  2026-08-29**: GET auto-approve let any web page make the owner's browser fetch `/authorize`,
  and the code landed on whatever listened on that port.
- **The admin is the SOLE authority over a connection.** Past the 180-day expiry a token
  persists — nothing prunes it — until the owner deletes it; OAuth tokens are exempt from the
  five-token cap. Deleting the connector in Claude only lets it re-authorize, minting a new row
  beside the old one. So authorizing once stays connected across the expiry boundary, and an
  admin delete is final unless the owner authorizes again. Token CRUD is owner-only
  `/api/mcp/tokens` (+ `/:id`); the UI is `src/admin/components/McpFields.tsx`, whose cap counts
  manual tokens only and which **shows the endpoint URL with a copy button** while the toggle is
  on — a client has to be pointed somewhere and nothing else on the card says where. It prefers
  `settings.siteUrl` and falls back to the browser's origin, since a blank `siteUrl` resolves
  from the environment, which the admin cannot read.
- **The consent screen needs an nginx exception**, so anyone putting this behind a proxy with
  a CSP has to make it too:
  Approving POSTs to `/api/mcp/authorize` and is answered with a 302 to the client's own
  callback, and a browser enforces `form-action` across a form submission's WHOLE redirect
  chain — so under `form-action 'self'` the Approve button did nothing, silently. Only that
  directive is relaxed, and only on that location. **An `add_header` inside a `location`
  REPLACES the inherited ones**, so the two nginx sets (HSTS and the CSP) are repeated there.
- **The tool surface is a neutral registry** (`src/mcp/registry.ts`): every tool file
  registers against `ToolHost`, which `McpServer` satisfies, and `collectTools()` hands
  the same list out as data for any OTHER door (the in-admin assistant, ADR 0040). One
  list, many doors, one rulebook — a door must never grow a private tool, and
  `registry.test.ts` pins the forbidden names (broadcast, token minting) at the registry
  level so they are absent from every door at once.
- **Tools** (`src/mcp/tools.ts` posts/pages/taxonomy, `src/mcp/tools-notes.ts` the
  notebook, `src/mcp/tools-library.ts` media/files/settings, `src/mcp/tools-insight.ts` the READING half — traffic, audience
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
  the title/tags/categories/etc. **`list_settings` names every setting that can be
  changed — path, type, current value — and `update_settings` takes any one of those paths**
  (2.2.4; it wrote three fields before, and said the rest could not be changed over MCP).
  Two things had to move first: a token now carries a SCOPE, and a `read` token's door never
  registers a write tool at all (`mcp-transport.ts`); and the deep merge is asserted for every
  path one at a time with the other 157 watched (`content/settings-path.test.ts`), so a patch
  built from one path cannot damage a neighbour. The route to disk is unchanged —
  `saveSettings`, which sanitises, clamps and refuses exactly as it does for the form — so
  nothing reachable here is anything the owner's own screens could not already do.
  `get_settings` reads all. **A tool that mutates still calls `logActivity`;
  the door itself flushes the cache after every write tool (Invariant 1).**
