# docs/ — durable truth

Everything here describes how Quire Ink works **right now**. Out of date here is a bug: fix it
in place, in the same commit as the behaviour change that made it wrong.

What does not belong here: anything dated (that is a snapshot, see [`../state/`](../state/README.md)),
anything about what we intend to do (that is `state/ROADMAP.md` or `state/TASKS.md`), and
any rule that is already stated somewhere else. `check:docs` fails on a dated filename in
this directory.

| File | Holds |
|---|---|
| [invariants.md](invariants.md) | The 7 load-bearing rules, each with its enforcing code and its guard |
| [features.md](features.md) | What each feature area does. ~20 areas, one file (see the split task in `state/TASKS.md`) |
| [conventions.md](conventions.md) | Typography, header alignment, layout, dividers, i18n, releases |
| [performance.md](performance.md) | The resource-loading law: fonts, CSS split, island JS |
| [admin-design.md](admin-design.md) | The admin visual contract |
| [seo-pwa.md](seo-pwa.md) | Sitemap, feeds, OG, region, PWA |
| [agent-ready.md](agent-ready.md) | Markdown negotiation, `.well-known` discovery, Content-Signal |
| [mcp.md](mcp.md) | MCP server, tokens, OAuth |
| [backups.md](backups.md) | What is copied off the box, how often, and how to restore it |
| [self-host.md](self-host.md) | Running it on your own server |
| [spec/](spec/README.md) | How 2.0 is built: schema, structure, frontend, importer, auth, parity |
| [decisions/](decisions/README.md) | ADRs, append-only, with a still-in-force index |

## Two things to know before trusting a file path here

**1. These were written against the frozen tree and have now been refreshed.**
`features.md`, `conventions.md`, `performance.md`, `seo-pwa.md`, `agent-ready.md` and
`mcp.md` predate the rewrite. Their RULES were always current — 2.0 follows them, that was
the whole point of a port — and their file citations were swept against the 2.0 tree for
the 2.0.0 release. Where 2.0 has NOT carried something over, the file now says so in place
rather than describing the frozen behaviour; those gaps are the unchecked items in
[`spec/07-parity.md`](spec/07-parity.md). If you find a citation that still points at
`v1/src/…` without saying it means to, that is a bug — fix it, and find the code through
[`../CLAUDE.md`](../CLAUDE.md)'s debug router meanwhile.

**2. `spec/` is the plan, not a description.** It was written before and during the build
and it says what 2.0 *should* do. Where it disagrees with the code, the code won.
`02-structure.md` and `01-schema.md` held up well enough to be the reference; `00-plan.md`
is history.

Documentation that describes the **frozen Next implementation specifically** — its data
layer, its invariants, its Google Drive backup, its Postgres deployment — lives in
[`../v1/docs/`](../v1/docs/data-layer.md) with the code it describes.

## The rule that keeps this cheap

One rule lives in exactly ONE file. `CLAUDE.md` is a router and restates nothing, because
two copies of a rule means one of them is wrong within a month. Held by `check:docs`, not
by good intentions ([ADR 0010](decisions/0010-four-homes-doc-layout.md)).
