# 0001. Self-host natively on Postgres + PostgREST

Date: 2026-07-04
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

Quire started on Vercel with Supabase cloud. Both were free-tier conveniences that turned
into constraints: the data layer was reachable only over the network, the deploy target
was not the owner's machine, and the "self-hosted blog" the product claimed to be could
not actually be self-hosted without an account somewhere.

## Decision

Run the whole stack on one Ubuntu box: PostgreSQL, PostgREST, Next via systemd, files on
the local filesystem. Keep Docker as a secondary packaging, not the primary path.

## Consequences

- Every cloud flavour was removed from the tree, not left as an option.
- `@supabase/supabase-js` gave way to `@supabase/postgrest-js`, the query builder it wraps,
  so `db()` kept its `.from()` / `.rpc()` surface and 155 call sites did not move.
- Env renamed: `SUPABASE_URL` to `POSTGREST_URL`, `SUPABASE_SERVICE_ROLE_KEY` to
  `POSTGREST_TOKEN`, `POSTGREST_DIRECT` dropped entirely.
- The box now needs a migration runner, generated JWT keys, and DB roles and grants. That
  operational weight is one of the three reasons for [0003](0003-freeze-v1-rewrite-as-v2.md).
