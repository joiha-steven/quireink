# Tasks

In order. A task leaves this file when it is done and lands in `WORKLOG.md`.

## Now

- [ ] **A setting for the autosave interval, and a way to SEE the autosave.** Asked for
      2026-07-30, default 2 minutes. The feature is not missing (1.x was local-only too, and
      says so in its own comment; 2.0 snapshots every 8 seconds and now also on hide) but it is
      invisible and its interval is a constant. Two parts, and the second is the one to think
      about:
      1. `AUTOSAVE_MS` in `admin/components/useLocalDraft.ts` becomes a setting. The chain is
         `types.ts` → `content/settings.ts` default + sanitizer (`clampNumber`) →
         `AdvancedFields.tsx` (which already owns the editor's motion toggles) → the six admin
         locale files → `web/admin/views.ts`, which already passes `contentWidth` and
         `typewriterEffects` into both editors. A LOWER bound matters: at a 2-minute interval
         the hide-flush is what keeps work safe, so do not remove it.
      2. The status bar says `saving` / `savedAt` / `unsaved`, and never says the work is held
         locally, which is why the feature reads as absent. Give it a "kept locally at HH:MM"
         state.
      Do NOT turn this into a server autosave without deciding it deliberately: the header of
      `useLocalDraft.ts` rejects one on the grounds that it cannot help when the network is what
      dropped, and that on an already-published post it would push half-finished edits live.
      That reasoning still holds.
- [ ] **Consolidate the remaining HTML escapers.** The hazard this task was written for has
      already fired once and is fixed: `search-page.ts` reflected the query into `value="…"`
      through a three-replacement escaper and produced a live event handler
      (2026-07-30, see `WORKLOG.md`). `search-page.ts` and `preview.ts` now import the
      canonical pair from `utils.ts`; **the other ten files still declare their own**
      (`web/app.ts`, `article.ts`, `chrome.ts`, `layout.ts`, `listing.ts`, `login-page.ts`,
      `post-info.ts`, `sidebar.ts`, `admin/news.ts`, `render/post-content.ts`), and each of
      those uses its local `escapeAttr` correctly for attributes today — verified by grepping
      every attribute interpolation. So what is left is tidying, not a hole: import the
      canonical pair everywhere so the weak variant cannot be reached for again.
      `post-content.ts` is inside the golden's blast radius, so run the golden compare; the
      strong escaper also escapes `'`, so a title or alt text with an apostrophe WILL move the
      output. Decide that deliberately rather than re-baselining on autopilot.
- [ ] **Fix the two links in the live admin's Help screen.**
      `admin/components/HelpSections.tsx` builds GitHub URLs for `docs/self-host-native.md`
      and `CHECKLIST.md`; both moved under `v1/` in the flatten and both 404 today. This is
      the only drift from that reshuffle a USER hits.
- [ ] **The dead-code sweep**, from the 2026-07-30 audit: `comments/comment-tree.ts` is dead
      (only its own test imports it, and `docs/features.md` still documents it as live); five
      dead exports (`analytics/buffer.ts analyticsBufferLimits`, `auth/users.ts updateProfile`,
      `content/themes.ts enabledPaletteOptions`, `store/db.ts toDate`,
      `admin/components/kit.tsx SettingGroup`); four orphaned routes in `web/uploads.ts`
      (`POST /api/media/register`, `POST /api/files/register`, `GET /api/media/debug`,
      `DELETE /api/files/by`) left from a removed direct-to-storage upload flow; and
      `@tiptap/extension-link` + `@tiptap/extension-underline`, neither imported directly.
      Prove each one unreachable before deleting it, and never touch `.well-known/*`,
      `/api/mcp/*`, `/api/cron` or `/api/newsletter/open`, which are external contracts.
- [ ] **Reconcile `docs/backups.md` with `docs/self-host.md`.** They describe two different
      deployments: service `quire2` and `/var/lib/quire2` against `quire` and `/var/lib/quire`.
      Follow both and the backup script points at a directory that does not exist and
      `systemctl stop quire2` stops nothing. Also `backups.md` still says `.env` holds the
      session secret and the SMTP password; in 2.0 the signing secret is generated into the
      database (`auth/secret.ts`) and SMTP lives in the admin.
- [ ] **Take the instance data back out of `scripts/ops/`.** This repository is PUBLIC and
      its own rule is that no live domain, box path or bucket appears in a tracked file.
      `quire2-backup.sh` and the two nginx vhosts were committed with all three. Make them
      templates that read their instance values from an env file, install the templated
      version on the box, and verify by running it — the repository copy and the installed
      copy have to stay the same file. One of the three is also a live bug:
      `quire2-backup.sh` defines `ALERT_ALIAS` to keep the host alias out of the repository
      and then never reads it, so the literal alias shipped in the alert payload anyway.
      Note the worklog is a more complete map of the box than `scripts/ops/` is (user, ports,
      firewall rule, cert scope), and it is append-only, so decide on both together.
- [ ] **The 30-flow headless tour** the M3 gate asked for. Every admin page has been opened
      in a real browser and checked by eye, and the archive, the MCP handshake and each view
      endpoint have tests — but the scripted tour that drives thirty flows end to end does
      not exist yet.
- [ ] **Refresh the file citations in `docs/`.** `features.md`, `conventions.md`,
      `performance.md`, `seo-pwa.md`, `agent-ready.md` and `mcp.md` state current rules but
      cite `v1/src/…` paths, because they were written against the frozen tree and carried
      over ([ADR 0012](../docs/decisions/0012-flatten-repo-after-cutover.md)). Repoint each
      citation at the 2.0 module. Mechanical, but it needs the code open beside it, and it
      pairs naturally with the `features.md` split below.
- [ ] **The motion tokens `--dur-fast/base/slow` + `--ease` do not exist in 2.0**, and
      `docs/conventions.md` states using them as a hard rule. Every duration in
      `islands.css.ts` is a literal. Introduce the tokens or delete the rule; the ONE
      motion switch (`data-motion`) is real either way.
- [ ] **Decide how the binary ships, now that `sharp` is a dependency.** Measured
      2026-07-27: `bun build --compile` bundles sharp's JavaScript but NOT its
      `@img/sharp-<platform>` native module, so the compiled binary throws on the first
      image call from any working directory. Options: ship `node_modules/@img/*` beside the
      binary, or run from source with `bun src/index.ts` (which is what staging does).
      Needed by M4, not before.

## Next

- [ ] **Tighten `tsconfig.json` after the port finishes.** It currently matches the
      frozen tree exactly (`strict`, nothing beyond it). `noUncheckedIndexedAccess` was
      tried during M1 and reverted: mid-port it turns a pure-motion diff into a
      motion-plus-rewrite diff across every moved file, which is what the porting rule
      exists to prevent. Turn it on as one reviewable pass once nothing is left to move.

## Public design: the gaps left on purpose

The design was ported and measured against v1 on 2026-07-28 (see `WORKLOG.md`), and the
owner called it good enough to move on from. These are what is knowingly still off, so
nobody has to rediscover them by eye:

- [ ] **The search page is a different surface.** v1 runs a client component that filters
      an in-memory index as you type; 2.0 server-renders FTS5 results with a heading and a
      result count. Both work, neither looks like the other.
- [ ] **Numbered pagination is prev/next only.** A deliberate simplification, already on
      the ledger — but on this blog `features.infiniteScroll` is on, so no pager renders
      at all and it is invisible either way.
- [ ] **`.card-thumb` (grid-view thumbnails) is not ported.** Grid view is off on this
      blog, so the markup is never reachable; it becomes real work only if the owner turns
      `features.gridView` on.
- [ ] **The palette switcher island is not ported.** `enabledPalettes` has one entry, so
      the control is hidden. Porting it is pointless until a second palette is enabled.
- [ ] **Dark mode shows one light frame** before the island applies the saved choice. 2.0
      has no inline script anywhere and that property is TESTED; the frozen tree used a
      pre-paint inline script. A cookie would let the server render it, but the page cache
      is keyed by URL alone (Invariant 1), so a cached page would carry whichever mode the
      first visitor happened to have.
- [ ] **A static page's body sits 8px lower** than v1 (`mt-10` applied where v1 uses
      `mt-8`). One line of CSS; not worth a deploy on its own.
- [ ] **Book mode paginates to 7 spreads where v1 makes 6.** The spread geometry matches
      to 6px; the difference is leading inside the columns.
- [ ] **An extra rule sits between the taxonomy and the related posts.**
- [ ] Sub-pixel wrap differences in the rail and the tag cloud, from a 1px rail width.

## Deferred, with a reason

- [ ] **Split `docs/features.md` (606 lines) into one spec per module** under `docs/features/`.
      Required by [ADR 0010](../docs/decisions/0010-four-homes-doc-layout.md) and not done
      with it: it is a mechanical 600-line split across ~20 areas with real risk of dropping
      content, and roughly 30 cross-references (including the `CLAUDE.md` DEBUG ROUTER)
      point into it. It deserves a focused pass with a content-accounting check, not the
      tail end of a long session.
- [ ] **Server-render the analytics charts as SVG.** `AnalyticsView` + `AnalyticsPageDetail`
      are ~13 KB of React producing charts that server-rendered SVG would produce with no
      client JavaScript and less code. Highest-value cleanup left in the admin, but out of
      scope for v2.0 parity.
- [ ] **Passkeys / WebAuthn** as a fast path beside password + TOTP
      ([ADR 0007](../docs/decisions/0007-self-hosted-password-totp-auth.md)).

## Verify before trusting

- [ ] **Re-measure the 182 KB JavaScript figure** in `docs/spec/00-plan.md`. It came from the
      Go documents, was measured once, and the font figure beside it needed correcting.

## Done

- [x] **The inlined stylesheet, decided and split. DONE 2026-07-29.** 42.6 KB of the 48.7 KB
      assembled per page was byte-identical everywhere. The static half is now
      `/assets/site.‹hash›.css`, `immutable`; the settings half stays inline after it.
      HTML per post 65.0 → 25.4 KB. See `state/audits/2026-07-29-typography-security-perf.md`.
- [x] **`--font-mono` defined. DONE 2026-07-29.** JetBrains Mono, self-hosted, for both
      inline and fenced code. The owner chose a real mono over dropping the reference.

- [x] **M4 — cutover. DONE 2026-07-28.** `manhhung.me` serves Quire 2.0; the frozen tree
      moved to `old.manhhung.me` with `noindex`. No reimport was needed (both sides matched
      to the millisecond). Off-box backup to R2 installed and verified by restoring it;
      `cache-control` sent for the first time; all sessions revoked. The repository was
      flattened the same day ([ADR 0012](../docs/decisions/0012-flatten-repo-after-cutover.md)).
- [x] **M3 — admin, API and the rest. DONE 2026-07-28.** The admin SPA (68 components, 12
      pages, its own router and view API), the MCP Streamable HTTP transport, the manual
      export archive, Turnstile, and the API envelope the whole admin is written against.
      Settings regrouped into seven defined tabs at the owner's request
      ([ADR 0011](../docs/decisions/0011-settings-regrouped-into-seven.md)). 907 tests.
- [x] **M1 — foundations and data layer.** Done 2026-07-27. SQLite schema; ~6,500 lines of
      pure logic and its tests moved unchanged; every `db()` call site on `bun:sqlite`; all
      six plpgsql functions reimplemented; `import-v1` with its four verification tiers.
- [x] **Run `import-v1` end to end against a live v1.** Done 2026-07-28. 74 posts, 4 pages,
      68 media, 246 term rows, 481 activity rows, 504 analytics events. All four tiers pass.
      **It found two real bugs that 51 unit tests could not**, both the same root cause in
      two different normalisers: a `jsonb` column arrives PARSED from PostgREST and is held
      as TEXT in SQLite, and neither `verify.ts` nor `checksum.ts` reconciled the two.
- [x] **M2 — public renderer.** Done 2026-07-27, and **re-done properly 2026-07-28** after
      the owner saw it: the first pass reproduced the theme tokens exactly and the LAYOUT
      not at all. See `WORKLOG.md` for what was actually wrong, which was mostly not the
      missing sidebar.
- [x] **Staging.** `next.manhhung.me`, own user, own port, own data dir, beside the live v1.
