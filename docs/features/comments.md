# Comments

## Comments — `src/comments/`, `src/web/comments.ts`, `src/assets/js/comments.ts`

Text-only reader comments, **off by default** (`settings.comments.enabled`). Identity is either
manual (name + email + optional website, optionally behind Cloudflare Turnstile) or a signed-in
Google account.

- **The form is a card, on the same terms as the newsletter block above it** (border, radius and
  padding all match `.subscribe-card`). Until 2026-07-31 it was the one thing on a post with no
  boundary at all: a Google button, three fields, a textarea, a Turnstile widget and a submit,
  each floating separately on the page background, which is what made the section read as pasted
  in from somewhere else. Name and email now share a two-column grid (they were each spanning the
  full reading width, so a three-field form looked like a column of wide empty boxes), the
  textarea has a VISIBLE label rather than only an `aria-label`, and the Turnstile widget shares
  one row with the submit. Everything collapses to a single column below 640px. A reply form
  opens inside the thread and drops the border, because a card inside a card boxes a box.

- **A comment body is set at the ARTICLE's size**, not the thread's. It already used the
  reading face; running it at `--fs-small` like the rest of `#comments` meant the same
  typeface as the piece two steps smaller, which reads as a caption rather than as somebody
  talking. Only the words grow: the meta line, the reply link and the whole form stay small.
  The meta line itself is `// name · [date at time]` — the marker is the one every block on
  the page opens with (IDE chrome only), and the time is there because two replies on the
  same day said nothing about their order without it.

- **Instant, never cached — by design.** The page itself is cached; the comment block is an
  island (`assets/js/comments.ts`) that fetches `/api/comments?post=<slug>`, and that route is
  refused a shared cache like everything under `/api`, so its read is always live. A new comment
  is POSTed and the thread is then RE-READ, which is what makes it appear. There is no optimistic
  overlay: 2.0 dropped the one the frozen tree had, along with `mergeOptimisticComments`, because
  a refetch is drift-free by construction where an overlay has to keep a second renderer in step
  with the server's. A failed POST leaves the form filled and prints the server's own message.
  Nothing invalidates the page cache for a comment.
- **Limited markdown (`comment-md.ts`):** only `**bold**` / `*italic*`. The source is HTML-escaped
  FIRST, then only `<strong>/<em>/<br>` are injected — no user tag, link, image, or script survives
  (mirrors Invariant 5). Hard cap 1000 chars (server + client).
- **3-tier threading.** `depth` (0/1/2) is enforced server-side in `addComment` (a reply needs
  `parent.depth < 2`); display nesting is rebuilt from the actual ancestry. `buildCommentTree`
  (pure, tested) re-roots orphans (parent purged) and renders a deleted-but-still-replied node as a
  blanked **tombstone**; a deleted leaf is pruned.
- **Sign-in, in 2.0** (`src/web/comment-auth.ts`, `src/comments/{commenter,google-oauth}.ts`,
  [ADR 0013](../decisions/0013-google-sign-in-for-commenters.md)): `next-auth` is gone, so a
  commenter is a signed `__Host-` cookie rather than a session row — 30 days, HMAC over name +
  address + expiry, no table. The client id and secret are entered in **Settings → Connections**.
  A signed-in comment takes its identity from the cookie and IGNORES the request body, records
  `provider = 'google'` and skips Turnstile. Turning the toggle off stops trusting cookies
  already issued, rather than waiting for them to lapse.
- **Privacy:** email is stored but NEVER sent to the public client (separate `PUBLIC_COLS` vs
  `ADMIN_COLS`); website gets `rel="nofollow ugc noopener"`. `/api/comments/me` returns the
  signed-in NAME only, and is the one public response on the site marked `no-store`.
- **Post rename / purge:** `renameComments` moves comments with the slug; `deleteCommentsForPost`
  clears them when a post is purged (both wired in `posts.ts`).
- **Admin:** `/admin/comments` is a reading queue on one sheet (2026-08-18): each comment is two
  lines of its text (click toggles the full text per row; replies are flat rows, so each toggles on
  its own) over one small-print ledger — name, email, post, time, IP with the ISO country in parens
  (`1.2.3.4 (VN)`, best-effort from the proxy/Cloudflare edge header, blank when absent, `—` on
  pre-feature rows) — and a quiet Delete at its end. Rows fill two newspaper columns from `lg` up.
  The sheet-top search reaches the text, the name and the post title (accent-folded) and paints
  hits with the pen (`Marked`). Delete = soft delete via owner-gated `DELETE /api/comments/[id]`
  → Trash (restore/purge in `TrashView`'s Comments tab).
- **Abuse:** manual comments only accept a published, visible post + a per-IP in-memory rate limit
  (6/min). The same IP (+ country) is persisted on the row (`author_ip`/`author_country`) for admin
  moderation — admin-only, NEVER sent to the public comment tree.
- **Integration keys live in the ADMIN, not (just) env (`src/store/integration-keys.ts`).**
  Turnstile AND Google keys are SECRETS, kept in the server-only `integration_keys` table (single
  row), set via Admin → Settings → Connections (owner-gated `POST /api/comments/keys`) — NEVER in
  `settings.data`. An env var of the same name is a fallback. `getCommentEnv()`
  (`src/comments/comment-env.ts`) reports which integrations are usable (booleans) + the public
  Turnstile site key; no secret is ever sent to a client. Saving the pair calls `clearCache()`,
  because a cached page carries the old site key and the old "draw the Google button" flag.
- **Cloudflare Turnstile (`src/auth/turnstile.ts`, `src/assets/js/turnstile.ts`).** Toggle
  `settings.comments.turnstile`; **enforced only when the toggle is on AND a Turnstile secret
  exists**, so toggling on without keys never locks out commenting (the admin row shows a "needs
  keys" badge + the key inputs appear right below). The manual form gates the comment box **behind
  the Turnstile pass**; the POST verifies the token server-side via siteverify (fail closed).
  Tokens are single-use → the form re-arms after each post.
- **Google sign-in for commenters** is `settings.comments.googleAuth` and is described in the
  bullet above — the OAuth flow is `src/comments/google-oauth.ts` and the identity is a signed
  cookie, not a session row. **A signed-in commenter is never an owner**: the two are separate
  cookies, separate code paths, and the admin gate is `ownerRouter()` alone.
- **Routes:** `/api/comments` (GET list + POST create) is the ONLY public-exempt comment path, and
  it is listed with its reason in `scripts/checks/routes-guarded.ts`; `DELETE /api/comments/:id`
  stays owner-gated.
