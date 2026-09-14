# 0004. Rewrite in Go on SQLite

Date: 2026-07-26
Status: superseded by [0005](0005-rewrite-in-bun-hono-sqlite.md) on 2026-07-27
In force: see the [index](README.md). The index is maintained; this file is not.

> Kept in full, per the append-only rule. No Go code was ever written. The specs it
> produced were salvaged into `docs/spec/` (schema and importer moved nearly unchanged,
> golden and frontend rewritten) and the originals were deleted on 2026-07-29. This ADR
> and [0005](0005-rewrite-in-bun-hono-sqlite.md) are now the whole record.

## Context

Given [0003](0003-freeze-v1-rewrite-as-v2.md), the rewrite needed a target. Go was chosen
for a large training corpus (this codebase is AI-written, so corpus size is a real input),
fast builds, and a single binary.

## Decision

Go 1.24 with `mattn/go-sqlite3`, `sqlc` for queries, `templ` for templates, `goldmark` for
markdown, `chroma` for highlighting, libvips via cgo for images, Tiptap ported to vanilla
for the editor, litestream to R2 for backup. Eight to nine weeks across five milestones.

## Why it was superseded

Four reasons, in order of weight. Full argument in
[0005](0005-rewrite-in-bun-hono-sqlite.md).

1. It would have **translated** ~6,500 lines of pure logic and 2,427 lines of tests that a
   TypeScript target simply **moves**. Translation is where behaviour goes missing.
2. Eight to nine weeks against a risk register that rated "stalls before M1" as High.
3. It bought four avoidable quality regressions: parser parity, a weaker highlighter, an
   OG renderer rebuilt for Vietnamese diacritics, and a permanent second markdown engine
   in the newsletter and editor paths.
4. Its durability advantage was smaller than it looked, because it depended on `templ` and
   `sqlc`, two third-party code generators.

## What it got right, and still stands

The SQLite schema mapping and the importer verification design were the most expensive
thinking in this ADR and moved to `docs/spec/` nearly unchanged. So did the payload
measurement and the island-by-island frontend table.
