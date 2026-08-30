# Decisions (ADRs)

Why this exists: the expensive failure in a long project is not bad code, it is reopening
a settled argument because nobody can tell what was decided or whether it still holds.
That already happened here. A fully specified SaaS direction was chosen on 2026-07-16 and
abandoned on 2026-07-26, and the only trace was a private memory file.

## Rules

1. **Append-only.** An ADR is never edited to say something different. A decision that
   changes gets a NEW ADR that supersedes the old one, and the old file stays exactly as
   written. The history is the point.
2. **The index below is the answer to "does this still bind?"** Keep the `In force`
   column current; it is the one part of this directory that is maintained.
3. **One decision per file**, numbered, named for the decision and not the topic.
4. Small is fine. Context, the decision, and what it costs. If it needs 200 lines it is
   probably a spec (`docs/`), not a decision.
5. `check:docs` fails if an ADR is missing from this index, or if the index cites an ADR
   that does not exist.

## Index

| # | Decision | Date | In force |
|:--|:--|:--|:--|
| [0001](0001-self-hosted-native-postgres.md) | Self-host natively on Postgres + PostgREST, drop Vercel and Supabase cloud | 2026-07-04 | ❌ ended at the 2026-07-28 cutover; 1.x only |
| [0002](0002-no-saas-single-instance.md) | Quire is one instance for its author. No SaaS, no multi-tenancy | 2026-07-26 | ⚠️ **its premise has collapsed; only `tenant_id` still binds.** A hosted tier became a goal at [0021](0021-hosted-quire-ink-one-process-per-blog.md), and the rest of its reasoning — *"there are no third-party self-hosters"*, *"nobody depends on it"*, *"parity is judged by the one person who uses the product"* — stopped being true once there were releases, a Docker image, eleven translations and a counted install base. **Do not cite it for "we have no users."** |
| [0003](0003-freeze-v1-rewrite-as-v2.md) | Freeze the Next tree and rewrite as Quire 2.0 | 2026-07-26 | ✅ **discharged** — the rewrite shipped ([0012](0012-flatten-repo-after-cutover.md)) and the tree it froze was removed ([0019](0019-remove-the-frozen-tree-from-the-working-copy.md)). Nothing in it constrains work today |
| [0004](0004-rewrite-in-go-on-sqlite.md) | Rewrite in Go on SQLite | 2026-07-26 | ❌ superseded by 0005 |
| [0005](0005-rewrite-in-bun-hono-sqlite.md) | Rewrite in Bun + Hono on SQLite, porting rather than reimplementing | 2026-07-27 | ✅ |
| [0006](0006-admin-stays-react-spa.md) | Keep the admin as an embedded React SPA | 2026-07-27 | ⚠️ holds, except *"embed it in the executable"*: there is no executable, per [0022](0022-ship-from-source-not-a-compiled-binary.md). The SPA is built and served from disk |
| [0007](0007-self-hosted-password-totp-auth.md) | Replace Google login with password + TOTP + recovery codes | 2026-07-27 | ⚠️ holds, except its flat **mandatory** TOTP: amended by [0030](0030-two-factor-can-wait-until-there-is-an-address.md) — skippable only while the blog has no public address |
| [0008](0008-hand-written-css-no-tailwind-public.md) | Hand-write the public CSS, drop Tailwind from the reader path | 2026-07-27 | ⚠️ the decision holds; its *consequence* does not. *"Small enough to inline, so an article page makes zero blocking stylesheet requests"* was reversed two days later by measurement — the static rules ship as a hashed `site.css` link with only the settings inline after it ([`performance.md`](../performance.md) §CSS), and the pen adds a second sheet ([0027](0027-the-pen-ships-only-where-it-wrote.md)) |
| [0009](0009-pin-optical-size-axis.md) | Pin the `opsz` axis in the bundled variable fonts | 2026-07-27 | ✅ |
| [0010](0010-four-homes-doc-layout.md) | Adopt the four-homes documentation layout | 2026-07-27 | ⚠️ the principle holds, the table does not: its `v2/` row predates the flatten ([0012](0012-flatten-repo-after-cutover.md)) and `state/` left this repository ([0017](0017-move-state-and-instance-config-private.md), which says in as many words that it is 0010's correction). **Four homes are three here** |
| [0011](0011-settings-regrouped-into-seven.md) | Regroup settings into seven defined tabs | 2026-07-28 | ⚠️ **seven is now eight** — an AI tab was added 2026-08-23 without amending this. The rule it set (one question per tab, printed under the tab) holds and the eighth obeys it; extended by [0024](0024-the-admin-is-rebuilt-around-writing.md) |
| [0012](0012-flatten-repo-after-cutover.md) | Flatten the repository after cutover: 2.0 to the root, the Next tree to `v1/` | 2026-07-28 | ⚠️ the flattening holds; the `v1/` half ended at 0019 |
| [0013](0013-google-sign-in-for-commenters.md) | Bring back Google sign-in, for commenters only | 2026-07-29 | ✅ |
| [0014](0014-homepage-modes.md) | A homepage mode: the post list, a chosen page, or a composed front page | 2026-07-31 | ✅ |
| [0015](0015-relicense-polyform-noncommercial.md) | Relicense from MIT to PolyForm Noncommercial 1.0.0 | 2026-07-31 | ⚠️ holds, except its ban on all commercial use: amended by 0023 |
| [0016](0016-rename-to-quire-ink.md) | Rename the product to Quire Ink, on `quireink.com` | 2026-07-31 | ⚠️ holds; the word "binary" in its list of what `quireink` names ended at [0022](0022-ship-from-source-not-a-compiled-binary.md) |
| [0017](0017-move-state-and-instance-config-private.md) | Move `state/` and instance config to a private repository | 2026-08-01 | ⚠️ holds, except its `v1/` bullet: superseded by 0019 |
| [0018](0018-highlighter-pen.md) | A highlighter pen: `==text==`, drawn as ink rather than as a box | 2026-08-03 | ⚠️ holds, except its three-stroke site setting (amended by 0025) and its "the colours are NOT a setting" (amended by 0029) |
| [0019](0019-remove-the-frozen-tree-from-the-working-copy.md) | Remove the frozen 1.x tree from the working copy, keep it at tag `v1-final` | 2026-08-03 | ✅ |
| [0020](0020-mathematics-as-mathml.md) | Mathematics: LaTeX in the source, MathML on the page, and the dollar sign stays money | 2026-08-06 | ✅ |
| [0021](0021-hosted-quire-ink-one-process-per-blog.md) | A hosted Quire Ink, as one process per blog. `tenant_id` stays rejected | 2026-08-11 | ⚠️ the architecture holds; **its headline cost number is wrong.** *"~140 MB per blog"* came from RSS on 2026-08-11 and was replaced on 2026-08-23 by a Pss measurement: **125 MB for a small blog and 226 MB for a large one**, the spread being an unbounded warm `pageCache` rather than the process. The "hundred blogs is ~15 GB" line is built on the retired figure. Re-measure before quoting either |
| [0022](0022-ship-from-source-not-a-compiled-binary.md) | Quire Ink ships as source run by Bun. There is no compiled binary | 2026-08-11 | ✅ |
| [0023](0023-commercial-use-of-unmodified-releases.md) | Commercial use of an unmodified release is allowed. A modified copy sold is not | 2026-08-16 | ⚠️ the grant holds; amended by [0038](0038-the-permission-reaches-the-install-people-actually-run.md) — the exception is v1.1, and §2(a) now turns on the source being unchanged rather than on running a tagged release |
| [0024](0024-the-admin-is-rebuilt-around-writing.md) | The admin is rebuilt around writing; everything else moves out of the way | 2026-08-16 | ✅ |
| [0025](0025-the-pen-varies-itself.md) | The pen varies itself: grown dies, a per-highlight deal, and the stroke setting retires | 2026-08-20 | ✅ |
| [0026](0026-the-pen-learns-to-underline-and-ring.md) | The pen learns two more gestures: `++underline++` and `@@ring@@` | 2026-08-20 | ✅ |
| [0027](0027-the-pen-ships-only-where-it-wrote.md) | The pen's CSS ships in two hashed sheets, linked only on pages that used it | 2026-08-21 | ✅ |
| [0028](0028-a-link-is-a-pen-gesture.md) | A link is underlined by the pen, in dashes, in the pen's own ink | 2026-08-21 | ✅ |
| [0029](0029-the-pen-becomes-the-owners.md) | The pen's colours become the owner's, and the defaults stay measured | 2026-08-24 | ✅ |
| [0030](0030-two-factor-can-wait-until-there-is-an-address.md) | Two-factor can wait, but only until the blog has a public address | 2026-08-25 | ✅ |
| [0031](0031-the-blog-winds-its-own-clock.md) | The process schedules its own ticks; `/api/cron` stays for external schedulers | 2026-08-27 | ✅ |
| [0032](0032-the-comment-gate-needs-no-account.md) | A signed proof-of-work gate on comments by default; Turnstile takes over when its keys are set | 2026-08-27 | ✅ |
| [0033](0033-purging-an-edge-that-is-not-cloudflare.md) | A purge webhook beside the Cloudflare pair, so any CDN can be flushed | 2026-08-27 | ✅ |
| [0034](0034-the-import-finishes-the-move.md) | Imports write the old URLs' 301s and bring remote images home in batches | 2026-08-27 | ✅ |
| [0035](0035-the-snapshot-leaves-the-machine.md) | Snapshots also ship to any S3-compatible bucket; restore stays a shell act | 2026-08-27 | ✅ |
| [0036](0036-the-blog-asks-for-updates-and-is-counted-by-asking.md) | One daily request tells the blog a release exists and counts it, on by default | 2026-08-21 | ✅ recorded 2026-08-29 |
| [0037](0037-an-mcp-token-carries-a-scope.md) | An MCP token is `full` or `read`; the read door registers only `readOnly` tools | 2026-08-29 | ✅ |
| [0038](0038-the-permission-reaches-the-install-people-actually-run.md) | The commercial permission turns on UNCHANGED, not on tagged; the software names itself in a `generator` meta | 2026-08-29 | ✅ amends [0023](0023-commercial-use-of-unmodified-releases.md) |
| [0039](0039-the-blog-reads-without-the-network.md) | A service worker, off by default, that keeps what the reader already read — never a prefetch | 2026-08-30 | ✅ supersedes only the "offline is out of scope" line in `docs/seo-pwa.md`; the prefetch judgement in `docs/performance.md` is untouched |
| [0040](0040-the-assistant-keeps-its-conversations.md) | The assistant's conversations are stored and listed, instead of living in one browser tab | 2026-08-31 | ✅ reverses the "no server-side conversation" behaviour stated in `docs/features/admin.md`; no prior ADR governed it |

## Written after the fact, and why that is allowed

[0036](0036-the-blog-asks-for-updates-and-is-counted-by-asking.md) and
[0037](0037-an-mcp-token-carries-a-scope.md) record decisions already shipped, found missing
by auditing this index against the code on 2026-08-29. Both were fully documented as
BEHAVIOUR — the update check in three places including eleven translations, the token scope in
a schema step and a test — and undocumented as ARGUMENT: why the default is on, why an opt-in
counter would have answered nothing, why an unmarked tool is a write tool. That is exactly the
failure this directory was opened to prevent, and it is one an index can catch only if
somebody reads it against the running program.

Neither invents a reason. Every line is quoted or drawn from the commit that shipped it
(`f1b365e`, `ea1432d`, `ea5c5b8`) and from the documentation already in the tree. **An ADR
written later must cite where its reasoning came from, or it is a reconstruction wearing the
authority of a decision.**

## Superseded, and why that matters

0004 lasted one day. It is kept in full because the measurements in it (the payload table,
the schema mapping, the importer verification tiers) are still the best analysis of those
problems, and because knowing Go was seriously considered and why it lost is cheaper than
re-running the comparison in six months.
