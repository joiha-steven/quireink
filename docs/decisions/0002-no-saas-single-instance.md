# 0002. Quire is one instance for its author. No SaaS, no multi-tenancy

Date: 2026-07-26
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

Between 2026-06-26 and 2026-07-16 a complete SaaS direction was specified: quireblog.com,
open-core with a private control plane, shared-stack multi-tenancy on `tenant_id`,
Cloudflare for SaaS, annual pricing, a seam spec, and a phased plan waiting on a domain
purchase. Nothing was built.

The premise never held. There are no third-party self-hosters. The repository is public
but nobody depends on it, and every technical decision was being asked to carry
multi-tenancy for customers who did not exist.

## Decision

Quire runs exactly one instance, `manhhung.me`, used by its author. SaaS is not a goal.
Nothing is designed for multi-tenancy and the schema is not shaped around it.

## Consequences

- No deprecation windows, no migration guides for others, no compatibility promise. A
  cutover is a private operation.
- Parity is judged by the one person who uses the product. "Does this bother me" is a
  sufficient test.
- Anything built purely to be a good open-source citizen is out of scope.
- This is what makes one SQLite file viable in [0004](0004-rewrite-in-go-on-sqlite.md) and
  [0005](0005-rewrite-in-bun-hono-sqlite.md). Without it, Postgres would have to stay.
- If this ever reverses, "one SQLite file per tenant" is the direction to take. Do not
  build for it now.
