# docs/spec/ — how 2.0 was built

These eight documents were written before and during the rewrite from Next.js + PostgreSQL
to Bun + Hono + SQLite. They are the **plan**: what each part should do, what was rejected,
and why. Where one disagrees with the code, the code won — but the reasoning is still the
best account of why the thing is shaped the way it is, and several of them (`01`, `02`,
`04`, `06`) held up well enough to remain the working reference.

Read [00-plan.md](00-plan.md) before anything else. Read the specific spec before touching
its area.

| | |
|---|---|
| [00-plan.md](00-plan.md) | Why Bun, why a port and not a rewrite, the milestones, the risk register. History now |
| [01-schema.md](01-schema.md) | The SQLite schema and the full Postgres → SQLite mapping. **Reference** |
| [02-structure.md](02-structure.md) | Module layout, request flow, the seven invariants in full. **Reference** |
| [03-golden.md](03-golden.md) | The rendering contract: fixtures, capture, and what a diff means |
| [04-frontend.md](04-frontend.md) | Server-rendered HTML, the island model, the CSS split. **Reference** |
| [05-importer.md](05-importer.md) | Reading a live 1.x instance and verifying what was written |
| [06-auth.md](06-auth.md) | Password + TOTP + recovery codes, sessions, the cookie. **Reference** |
| [07-parity.md](07-parity.md) | What was deliberately NOT carried over, and the argument for each |

These documents are not a tracker. The live list of what remains is kept outside this
repository ([ADR 0017](../decisions/0017-move-state-and-instance-config-private.md)).
