# 0059 — The blog can be followed, from anywhere that speaks ActivityPub

Date: 2026-09-19
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

This blog already speaks three open standards ([0046](0046-the-notebook-speaks-the-open-standards.md)):
IndieAuth, Micropub and Webmention. All three are about a *page* — who may write to it, and who
has linked to it. None of them makes the blog itself somebody a reader can subscribe to in the
place they already read.

The place a lot of readers already are is the fediverse. A reader on Mastodon can follow an
account and see its posts among everything else they read; they cannot follow an RSS feed there.
The feed is not a substitute — it is a different act, in a different application, which is why
WordPress, Ghost and Micro.blog have all added ActivityPub rather than pointing at the feed they
already had.

## Decision

**The blog becomes an actor: WebFinger, an actor document, an inbox that takes Follow and Undo,
an outbox, HTTP Signatures both ways, and delivery to every follower's inbox when something is
published, changed or withdrawn.** Off at install and on every upgrade.

### Off is a stronger word here than elsewhere

Every machine door in this product ships off. This one is different in kind: switching it on
gives the blog an **identity** in a network of other people's servers — a name, a keypair, and a
list of strangers who asked to hear from it. That is not a display option, and it is not
something to acquire because the software updated overnight.

It also refuses to run in two more cases, and both are failures nobody could diagnose from
inside:

- **With no handle.** There is no default, because a default would be an identity chosen for the
  owner in a network of strangers.
- **With no site address.** The actor's id is `<site>/ap/actor`; with nothing set,
  `resolveSiteUrl` answers `http://localhost:3000`, so the blog would publish an identity
  pointing at whoever asked, and every delivery it signed would be checked against a key fetched
  from the follower's own machine.

### The handle is not the login username

The owner signs in as themselves; the blog is followed as itself. Tying the two would also
publish the username of the only account on this install to anybody who looks up the actor —
half of a guess at the other half.

**And it cannot change.** The handle and the site address together *are* the actor's id, cached
by every server that follows the blog. Change either and the old actor stops existing for them,
with nothing anywhere saying where it went. The settings card says so above the switch, not
after it, and in a note that survives `[data-explanations=off]`.

## The two decisions that shape the code

**There is no hook in `savePost`.** A post can become public three ways — a save that publishes
it, the minute tick flipping a scheduled one live, an MCP call — and can stop being public two
more. Hooking each is five places to remember and a sixth that somebody adds next year. So the
sweep **compares**: the public posts against a ledger of what has been announced. A post with no
row is a `Create`, a row whose digest has changed is an `Update`, a row whose post is gone is a
`Delete`. It is self-healing and it already covers the path nobody has written.

⚠️ **The comparison needs a cutoff, and the naive version is the worst thing this feature could
do.** Without one, a blog with ten years of writing switches the switch and hands a decade of
posts to every follower who arrives that afternoon, in one timeline, permanently. The cutoff is
the moment the keypair was made — which is the moment the feature first became ready — and
`announce.test.ts` proves it with a post dated four hundred days ago.

**The ledger is written when an activity is QUEUED, not when it is delivered.** A delivery can
fail for one server and succeed for three hundred, so "has this been announced" is a fact about
this blog rather than about any one of them. A ledger written on delivery would re-announce the
post on every pass for as long as any single server stayed down.

## What holds the inbox shut

It is a public POST — written to by servers nobody here has heard of — and it changes who may
hear from this blog. Four things:

1. **A signature, or nothing.** Every state change is driven by an activity whose signature
   checked out against a key fetched from the actor it claims to be.
2. **The signer and the actor must be the same party.** A signature proves who *sent* a thing;
   this is what makes it prove who the thing is *about*. Without it anybody holding a valid key
   of their own could add — or remove — any follower they liked. ⚠️ The first version of the test
   for this passed with the check removed, because the fake network 404'd the third party's
   actor: the test was measuring the mock. It now serves that actor, and the mutation goes red.
3. **The body is the body.** The digest is over the exact bytes that arrived, which is why the
   handler reads `c.req.text()` and never `c.req.json()` — a parsed and re-serialised body is one
   key ordering away from a signature that never verifies.
4. **A key cache and a rate limit.** Verifying means fetching the signer's actor, and the signer
   names that URL — so without a cache an unauthenticated POST is a lever for making this blog
   fetch any address, as often as somebody sends.

Everything it does not implement is answered **202 and dropped**. Refusing an unimplemented verb
with a 400 teaches the far end that this blog is broken, and on some implementations gets it
marked unreachable.

## Smaller decisions, each of which could have gone the other way

- **A `Note`, not an `Article`.** An `Article` is what a blog post *is*, and Mastodon renders one
  as a bare link with no words — the owner's writing arrives as an unexplained URL. A `Note`
  carrying the title, the standfirst and the link renders as a paragraph everywhere.
- **A `Person`, not a `Service`.** Mastodon draws a `Service` with a bot badge, and this blog is
  one person writing.
- **The followers collection is a COUNT.** The specification allows a list and Mastodon publishes
  one. The people who follow a blog did not agree to appear in a public list on it.
- **`Update`'s activity id carries a timestamp; `Create`'s does not.** Receivers remember activity
  ids and drop a repeat, so an `Update` reusing an id is delivered once and every later
  correction is discarded in silence.
- **An `Accept` goes to the personal inbox, never the shared one**, and it carries the whole
  `Follow` back rather than its id — a follower's server matches the Accept against what it sent,
  and one that cannot match leaves the button spinning forever.
- **Deliveries are paced and they give up.** Twenty an hour-minute, a shared inbox counted once,
  doubling backoff, and six attempts. A 4xx gives up at once: the far end has said the activity
  is wrong, and none of those become right by waiting.
- **The keypair is its own table.** `integration_keys` is read whole by the settings screen's
  status call, which then hand-projects a safe subset — a new column there is one forgotten line
  from a PEM in a client payload. `ap_keys` is read by one module.
- **Switching the feature off does not delete the key.** An identity in the fediverse *is* its
  key; off means the doors stop answering and nothing is delivered, which the owner can take
  back. Losing four hundred followers is not.

## Consequences

- **`/{slug}` now has three representations at one address** — HTML, Markdown and the object —
  and both machine branches sit ABOVE `cached(...)` in the router. The page cache is keyed by
  path alone, so one fediverse server asking first would otherwise leave every reader afterwards
  being served JSON. Each machine answer carries `Vary: Accept`.
- **WebFinger lives under `/.well-known/`, which is a deployment hazard.** A common nginx recipe
  claims `location ~ /.well-known { … }` for ACME with no `proxy_pass`, swallowing this path and
  answering from disk — the blog then federates perfectly in testing and is unfindable in
  production, with nothing in its own logs. [`docs/agent-ready.md`](../agent-ready.md) carries
  the narrowed form.
- **The inbox is in `src/web/`, not beside the rest of `src/ap/`.** `check:routes` only reads
  `src/web/**`, so a POST declared anywhere else is invisible to the check that makes every write
  route a decision.
- **Two new activity-log actions** (`ap.follow`, `ap.unfollow`), filed under *people* rather than
  *system*: a follower is a reader, and "who is out there" is the question that heading answers.

## What v1 deliberately is not

**It publishes; it does not read.** Replies, likes and boosts arrive at the inbox and are
dropped. A reply becoming a comment is a **moderation** question before it is a protocol one —
an identity this blog cannot verify, an avatar fetched from a stranger, a spam surface with no
Turnstile in front of it, and a deletion that has to propagate back. The comment system here has
answers to all of those for its own readers and none of them for the fediverse.

**No boosting, no following others, no inbox to read.** A blog is a thing to be read, not an
account that reads.

**No key rotation.** Rotating means publishing a new key and signing a window of deliveries with
both, and the failure mode of getting it wrong is every delivery refused everywhere at once.
