# Audit log + procedure

Comprehensive review records for Quire Ink. Each pass checks the whole project for
tech / security / performance / logic / layout / docs issues, fixes what it finds,
and is written up here as a dated report. This folder is the memory of "what was
checked, when, and the verdict" so a later pass starts from the last clean line.

## When to run

- Before a release (a `0.x.0` feature batch especially).
- After a feature batch lands (e.g. a new subsystem like theming or PWA).
- On request ("audit the project").
- Not needed for a one-line fix — a normal `CHECKLIST.md` pass covers that.

## Procedure (run every section, in order)

Work top to bottom. For each finding: fix it in the same pass when safe, or record
it as a follow-up if it needs a decision. Nothing is "noted and skipped" silently.

### 0. Baseline — must be green before reviewing anything
- [ ] **`npm run check:all` exits 0** — the one-command baseline. Bundles `tsc --noEmit` (also
      proves all 6 locales key-complete via `satisfies`) + `npm run lint` + the codified invariant
      checks (`check:routes`/`check:filesize`/`check:no-any`, see §1/§4) + the `npm test` seam net.
- [ ] `npm run build` exits 0; `/` and `/[slug]` are `○`/`●` (ISR), admin is `ƒ` (dynamic)
      (kept separate from `check:all` — build is slow + not needed offline)
- [ ] (live, optional) `npm run check:consistency:live` — media/files ⇄ Blob integrity (§2);
      skips cleanly without `.env.local` creds

### 1. Security
- [ ] EVERY write/delete (and owner-only read) API route calls `requireOwner()` first.
      **Codified: `npm run check:routes`** (allowlist mirrors `middleware.ts isPublicApi()`).
      Reference grep: `grep -L requireOwner src/app/api/**/route.ts`.
- [ ] `/admin` guarded server-side (admin layout `getAuthState` → redirect)
- [ ] Every `dangerouslySetInnerHTML` source is safe: markdown raw HTML is escaped;
      palette colors are hex-validated; `customCss` strips `</style`; JSON-LD escapes `<`
- [ ] Injection points are constrained: video/OG/embed URLs whitelisted + length-capped;
      RSS/feed output escaped; sitemap uses `encodeURIComponent`; CSS selector ids are
      preset constants, not user strings
- [ ] Tokens/uploads: preview token compares with `timingSafeEqual`; uploads validate
      content type (+ `kind`) against a whitelist; no path traversal in stored names

### 2. Logic / correctness
- [ ] Cache invalidation in `revalidate.ts` is a SUPERSET of affected surfaces (never under-purges)
      (**codified: `revalidate.test.ts`** in `npm test`)
- [ ] media/files rows ⇄ Blob store stay consistent (**codified: `npm run check:consistency:live`** —
      manifest→blob missing + blob→manifest orphan, both directions, incl. trashed rows + settings refs)
- [ ] No data-loss paths (e.g. an audit/cleanup that ignores `revisions/` snapshots)
- [ ] Slug namespace shared by posts + pages is enforced (`ensureSlugFree`) (**codified: `slugs.test.ts`**)
- [ ] Every live read filters `.is('deleted_at', null)` — trashed content never leaks
      (**codified: `soft-delete.test.ts`**, listing/public/search/single)
- [ ] Asymmetric cache-bust: `backup_state` writes bust `db`, MCP token routes do NOT
      (**codified: `npm run check:token-bust`**)
- [ ] Drafts + future-dated posts hidden from every public surface

### 3. Performance
- [ ] Per-render / per-request reads are acceptable at scale (low hundreds of posts);
      `O(all blobs)` calls (`listBlobs`) are intentional and documented
- [ ] No accidental `force-dynamic` on a public page (would kill ISR); admin stays dynamic

### 4. Code quality
- [ ] No file > 400 lines (**codified: `npm run check:filesize`**;
      reference: `find src -name '*.ts*' | xargs wc -l | sort -rn | head`)
- [ ] No `any` (only in comments), no stray `console.log`/`TODO`/`FIXME`, no `@ts-ignore`
      (**codified: `npm run check:no-any`**; sanctioned console.log → `// check:allow-console`)

### 5. Layout / visual (owner is very sensitive here)
- [ ] Sibling controls share ONE class constant — never hand-rolled duplicates:
      admin bar = `ADMIN_NAV` (`headerActions.ts`); public icon buttons = `ICON_BTN`
      (`ui/iconButton.ts`). Grep for the literal class string to catch new copies
- [ ] Header rows align on one line: every item (incl. the wordmark) is `h-9`/`h-10`
      `items-center`; never `items-baseline`
- [ ] Public reading UI uses theme tokens only (`bg-bg`/`text-text`/`text-meta`/
      `border-rule`…), never hardcoded `neutral-*`/hex/`white`/`black`
- [ ] One divider style (global 50% `<hr>`); no bespoke `border-t` dividers; no `uppercase`

### 6. i18n
- [ ] All 6 locales (en/vi/de/ja/zh/ko) define every key — enforced by `satisfies` (step 0
      tsc covers it); on any UI-string change, all locales + `types.ts` were updated together

### 7. Docs in sync (same change keeps them current)
- [ ] `CLAUDE.md`, `ARCHITECTURE.md`, `README.md`, `CHANGELOG.md`, `CHECKLIST.md` all match
      the code shipped this pass (data layer table, data model, feature list, conventions)
- [ ] No personal/instance data (real creds, store IDs, live domain) in any tracked file

## Recording a pass

Write `audit/YYYY-MM-DD-<scope>.md` (scope e.g. `comprehensive`, `security`, `layout`).
Include: version audited, scope, per-section findings, what was fixed vs. deferred, the
final verdict, and the baseline command results. Keep it terse and factual.
