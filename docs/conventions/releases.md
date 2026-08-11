# Docs & releases — keep current

On any behavior change, update the matching doc in the SAME change (Working principle #3):
- **CLAUDE.md** = a router, and nothing else. **`docs/`** = how it works now, one rule in one
  file. **`docs/decisions/`** = why, append-only. **CHANGELOG.md** = one entry per user-facing
  change. **README.md** = setup + features. Direction, dated snapshots and the worklog are
  **not in this repository** ([ADR 0017](../decisions/0017-move-state-and-instance-config-private.md)).
- **README is the canonical install/usage doc — keep it current.** Its **two install paths**
  (1️⃣ do-it-yourself, 2️⃣ hand-to-an-AI-agent) + the **MCP "let an agent write & publish"** section
  + the **env-var table** must be updated in the SAME change whenever setup/deploy/env/auth/MCP/backup
  behavior changes (new/renamed env var, a new owner setup step, a changed redirect URI, etc.).
  Never let the README drift from how the app is actually installed and run.
- **Keep personal and instance values out of this repository entirely** — not just
  credentials, but a host, a unix user, an internal port, a service name or a live domain.
  This repository is the product; a fact about one installation belongs in the private
  `quireink-private` ([ADR 0017](../decisions/0017-move-state-and-instance-config-private.md)).
  Credentials go nowhere but the gitignored `.env`. Where a script must name such a value,
  it takes it from an environment variable and documents the variable, the way
  [`scripts/ops/quire-backup.sh`](../../scripts/ops/quire-backup.sh) does.
- **Audits** are dated snapshots, so they are write-only and they live with the author's
  notes rather than here. Read the latest first so a pass starts from the last clean line.
- **Versioning (owner's rule — do NOT auto-bump):** the version is **`2.0.2`**, released
  2026-08-10. From 2.0 onward the number is **semver and means something**, which is the change
  from the 1.5.x era where `x` was a running counter: MAJOR for a break in how the thing is
  installed or run, MINOR for a feature, PATCH for a fix. **Never bump any of the three on your
  own** — a release is the owner's call, and so is the number. Ship the work, write the
  CHANGELOG entry under an "Unreleased" heading, and ask.
- **Cutting a release** (only when asked): `bun run check:all` and `bun run build` both exit 0
  (there is no binary — [ADR 0022](../decisions/0022-ship-from-source-not-a-compiled-binary.md)); the CHANGELOG entry is written and dated; push `main`; then
  `gh release create v<version> --title "v<version> — <tagline>" --notes-file <file>`.
  The version lives in exactly **four** tracked places — `package.json`, the title line of
  **both** READMEs (`# quire**INK** <version>`), and this line — plus the CHANGELOG entry
  heading. It said three and named `# **quire**blog`, from before the rename and before
  `README.vi.md` existed, so the instruction for finding the stale copy was itself a stale
  copy. `grep -rn '<old>' package.json README.md README.vi.md docs/conventions/releases.md`
  before tagging; a number left behind in a README is the usual miss.
