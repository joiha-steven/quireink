# 0022. Quire Ink ships as source run by Bun. There is no compiled binary

Date: 2026-08-11 · Status: **in force**

## Context

[ADR 0005](0005-rewrite-in-bun-hono-sqlite.md) chose Bun over Go partly on the strength of
`bun build --compile`, and said so in as many words: it *"returns the deployment to today's
position, no worse."* [ADR 0004](0004-rewrite-in-go-on-sqlite.md), the one it superseded, had
listed "a single binary" among Go's reasons.

That premise was never checked against `sharp`, which arrived as a dependency for image
variants and the OG card. It has been the last open question of the rewrite since 2026-07-27
(`state/OPEN_QUESTIONS.md`), recorded as "the binary throws on the first image call", with two
options: ship `node_modules/@img/*` beside the binary, or run from source.

Both options were measured on 2026-08-11, and both answers were worse than the note:

- **The binary does not throw on the first image call. It does not boot.** `sharp` is reached
  during module load on the boot path, so the process dies before it listens: a request to `/`
  is a connection refused, not an error page. `error: Could not load the "sharp" module using
  the darwin-arm64 runtime`.
- **Putting `@img/*` in a `node_modules` beside the binary does not fix it.** Tried, with the
  real platform packages copied next to the executable: same failure. `sharp` resolves from the
  bundle's own path, `/$bunfs/root/quireink`, which has no sibling directory for node resolution
  to walk. So "one executable plus a native module directory" is not an available shape — the
  first option on the ledger does not exist.

Meanwhile every real deployment already runs from source. All four live instances do
(`ExecStart=… bun src/index.ts`), the Docker image does and says so in a comment at its top, and
`docs/self-host.md` has carried **"Do not deploy it yet"** beside the build command since July.

## Decision

**Quire Ink ships as a source checkout run by Bun.** `bun src/index.ts`, which is what
`README.md` has always shown as the whole of "deploy this".

`bun run build` no longer produces an executable. It builds the two artefacts that are actually
shipped and that a deploy needs — the reader's asset bundles and the admin SPA — so CI keeps
proving that what gets deployed can be built, instead of proving that an unusable artefact
compiles.

## Consequences

- **A promise made in ADR 0005 is withdrawn, not quietly dropped.** "One binary" is not
  available while `sharp` is a dependency, and no amount of packaging fixes it from outside the
  bundle. Anyone revisiting the Go-versus-Bun reasoning should read this beside it.
- **Nothing changes about how anything is deployed**, which is the point: this ADR removes a
  build target and a paragraph of "yet", not a capability. `deploy.sh` never shipped the binary.
- **CI stops giving false confidence.** `bun run build` exited 0 while producing something that
  could not start, and a green check on an artefact nobody may deploy is worse than no check.
- **The 71 MB `dist/quireink` and the 59 MB `.bun-build` scratch file stop being produced.** Both
  were gitignored, so this is disk on a developer's machine rather than anything shipped.
- **If a single binary ever matters again**, the route is dropping `sharp` for something with no
  native module, not repackaging around it — and that is a much larger decision, because `sharp`
  is what makes every uploaded image into its responsive variants.
- The last open question from the 2.0 rewrite is closed. `state/OPEN_QUESTIONS.md` has none left.
