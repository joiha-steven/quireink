# History — why the rules in CLAUDE.md exist

Not loaded automatically; `CLAUDE.md` points here. Read it when a rule looks arbitrary. Moved out of
`CLAUDE.md` unchanged in wording; no personal data.

## Verify

`check:all` proves the code compiles and the seams hold. It cannot tell you a column
collapsed to `reader@e…` or that three columns are 14px out of alignment. Both shipped,
because nobody opened the page. **CI runs the tour on every push**, so a change to
anything rendered goes red there if it was pushed on `check:all` alone (2026-09-11, twice).

The tour proves the backup BUILDS; `scripts/restore-check.ts` restores it with
`scripts/restore.ts`'s code — every table hashing back to the manifest, `integrity_check` on both
rebuilt databases, no table with fewer rows than before the snapshot (caches aside), every upload
byte-identical. A backup nobody has restored is not a backup.

A tour on a busy port tours the wrong instance and fails every admin flow, which is why it refuses to
start when port 3399 is taken.

## Golden corpus

`golden/v1/corpus/` holds what 1.x actually printed, from a renderer that no longer exists, so
overwriting it does not update the reference — it destroys it, and the gate then reports parity against
our own output.

## Retired tree

The retired Next.js implementation was removed from the working copy
([ADR 0019](./docs/decisions/0019-remove-the-frozen-tree-from-the-working-copy.md)) and is preserved at
tag `v1-final`.
