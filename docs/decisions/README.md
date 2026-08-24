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
| [0002](0002-no-saas-single-instance.md) | Quire is one instance for its author. No SaaS, no multi-tenancy | 2026-07-26 | ⚠️ partly superseded by [0021](0021-hosted-quire-ink-one-process-per-blog.md) — a hosted tier is now a goal. Its rejection of `tenant_id` still binds |
| [0003](0003-freeze-v1-rewrite-as-v2.md) | Freeze the Next tree and rewrite as Quire 2.0 | 2026-07-26 | ✅ |
| [0004](0004-rewrite-in-go-on-sqlite.md) | Rewrite in Go on SQLite | 2026-07-26 | ❌ superseded by 0005 |
| [0005](0005-rewrite-in-bun-hono-sqlite.md) | Rewrite in Bun + Hono on SQLite, porting rather than reimplementing | 2026-07-27 | ✅ |
| [0006](0006-admin-stays-react-spa.md) | Keep the admin as an embedded React SPA | 2026-07-27 | ✅ |
| [0007](0007-self-hosted-password-totp-auth.md) | Replace Google login with password + TOTP + recovery codes | 2026-07-27 | ✅ |
| [0008](0008-hand-written-css-no-tailwind-public.md) | Hand-write the public CSS, drop Tailwind from the reader path | 2026-07-27 | ✅ |
| [0009](0009-pin-optical-size-axis.md) | Pin the `opsz` axis in the bundled variable fonts | 2026-07-27 | ✅ |
| [0010](0010-four-homes-doc-layout.md) | Adopt the four-homes documentation layout | 2026-07-27 | ✅ |
| [0011](0011-settings-regrouped-into-seven.md) | Regroup settings into seven defined tabs | 2026-07-28 | ✅ |
| [0012](0012-flatten-repo-after-cutover.md) | Flatten the repository after cutover: 2.0 to the root, the Next tree to `v1/` | 2026-07-28 | ⚠️ the flattening holds; the `v1/` half ended at 0019 |
| [0013](0013-google-sign-in-for-commenters.md) | Bring back Google sign-in, for commenters only | 2026-07-29 | ✅ |
| [0014](0014-homepage-modes.md) | A homepage mode: the post list, a chosen page, or a composed front page | 2026-07-31 | ✅ |
| [0015](0015-relicense-polyform-noncommercial.md) | Relicense from MIT to PolyForm Noncommercial 1.0.0 | 2026-07-31 | ⚠️ holds, except its ban on all commercial use: amended by 0023 |
| [0016](0016-rename-to-quire-ink.md) | Rename the product to Quire Ink, on `quireink.com` | 2026-07-31 | ✅ |
| [0017](0017-move-state-and-instance-config-private.md) | Move `state/` and instance config to a private repository | 2026-08-01 | ⚠️ holds, except its `v1/` bullet: superseded by 0019 |
| [0018](0018-highlighter-pen.md) | A highlighter pen: `==text==`, drawn as ink rather than as a box | 2026-08-03 | ⚠️ holds, except its three-stroke site setting (amended by 0025) and its "the colours are NOT a setting" (amended by 0029) |
| [0019](0019-remove-the-frozen-tree-from-the-working-copy.md) | Remove the frozen 1.x tree from the working copy, keep it at tag `v1-final` | 2026-08-03 | ✅ |
| [0020](0020-mathematics-as-mathml.md) | Mathematics: LaTeX in the source, MathML on the page, and the dollar sign stays money | 2026-08-06 | ✅ |
| [0021](0021-hosted-quire-ink-one-process-per-blog.md) | A hosted Quire Ink, as one process per blog. `tenant_id` stays rejected | 2026-08-11 | ✅ |
| [0022](0022-ship-from-source-not-a-compiled-binary.md) | Quire Ink ships as source run by Bun. There is no compiled binary | 2026-08-11 | ✅ |
| [0023](0023-commercial-use-of-unmodified-releases.md) | Commercial use of an unmodified release is allowed. A modified copy sold is not | 2026-08-16 | ✅ |
| [0024](0024-the-admin-is-rebuilt-around-writing.md) | The admin is rebuilt around writing; everything else moves out of the way | 2026-08-16 | ✅ |
| [0025](0025-the-pen-varies-itself.md) | The pen varies itself: grown dies, a per-highlight deal, and the stroke setting retires | 2026-08-20 | ✅ |
| [0026](0026-the-pen-learns-to-underline-and-ring.md) | The pen learns two more gestures: `++underline++` and `@@ring@@` | 2026-08-20 | ✅ |
| [0027](0027-the-pen-ships-only-where-it-wrote.md) | The pen's CSS ships in two hashed sheets, linked only on pages that used it | 2026-08-21 | ✅ |
| [0028](0028-a-link-is-a-pen-gesture.md) | A link is underlined by the pen, in dashes, in the pen's own ink | 2026-08-21 | ✅ |
| [0029](0029-the-pen-becomes-the-owners.md) | The pen's colours become the owner's, and the defaults stay measured | 2026-08-24 | ✅ |

## Superseded, and why that matters

0004 lasted one day. It is kept in full because the measurements in it (the payload table,
the schema mapping, the importer verification tiers) are still the best analysis of those
problems, and because knowing Go was seriously considered and why it lost is cheaper than
re-running the comparison in six months.
