# 0003. Freeze the Next tree and rewrite as Quire 2.0

Date: 2026-07-26
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

Three problems, none of which the existing tree can fix in place.

1. **Payload.** A post page fetches 182 KB of JavaScript to render ~30 KB of HTML, and
   143 KB of that is React plus the Next App Router. Deleting every island on the site
   would save 39 KB and leave the 143 KB untouched. The cost is structural.
2. **Operations.** One person maintains Node, Next, PostgreSQL, PostgREST, generated JWT
   keys, DB roles and grants, and a migration runner, for a personal blog.
3. **Dependencies.** `next` is pinned hard and carries unpatched critical advisories that
   cannot be resolved without breaking the pin.

## Decision

`src/` accepts security patches only: no features, no refactors, no dependency bumps
beyond CVEs, version pinned. Quire 2.0 is built alongside it at full feature parity and
then replaces it.

## Consequences

- A feature worth adding in the next month is added to 2.0, not to the frozen tree.
- One agreed exception was made for M0 (font subsetting, CSS split, Speculation Rules):
  contained, needed regardless of 2.0's fate, and larger in user-visible effect than the
  entire JavaScript reduction.
- The rewrite must not chase a moving target, which is the failure mode that kills
  rewrites.
- Superseding this means abandoning the rewrite, not adjusting it.
