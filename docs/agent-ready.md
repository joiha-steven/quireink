> Split from CLAUDE.md — the agent-discovery surface: what Quire Ink exposes so AI agents
> can find, read, and drive the site (the standards behind Cloudflare's "Is Your Site
> Agent-Ready?" scan). MCP internals → [`mcp.md`](./mcp.md); worked prompts → [`agent-cookbook.md`](./agent-cookbook.md); SEO/feeds → [`seo-pwa.md`](./seo-pwa.md).

# Agent-ready surface

Quire Ink is built around two things agents want: **content authored in Markdown** and a
**working MCP server** (`/api/mcp`, Streamable HTTP, OAuth 2.0 + PKCE). The endpoints
below advertise and expose those; most are thin route handlers that describe what
already exists.

## Endpoints

| Path | What | Route |
|---|---|---|
| `/:slug` + `Accept: text/markdown` | Post/page as raw **Markdown** (the source, not a conversion). Browsers (`Accept: text/html`) get HTML unchanged. | `src/web/markdown.ts` (`wantsMarkdown`), negotiated in `src/web/app.ts` |
| `/api/md/:slug` | The same document at an explicit path | `src/web/markdown.ts` |
| `/.well-known/oauth-authorization-server` | OAuth AS metadata (RFC 8414) | `src/web/admin/mcp.ts` |
| `/.well-known/oauth-protected-resource` | OAuth protected-resource metadata (RFC 9728) | `src/web/admin/mcp.ts` |
| `/api/mcp` | The MCP transport itself | `src/web/admin/mcp-transport.ts`, see [`mcp.md`](./mcp.md) |
| `/llms.txt` `/sitemap.xml` `/feed.xml` | Content index / sitemap / RSS | see [`seo-pwa.md`](./seo-pwa.md) |

The negotiation lives in the router rather than in a config file, which is the only place
it can be read next to the route it affects. Both `.well-known` documents answer `OPTIONS`
and send permissive CORS, because a connector's browser half fetches them cross-origin.

A new public read route is owner-gated by default; making it public means adding it to
`PUBLIC_WRITES` in `scripts/checks/routes-guarded.ts` **with the reason**, or the build
fails ([`spec/02-structure.md`](spec/02-structure.md)).

## Not carried into 2.0 yet

These existed in the frozen tree and are unchecked parity items
([`spec/07-parity-public.md`](spec/07-parity-public.md) §9). Do not describe them as present:
`/.well-known/mcp/server-card.json`, `/.well-known/api-catalog` (RFC 9727), `/auth.md`,
the homepage RFC 8288 `Link:` header, and the `Content-Signal` line in `robots.txt`.

## ⚠️ Reverse-proxy requirement — `/.well-known/*` must reach the app

The OAuth/MCP discovery routes are served by the app, so a proxy in front MUST forward
`/.well-known/*` to it rather than serve it from disk. A CloudPanel/nginx vhost ships a
`location ~ /.well-known { … }` block (for ACME) with **no `proxy_pass`** — it swallows
ALL `/.well-known/*` and returns a disk 404, so discovery silently breaks. Narrow it to
`location ^~ /.well-known/acme-challenge/` so everything else falls through to the
proxy. (Also purge the CDN once — a cached 404 outlives the fix.) See the deploy notes
in the ops repo / memory.

## Skills that ship in the repository

`.claude/skills/` holds three Agent Skills, and they are in git on purpose: an agent that
has just cloned this repository already knows how to run it. They are the only part of
`.claude/` that is not private.

| Skill | For |
|---|---|
| [`quireink-install`](../.claude/skills/quireink-install/SKILL.md) | Installing, upgrading or repairing a self-hosted blog: Docker or Bun under systemd, the proxy, the claim link, the post-install checks |
| [`quireink-write`](../.claude/skills/quireink-write/SKILL.md) | Working a live blog over MCP: drafting, publishing, media, the front page, traffic, moderation, and where the lines are |
| [`quireink-move-in`](../.claude/skills/quireink-move-in/SKILL.md) | Migrating from WordPress, Ghost, Substack or Medium — the import writes the redirects and fetches the images itself; the skill walks the checks that remain (the failure list, the converter's blind spots) |

They summarise documents in `docs/` rather than restating rules
([ADR 0010](decisions/0010-four-homes-doc-layout.md)), and `check:docs` guards their links
and their size like any other document. Keeping them true is the release rule in
[`conventions/releases.md`](conventions/releases.md), beside the README's install paths.

Owners who drive the blog from somewhere else copy the operating one into their own agent:

```bash
cp -r .claude/skills/quireink-write ~/.claude/skills/
```

This is a file in a repository, not a network surface. The **Agent Skills index** listed as
deliberately absent below is a different thing: an HTTP endpoint advertising skills to
strangers, which is still not what this blog needs.

## Content-usage policy (Content-Signal)

The frozen tree's `robots.txt` declared `search=yes, ai-train=yes, ai-input=yes`, matching
the AI-friendly stance that `/llms.txt` also expresses. **2.0's `renderRobots`
(`src/web/feeds.ts`) does not emit it** — see the parity list above. When it comes back it
belongs beside the rest of the robots body, and it is a good candidate for a setting rather
than a constant.

## Not implemented (deliberate)

Emerging/low-fit standards left out, with the reason — revisit if a real agent needs one:
- **DNS-AID** (DNS SVCB discovery records) — infra, not code: publish `_index._agents`
  / `_a2a._agents` SVCB records at the DNS provider (Cloudflare) + DNSSEC.
- **Agent Skills index** (the discovery ENDPOINT, not the files above), **A2A Agent
  Card**, **WebMCP** — the MCP server already covers
  agent tool-use; these are early specs (unstable schemas / Chrome-only) that don't map
  cleanly onto a blog. The MCP Server Card is the stable equivalent.
- **Web Bot Auth** (HTTP message-signature verification) — niche; adds request-signing
  verification with little benefit for public content.
