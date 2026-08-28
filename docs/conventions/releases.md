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
  **The three shipped skills (`.claude/skills/`) are on that list too.** An agent acts on a
  skill without reading further, so a stale one is worse than no skill: a change to
  installing, claiming, upgrading, the MCP surface or the importers means opening the
  matching `SKILL.md` in the same session.
- **Keep personal and instance values out of this repository entirely** — not just
  credentials, but a host, a unix user, an internal port, a service name or a live domain.
  This repository is the product; a fact about one installation belongs in the private
  `quireink-private` ([ADR 0017](../decisions/0017-move-state-and-instance-config-private.md)).
  Credentials go nowhere but the gitignored `.env`. Where a script must name such a value,
  it takes it from an environment variable and documents the variable, the way
  [`scripts/ops/quire-backup.sh`](../../scripts/ops/quire-backup.sh) does.
- **Audits** are dated snapshots, so they are write-only and they live with the author's
  notes rather than here. Read the latest first so a pass starts from the last clean line.
- **Versioning (owner's rule — do NOT auto-bump):** the version is **`2.2.2`**, released
  2026-08-29 — picture frames with a site-wide default, the gallery finally reflowing, an
  admin audited at seven widths and repaired at all of them, and the metric-matched fallback
  reaching Android after two months of doing nothing there; the frames alone would be a minor
  under the rule below, and the owner took the patch slot again. (`2.2.1`, 2026-08-27 —
  eleven languages, offsite snapshots, the import finishing the move and the
  no-account trio, any one of which the rule below would have called a minor; the owner
  chose the patch slot to keep numbers in reserve, which is this bullet's own rule at work.)
  (`2.2.0`, 2026-08-25, was the largest release since 2.0, and the owner asked for the
  number and for the checking pass that went with it: setup in a browser, the agent's
  reading and stewarding halves, the in-admin assistant, the print sheet, the pen becoming
  the owner's, three keyboards with a volume, JSON-LD, and a documentation sweep that found
  the install guide still teaching a step the software had stopped taking. `2.1.4`,
  2026-08-22, was the audit
  day after the editor day: the update check with its version dot, the site-wide timezone
  setting, the SVG sandbox and the thumb-size pass — features that under the semver rule
  below would have made it `2.2.0`, and the owner called `2.1.4`, which is this bullet's own
  rule at work. `2.1.3` was a day of editor fixes on `2.1.2`; `2.1.2` had withdrawn `2.1.1`,
  whose tag and release were deleted a day after they went out, having shipped book mode
  already broken on current Chrome.) From 2.0 onward the number is **semver and means something**, which is the change
  from the 1.5.x era where `x` was a running counter: MAJOR for a break in how the thing is
  installed or run, MINOR for a feature, PATCH for a fix. **Never bump any of the three on your
  own** — a release is the owner's call, and so is the number. Ship the work, write the
  CHANGELOG entry under an "Unreleased" heading, and ask.
- **Cutting a release** (only when asked): `bun run check:all` and `bun run build` both exit 0
  (there is no binary — [ADR 0022](../decisions/0022-ship-from-source-not-a-compiled-binary.md)); the CHANGELOG entry is written and dated; push `main`; then
  `gh release create v<version> --title "v<version> — <tagline>" --notes-file <file>`.
  The version lives in exactly **four** tracked places — `package.json`, the version chip
  right under the wordmark at the top of **both** READMEs (a line that is just `` `<version>` ``
  — the text title left when the wordmark image arrived, 2026-08-27), and this line — plus
  the CHANGELOG entry heading and each README's release-note paragraph, which is rewritten
  per release anyway.
  It said three and named `# **quire**blog`, from before the rename and before
  `README.vi.md` existed, so the instruction for finding the stale copy was itself a stale
  copy — and this line itself sat at `2.1.0` while the product was on `2.1.2`, which is the
  same failure a third time. `grep -rn '<old>' package.json README.md README.vi.md docs/conventions/releases.md`
  before tagging; a number left behind in a README is the usual miss.
  **Docker docs deliberately do NOT carry a version at all**: every `docker pull` and compose
  example names `:latest`, which the owner made the install tag on 2026-08-21 — the newest
  release is the one carrying the fixes, and 2.1.3 was the argument, since anyone who had
  pinned `:2.1.2` that morning would still be running the white screen. So a release cannot
  leave a stale command behind in four files. The one place a number still appears is the tag
  table in [`docs/dockerhub-overview.md`](../dockerhub-overview.md), which exists to explain
  what an exact pin means, and it names the current release.

- **A GitHub release IS a Docker release. There is no second decision** (owner's rule,
  2026-08-21). Pushing a `v*` tag fires [`publish.yml`](../../.github/workflows/publish.yml),
  which builds `linux/amd64` and `linux/arm64` on native runners, stitches them into one
  manifest, tags it `<major>.<minor>.<patch>` / `<major>.<minor>` / `latest`, publishes to
  GHCR, and copies the finished manifest to Docker Hub as `quireink/quireink`. Creating a
  release through the GitHub UI creates the tag, so it fires too. Nothing to remember and
  nothing to run by hand — but three things are yours to check:
  1. **Read the public record, not the workflow's green tick.** The API returns 200 for
     things it did not do; that has now misled this project twice in one day (a `categories`
     key silently ignored, and a manifest that would have been named `sha256:sha256:…`).
     Ask an unauthenticated client what the world can actually see:
     `curl -s https://hub.docker.com/v2/repositories/quireink/quireink/ | jq '{description, categories}'`
     and pull the tag on a clean machine.
  2. **Both registries must answer the same digest.** One run builds once and copies, so they
     cannot drift — if they ever differ, something published out of band.
  3. **The listing is its own workflow.** [`dockerhub-listing.yml`](../../.github/workflows/dockerhub-listing.yml)
     pushes the short description, [`docs/dockerhub-overview.md`](../dockerhub-overview.md)
     and the category, and it runs when that file changes rather than on a release — a typo
     in prose should not need a version number. Docker Hub resolves no relative link, which
     is why that overview exists instead of pointing at the README.
  Docker Hub needs `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` as repository secrets. Without
  them both workflows skip the Hub and still publish to GHCR: a missing credential must never
  fail a release.
