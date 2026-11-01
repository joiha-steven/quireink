# Map — a symptom, and the files to open first

Not loaded automatically; `CLAUDE.md` points here. Open it when you do not know where a change belongs.

| Symptom / area | Read these first |
|---|---|
| Routing, middleware, what a request does | `src/web/app.ts`, `src/web/guard.ts`, `src/web/cache-headers.ts` |
| Cache, or content not updating | `src/server/cache.ts` (in-process), `src/web/cache-headers.ts` (shared), `src/server/edge-cache.ts` |
| A page's HTML · a theme refused or let through | `src/web/{layout,chrome,article,listing}.ts`, `src/web/*.css.ts` · `src/theme/` (the install-time checker, ADR 0072; door at `src/theme/index.ts`) |
| Markdown → HTML, the editor's document, the excerpt · highlighting, footnotes · the pen | `src/md/` (the engine, ADR 0052; one import out, held by `src/md/boundary.test.ts`) · `src/render/` · `src/pen/` (self-contained, door at `src/pen/index.ts`) |
| Island JS: search, theme, comments, subscribe, book mode | `src/assets/js/` |
| Admin screens, the editor | `src/web/admin/` (the markup the server draws), `src/admin/` (the browser half: `island/` and the editor), `src/admin-shared/` (what both sides read) |
| Sign-in, TOTP, passkeys, sessions, recovery codes | `src/auth/`, `src/web/auth-routes.ts`, `src/web/passkey-routes.ts` (ADR 0071), `src/web/enrol-routes.ts` (first run) |
| Posts, pages, slugs, series, revisions, settings | `src/content/` |
| Uploads, image variants, ranges · anything Bun or Cloudflare does its own way | `src/media/` · `src/runtime/` (`ports.ts` first, then [`docs/runtimes.md`](./docs/runtimes.md)); I/O changes both sides in one commit |
| Newsletter, broadcast, SMTP | `src/news/` |
| Comments · Analytics | `src/comments/` · `src/analytics/` (writes go through `buffer.ts`) |
| SQL, migrations, the live/trashed predicate | `src/store/` |
| Scheduled publishing, redirects, rate limit, activity | `src/server/` |
| MCP server, tokens · the read-only Content API | `src/mcp/`, `src/web/admin/mcp-transport.ts`, `src/web/admin/mcp.ts` · `src/web/api-v1.ts` |
| UI strings, translations | `src/i18n/`, `locales/` (repo root, so translators can find it) |
| Imports (WordPress/Ghost/…), image rescue | `src/import/`, `src/web/admin/ops.ts` |
