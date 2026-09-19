> Read when touching ActivityPub: `src/ap/`, `src/web/ap-routes.ts`, or the settings card.

# The fediverse — `/ap/*` + `src/ap/`

- **What it is.** The blog as an account people can follow from Mastodon and its neighbours. New
  posts arrive in a follower's timeline as the title, the standfirst and a link back. **Off
  unless the owner enables it** (Admin → Settings → Server & connections), and it refuses to run
  without a handle or a site address. [ADR 0059](decisions/0059-the-blog-can-be-followed.md) has
  the argument in full.
- **It publishes; it does not read.** Replies, likes and boosts reach the inbox and are dropped
  with a 202. A reply becoming a comment is a moderation question before it is a protocol one.

## The doors

| Path | What it is |
|---|---|
| `GET /.well-known/webfinger?resource=acct:<handle>@<host>` | the only way `@name@host` becomes a URL |
| `GET /ap/actor` | the actor: name, summary, inbox, outbox, **public** key, shared inbox |
| `GET /ap/outbox` | the last 40 posts as `Create` activities |
| `GET /ap/followers` | a **count**. Never a list — see ADR 0059 |
| `POST /ap/inbox` | `Follow` and `Undo Follow`. Everything else is accepted and dropped |
| `GET /{slug}` with `Accept: application/activity+json` | the post as a `Note`, at the same address as the page |

Every one answers `404` while the feature is off, or while the handle or the site address is
missing.

## The files

| File | Holds |
|---|---|
| `src/ap/signature.ts` | HTTP Signatures, both directions. Pure — the key is an argument |
| `src/ap/keys.ts` | the keypair, and the ONLY reader of the private half. There is no `privateKeyPem()` |
| `src/ap/objects.ts` | a post as a `Note`, and the `Create`/`Update`/`Delete`/`Accept` envelopes |
| `src/ap/actor.ts` | the actor document, the WebFinger answer, and `apReady()` |
| `src/ap/store.ts` | followers, the ledger of what has been announced, the delivery queue |
| `src/ap/announce.ts` | the state comparison that decides what still has to be said |
| `src/ap/deliver.ts` | the only file that touches the network |
| `src/ap/tick.ts` | the one thing the clock calls |
| `src/web/ap-routes.ts` | the routes. In `src/web/` so `check:routes` can see the public POST |

## Things that will bite

- **`/.well-known/` and your reverse proxy.** A common nginx recipe claims
  `location ~ /.well-known { … }` for ACME with no `proxy_pass`, which swallows WebFinger and
  answers from disk. The blog then federates perfectly in testing and is unfindable in
  production, with nothing in its own logs. Narrow it to
  `location ^~ /.well-known/acme-challenge/` — [agent-ready.md](agent-ready.md) carries the form.
- **The handle and the site address cannot change.** Together they are the actor's id, cached by
  every server that follows the blog. Changing either loses every follower silently.
- **The cutoff.** Nothing published before the keypair was made is ever announced. Turning the
  feature on does not push the archive into anybody's timeline; it also means a post back-dated
  before that moment is never announced either.
- **`Vary: Accept`.** `/{slug}` answers HTML, Markdown or the object depending on `Accept`, and
  the in-process page cache is keyed by path alone — so both machine branches sit ABOVE
  `cached(...)` in `web/app.ts` and set their own headers. Moving one below it would serve JSON
  to readers.
- **The tick does everything.** Nothing is delivered from a request. `publishTick` runs every
  minute: mint the key if needed, work out what changed, hand over up to twenty deliveries.

## Tests

| File | Holds |
|---|---|
| `src/ap/signature.test.ts` | sign-and-verify, and every way a request is refused |
| `src/ap/objects.test.ts` | the wire shapes, including the ids that must and must not repeat |
| `src/ap/announce.test.ts` | the comparison, and the cutoff that stops a decade going out at once |
| `src/web/ap.test.ts` | the routes, the private key never leaving, and the inbox's defences |
