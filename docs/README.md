# docs/ — durable truth

Everything here describes how Quire Ink works **right now**. Out of date here is a bug: fix
it in place, in the same commit as the behaviour change that made it wrong.

What does not belong here: anything dated (that is a snapshot, not a document), anything
about what we intend to do, and any rule already stated somewhere else. Snapshots and intent
are not in this repository at all
([ADR 0017](decisions/0017-move-state-and-instance-config-private.md)); `check:docs` fails on
a dated filename in this directory.

One rule lives in exactly ONE file. `CLAUDE.md` is a router and restates nothing, because two
copies of a rule means one is wrong within a month
([ADR 0010](decisions/0010-four-homes-doc-layout.md)).

## How it works now

| File | Holds |
|---|---|
| [invariants.md](invariants.md) | The 7 load-bearing rules, each with its enforcing code and its guard |
| [features/reading.md](features/reading.md) | Reading and discovery, footnotes, highlighter and callouts, series, book mode |
| [features/editing.md](features/editing.md) | The editor, scheduled publishing, per-post SEO, the video library, WordPress import |
| [features/admin.md](features/admin.md) | Trash, Help, the UI kit, the content dashboard, the activity log, Settings |
| [features/newsletter.md](features/newsletter.md) | Subscribers, broadcast, the send log, the double-send guard |
| [features/comments.md](features/comments.md) | The tree, tombstones, the markdown subset, notifications |
| [features/site.md](features/site.md) | Homepage mode and URL redirects |
| [conventions/](conventions/README.md) | One file per surface — [type](conventions/type.md) · [layout](conventions/layout.md) · [colour](conventions/colour.md) · [motion](conventions/motion.md) · [IDE chrome](conventions/ide-chrome.md) · [i18n](conventions/i18n.md) · [scripts](conventions/scripts.md) · [releases](conventions/releases.md) |
| [performance.md](performance.md) | The resource-loading law: images, fonts, CSS split, island JS |
| [delivery.md](delivery.md) | What the server does before it answers: the render cache, the switch, the CDN purge, compression |
| [admin-design.md](admin-design.md) | The admin visual contract |
| [admin-navigation.md](admin-navigation.md) | How the admin moves between screens, and how it recovers from an update underneath an open tab |
| [admin-editor.md](admin-editor.md) | The editor's own contract: the writing surface, the caret, the key feedback |
| [appearance.md](appearance.md) | For the OWNER: every knob that changes how the site looks, the CSS variables and class names custom CSS may target, and what cannot be changed |
| [homepage.md](homepage.md) | What `/` serves: the post list, a page, or a composed front page |
| [seo-pwa.md](seo-pwa.md) | Sitemap, feeds, OG, region, PWA |
| [agent-ready.md](agent-ready.md) | Markdown negotiation, `.well-known` discovery, the three shipped skills, Content-Signal |
| [mcp.md](mcp.md) | MCP server, tokens, OAuth |
| [agent-cookbook.md](agent-cookbook.md) | Prompts that do real jobs with a connected agent, and where the lines are |
| [backups.md](backups.md) | What is copied off the server, how often, and how to restore it |
| [self-host.md](self-host.md) | Running it on your own server |
| [self-host-docker.md](self-host-docker.md) | The same thing in a container, and on a NAS |

## How it is built

`spec/` was written before and during the rewrite from Next.js + PostgreSQL to Bun + Hono +
SQLite. Where a spec disagrees with the code, **the code won**; the four marked **reference**
held up and are the working account.

| File | Holds |
|---|---|
| [spec/00-rationale.md](spec/00-rationale.md) | Why 2.0 exists, the non-goals, the numbered parity exceptions, the risks taken |
| [spec/01-schema.md](spec/01-schema.md) | The SQLite schema and the full Postgres → SQLite mapping. **Reference** |
| [spec/02-structure.md](spec/02-structure.md) | Module layout, request flow, the seven invariants in full. **Reference** |
| [spec/03-golden.md](spec/03-golden.md) | The rendering contract: fixtures, capture, and what a diff means |
| [spec/04-frontend.md](spec/04-frontend.md) | Server-rendered HTML, the island model, the CSS split. **Reference** |
| [spec/06-auth.md](spec/06-auth.md) | Password + TOTP + recovery codes, sessions, the cookie. **Reference** |
| [spec/07-parity-public.md](spec/07-parity-public.md) | Every reader-facing 1.x behaviour, with the 48 fragile ones marked. The defence against silent feature loss, since the golden harness only sees public HTML |
| [spec/07-parity-admin.md](spec/07-parity-admin.md) | The same for the admin, editor, settings, MCP, operations and auth, none of which the harness sees at all |

## Why it is this way

[decisions/](decisions/README.md) — ADRs, append-only, with an index saying which are still
in force. Going against something already decided starts by reading that index.
