# 0005. Rewrite in Bun + Hono on SQLite, porting rather than reimplementing

Date: 2026-07-27
Status: accepted · supersedes [0004](0004-rewrite-in-go-on-sqlite.md)
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

[0004](0004-rewrite-in-go-on-sqlite.md) picked Go. Measuring the codebase before starting
changed the answer:

```
src/lib          42 of 65 files never touch the database: ~6,500 lines of pure logic
tests            35 files, 2,427 lines, the only safety net that exists
db() call sites  132 across 28 files
admin            61 of 66 components are already 'use client'
```

The owner does not read code. The dominant risk is therefore not a compiler-catchable bug,
it is a behaviour quietly not surviving the move, and the golden harness only sees public
HTML.

## Decision

Bun + Hono + SQLite, treating the work as a **port, not a rewrite**. Keep `marked`,
`shiki`, `sharp`, `satori`, `nodemailer` and the MCP SDK. Three weeks across four
milestones.

## Consequences

- The pure logic and every test move unchanged. A diff that is pure motion is reviewable.
- Article bodies stay byte-identical, so the golden harness becomes a hard equality gate
  instead of a diff review. That is strictly stronger than 0004 could achieve.
- No parser parity risk, no highlighter downgrade, no OG rebuild, no second markdown engine.
- Enables [0006](0006-admin-stays-react-spa.md), which deletes 0004's largest milestone.
- **Residual risk accepted:** Bun is a runtime from a single venture-funded company. The
  exit is shallow: `bun:sqlite` maps to `node:sqlite`, Hono is runtime-agnostic, and losing
  `bun build --compile` returns the deployment to today's position, no worse.
- The durability question was examined on a ten-year horizon. What rots is the tooling
  layer, not the language, so this plan keeps that layer thin on purpose: no bundler for
  server code, no CSS framework ([0008](0008-hand-written-css-no-tailwind-public.md)), no
  UI framework on the public site, and a portable HTTP layer.
