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
- **Versioning (do NOT auto-bump):** the version is **`2.2.10-beta.1`**, a pre-release cut 2026-09-09 (2.2.9, released 2026-09-07, is still `latest`). From 2.0
  the number is semver and means something (the 1.5.x `x` was a running counter): MAJOR for a
  break in how the thing is installed or run, MINOR for a feature, PATCH for a fix. The owner
  picks the number, and has taken the patch slot for minor-sized work nine releases running;
  that is the rule at work, not an exception to it. **Never bump any of the three on your own**
  — ship the work, write the CHANGELOG entry under an "Unreleased" heading, and ask. History,
  per release, is [CHANGELOG.md](../../CHANGELOG.md). The one lesson kept here: 2.2.4 went out
  as `2.3.4` for twenty minutes, and a wrong number is four public places (the tag, the
  release, two registries) plus every issue comment already written.
- **Cutting a release** (only when asked): `bun run check:all` and `bun run build` both exit 0
  (there is no binary — [ADR 0022](../decisions/0022-ship-from-source-not-a-compiled-binary.md)); the CHANGELOG entry is written and dated; push `main`; then
  `gh release create v<version> --title "v<version> — <tagline>" --notes-file <file>`.
  The version lives in exactly **five** tracked places — `package.json`, the version chip
  right under the wordmark at the top of **both** READMEs (a line that is just `` `<version>` ``
  — the text title left when the wordmark image arrived, 2026-08-27), this line, and
  `server.json`, the manifest the MCP registry publishes from (added 2026-08-30, found two
  releases behind at `2.2.1` because nothing had ever named it) — plus
  the CHANGELOG entry heading and each README's release-note paragraph, which is rewritten
  per release anyway.
  This line has lagged the product three times; `grep -rn '<old>' package.json server.json README.md README.vi.md docs/conventions/releases.md`
  before tagging, and `check:docs` now fails on a stale pin.
  **The release-note paragraph says what the version CANNOT do, not only what it can.**
  Owner's instruction, 2026-09-01: a reader deciding whether to install this needs the limits
  stated where they will read them, per version, in the README rather than discovered on
  their own server. A NAS and a Kubernetes cluster get no Caddy, and that is deliberate: not a
  bug, and it surprises somebody. A paragraph that lists only what was added is an advertisement; the limits are what make it a
  release note.

  **Docker docs deliberately do NOT carry a version at all**: every `docker pull` and compose
  example names `:latest`, the install tag since 2026-08-21 — the newest
  release is the one carrying the fixes, and 2.1.3 was the argument, since anyone who had
  pinned `:2.1.2` that morning would still be running the white screen. So a release cannot
  leave a stale command behind in four files. The one place a number still appears is the tag
  table in [`docs/dockerhub-overview.md`](../dockerhub-overview.md), which exists to explain
  what an exact pin means, and it names the current release.

- **A GitHub release IS a Docker release. There is no second decision** (since
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
