# 0006. Keep the admin as an embedded React SPA

Date: 2026-07-27
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

`04-frontend.md` had already established that admin payload is irrelevant: only the owner
loads it, so it is off the SEO and reader critical path entirely. Meanwhile
**61 of 66 admin components are already `'use client'`** — the admin is a React SPA that
happens to be wrapped in Next.

[0004](0004-rewrite-in-go-on-sqlite.md) planned to port all of it, including Tiptap to
vanilla ProseMirror. That milestone carried the rewrite's largest risk concentration:
Vietnamese IME with Telex, autosave, crash recovery, conflict detection, and custom node
views, all of it code the owner uses daily to write.

## Decision

Do not port the admin. Build it as a static SPA with Bun's bundler, embed it in the
executable, serve it from Hono, and let it talk to the same JSON API it talks to today.

## Consequences

- The entire M2 of the Go plan disappears. No Tiptap port, no node-view rewrites, no IME
  regression risk.
- ~8,578 lines pass through nearly unchanged, and the de-Next work is about 65 mechanical
  import-site edits.
- **Cost accepted:** React idiom has a high ten-year mortality, so this code will need
  rewriting eventually. That is the right trade, because the cost of rewriting it later is
  falling faster than the risk of keeping it is rising.
- Tailwind stays for the admin, where its churn is contained behind a build only the owner
  loads. See [0008](0008-hand-written-css-no-tailwind-public.md) for the public side.
- The admin remains the area with no automated parity coverage, which is why the M3 gate
  requires a scripted headless tour of at least 30 flows and why `v2/docs/07-parity.md`
  exists.
