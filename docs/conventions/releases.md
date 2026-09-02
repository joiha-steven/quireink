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
- **Versioning (owner's rule — do NOT auto-bump):** the version is **`2.2.6`**, released
  2026-09-02 — a fix release from a sweep of every page and admin screen at four widths in
  both colour schemes. The navigation drawer stopped keeping its links in the keyboard tab
  order once it slid shut, the composed front page kept its menu on a narrow screen, the
  "not found" page grew a search box and the newest posts, and two admin screens that
  overran a phone — the dashboard feed by a pixel, Appearance by 52 — were made to fit. It
  also closed an open redirect: the post-sign-in destination refused `//evil.example` but not
  `/<TAB>/evil.example`, a tab the URL parser strips before it reads the address, and now
  refuses any control character, whitespace or backslash. The patch slot a seventh time — the
  a11y work is minors under the rule below, and the owner took the patch slot. (`2.2.5`, released
  2026-09-01 — the day four names left the CDN in front of them, and everything quietly
  relying on it came up for air. Two of those were security defects, both the same shape: a
  header only Cloudflare overwrites, believed on installs that have no Cloudflare. The origin
  learned to compress for itself (brotli, 22% off a cold visit) and to answer a returning
  reader with a 304; every install path that can carry a certificate now does; a wide table
  stopped turning the whole article into a scroll box. The owner asked for `2.2.4.1` first and
  took `2.2.5` when four segments turned out not to be semver — `bun install` swallows it, and
  the MCP registry schema does not. The patch slot a sixth time. (`2.2.4`, released
  2026-09-01 — seventy-five commits in two days: the admin and the reading site both learned
  relief (raised means pressable, carved means held), the assistant got a fourth provider,
  streaming and a desk to work at, ⌘K arrived on the back of a settings index the MCP tools
  also read, the account can be recovered when both keys are gone, four faults that changed
  the published page on save were fixed, and the owner's menu stopped disappearing on three
  of five layouts (#61). The patch slot a fifth time, and by the widest margin yet — several
  of those are minors under the rule below. **It went out once as `2.3.4` by mistake**, twenty
  minutes before the number was corrected: the tag and the GitHub release were deleted and
  the owner removed the `2.3.4` and `2.3` tags from Docker Hub by hand, since a tag pushed by
  `publish.yml` cannot be withdrawn by it. A wrong number is four public places, not one —
  the tag, the release, two registries and any comment already written on an issue.)
  (`2.2.3`, released
  2026-08-30 — the year archive and a feed per archive, offline reading behind a switch that
  is off by default (ADR 0039), one set of table settings for the whole blog, a post's own
  picture with an author and shape knobs, page weight and cache rate in Analytics, a licence
  exception that finally covers the install its own guide teaches (ADR 0038), and a
  repository that no longer quotes its owner; several of those are minors under the rule
  below and the owner took the patch slot a third time. (`2.2.2`, released
  2026-08-29 — picture frames with a site-wide default, the gallery finally reflowing, an
  admin audited at seven widths and repaired at all of them, and the metric-matched fallback
  reaching Android after two months of doing nothing there; the frames alone would be a minor
  under the rule below, and the owner took the patch slot again.) (`2.2.1`, 2026-08-27 —
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
  The version lives in exactly **five** tracked places — `package.json`, the version chip
  right under the wordmark at the top of **both** READMEs (a line that is just `` `<version>` ``
  — the text title left when the wordmark image arrived, 2026-08-27), this line, and
  `server.json`, the manifest the MCP registry publishes from (added 2026-08-30, found two
  releases behind at `2.2.1` because nothing had ever named it) — plus
  the CHANGELOG entry heading and each README's release-note paragraph, which is rewritten
  per release anyway.
  It said three and named `# **quire**blog`, from before the rename and before
  `README.vi.md` existed, so the instruction for finding the stale copy was itself a stale
  copy — and this line itself sat at `2.1.0` while the product was on `2.1.2`, which is the
  same failure a third time. `grep -rn '<old>' package.json README.md README.vi.md docs/conventions/releases.md`
  before tagging; a number left behind in a README is the usual miss.
  **The release-note paragraph says what the version CANNOT do, not only what it can.**
  Owner's instruction, 2026-09-01: a reader deciding whether to install this needs the limits
  stated where they will read them, per version, in the README rather than discovered on
  their own server. The 2.2.x work threw up four of exactly that shape — a NAS and a
  Kubernetes cluster get no Caddy and that is deliberate; a `docker compose up` on a machine
  with an older cached image silently runs the older blog; an install that injects into its
  own HTML with `sub_filter` loses the origin's brotli and its ETag; and an origin with no CDN
  in front costs a reader on the far side of the world a round trip that no amount of saved
  bytes buys back. None of those is a bug and every one of them surprises somebody. A
  paragraph that lists only what was added is an advertisement; the limits are what make it a
  release note.

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
