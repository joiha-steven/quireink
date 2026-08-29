# Newsletter

## Newsletter — `src/news/{subscribers,mail,newsletter-log}.ts`, `/api/newsletter/*`, `api/newsletter/*`, `api/broadcast`, Admin → Newsletter

- **Double opt-in.** `subscribers` (email unique · status pending/confirmed/unsubscribed · a
  per-subscriber `token` used for BOTH confirm + unsubscribe links). `POST /api/subscribe`
  (public, rate-limited) upserts a pending row and emails a confirm link;
  `GET /api/newsletter/confirm?token=` → confirmed; `GET /api/newsletter/unsubscribe?token=` →
  unsubscribed. The confirm/unsubscribe routes return a standalone HTML page (`resultPage`) since
  they open from an email. Re-subscribing reuses the row's token; a confirmed address short-
  circuits (no re-send, no membership leak).
- **Bot defence, three layers, all silent.** The form carries a honeypot (`website`, parked
  off-screen; a value in it is a confession) and a render timestamp (`ts`; only a
  faster-than-hands fill REJECTS — missing or stale passes, because cached pages legitimately
  serve old forms and the JS path sends none). A caught bot gets the normal success answer:
  an error message to a bot author is a specification of the next bot. Then a per-ADDRESS
  cooldown (`confirm_sent_at`, one confirm email an hour) caps what a subscription-bombing
  run can make this site send to one victim, whatever IPs it uses. Finally the hourly cron
  sweeps pending rows older than 30 days (`sweepPendingSubscribers`) — hard-deleted with
  their confirm-log rows, not moved to the Trash, because bot droppings swept into a bin the
  owner must empty by hand is the same chore relocated.
- **Deleting a subscriber is a soft delete** (Invariant 6): the ✕ in People sends the row to
  the Trash's Subscribers tab, restorable with its send history intact. Purge — from the
  Trash only — is the hard delete, and the moment `deleteSendsFor` clears the address from
  the send log. A trashed address neither receives broadcasts nor answers its own links;
  re-subscribing it starts over as a fresh pending row with a fresh token.
- **SMTP (`src/news/mail.ts`, Nodemailer).** Config lives on `integration_keys` (server-only secrets,
  env fallback) — set in Admin → Settings → Connections (`NewsletterFields`, via `api/mail`).
  `sendMail` never throws: `{ sent:false, error:'smtp_not_configured' }` when unset, so subscribe
  still records the pending row. `isMailConfigured` = host + From present.
- **Sign-up form** (`SubscribeForm`) renders at the foot of a post ONLY when SMTP is configured
  (`getMailStatus().configured`). The same gate also puts an envelope button in the public header
  (`SubscribeTrigger`, last before the mobile drawer toggle) that opens the identical card as a
  modal (`SubscribeOverlay`, lazy — Escape / backdrop closes), so a reader can subscribe from any
  page.
- **Admin → Newsletter** (`/admin/newsletter`, `NewsletterView`) is where the list is worked;
  Settings → Connections keeps ONLY the SMTP credentials (`NewsletterFields`, which now derives
  the TLS checkbox from the port — implicit TLS is 465, 587 is STARTTLS; the wrong pair fails with
  an opaque OpenSSL "wrong version number"). Three tabs:
  - *People* — every subscriber with their send history from the log: emails sent, failures (with
    the last error), open rate, last send. Counts + delete.
  - *Send* — tick one or MORE published posts, review the REAL `broadcastEmail()` HTML in a
    `sandbox=""` iframe (scripts/forms/navigation all blocked), then send. Several posts go out as
    ONE digest, never one email each. A post that already has successful sends needs the resend
    checkbox first; the send itself is `confirm()`-gated.
  - *Test* — the three sample sends.
- **Test send** (`POST /api/mail/test`, owner only, `NewsletterTest`). Three kinds — `smtp`
  (bare "it works" note), `post` (the broadcast, built from the newest published post, or a
  stand-in on an empty blog), `subscribe` (the double opt-in confirmation) — each built by the
  SAME builder the live path uses, so a green test means the real send works. Recipient defaults
  to the signed-in owner's address; confirm/unsubscribe links carry a placeholder token, so they
  deliberately land on the "invalid link" page. Uses the SAVED config, not the unsaved form.
- **Send log** (`newsletter_sends`, `src/news/newsletter-log.ts`). `sendMail` writes ONE row per
  outgoing email — success or failure, all four kinds (`confirm`/`broadcast`/`reply`/`test`) — so
  no path can email an address without it showing up. Keyed by ADDRESS, not a subscriber FK:
  reply notifications go to commenters who never subscribed. Deleting a subscriber clears their
  rows. `statsByEmail`/`statsByPost` fold it once into the admin's columns; a failed send is not
  counted as sent, and the open-rate denominator is successful BROADCASTS only.
- **Open tracking.** A broadcast carries a 1x1 pixel at `GET /api/newsletter/open?t=` (public —
  it is fetched by a mail client with no session). The token identifies the SEND row, never the
  address, so the URL leaks no identity; the first hit wins (`is('opened_at', null)`) so a client
  refetching can't inflate the count; no IP, UA or referrer is recorded. The preview and the test
  send pass no token, so reviewing an email never counts as an open. Links are NOT wrapped, so
  there is no click tracking and every URL in the mail is the real one.
- **Manual broadcast** (`src/news/broadcast.ts` `broadcastPost`, `POST /api/broadcast`). There is NO
  automatic send: the cron publishes a scheduled post on time but never emails anyone (owner's
  call — every send is previewed and pressed by hand). `broadcastPost` mails one publicly-visible
  post to every confirmed subscriber, one email each with its own open token, and stamps
  `posts.broadcast_at`. The double-send guard reads the LOG, not the stamp: posts from the old
  auto-broadcast era carry a backfilled stamp with no matching log rows, so the stamp alone would
  wrongly report them as sent. `force: true` (the admin's resend checkbox) overrides it. The route
  lives at `/api/broadcast`, NOT under `/api/newsletter/*` — that prefix is the public
  confirm/unsubscribe/pixel family and a send endpoint must stay owner-gated.
- **Comment-reply notifications** (`src/comments/comment-notify.ts` `notifyReply`, fired via `after()`
  from the comment POST route on a reply). Emails the parent commenter (their `author_email`) a
  link to the thread. Best-effort + transactional: skips a self-reply (same email), a deleted
  parent, and no-ops without SMTP. Never throws.
- **Email design** — `src/news/newsletter-email.ts` builds every message (`confirmEmail`,
  `broadcastEmail`, `replyEmail`) through ONE `shell()`, reused by the subscribe route, the manual
  broadcast, the comment route, the admin preview and the test send. It is meant to read like the
  blog, so:
  - Identity comes from `src/news/email-brand.ts` (`emailBrand(settings)`) — ONE resolver, so all four
    senders share a letterhead. It carries the owner's OWN palette
    (`getDefaultTheme(...).light`) plus the masthead logo, bundled as `EmailBrand` rather than
    four more positional arguments.
  - **The masthead is the real logo.** Neither of the site's own logo files suits an inbox: the web
    render (`logoRenderUrl`) is WebP, unrenderable in Outlook on Windows (Word engine), and the
    untouched original is frequently WebP or SVG too — so `renderLogo` now emits a **PNG twin**
    beside the WebP (`settings.logoEmailUrl`, `files/logo-<stamp>-mail.png`), rebuilt and deleted
    in lockstep with it so a stale mark can never ship. `emailLogo` prefers the twin, falls back to
    a mail-safe original (png/jpg/gif — for sites predating the twin), and only then to the site
    name as text. `alt` is the site title, because images are blocked by default in many inboxes
    and the letterhead must still read.
  - **Table layout + inline styles on every element**, 600px centred column. Mail clients strip
    `<style>` blocks, collapse margins and ignore flex/grid. Buttons are a `<table>`, not a padded
    `<a>` — Outlook drops padding on inline elements. Cover refs are made ABSOLUTE (they are stored
    store-relative and an inbox has no origin to resolve them against).
  - Light only (`color-scheme: light`): a dark variant needs a `<style>` media query, which the
    clients that most need it are likeliest to strip. No web font — a client will not load one.
  - A hidden preheader (the inbox preview line), a per-post date, and a footer that says WHY the
    reader is getting this next to the unsubscribe link (spam filters look for that pair).
  - Structure: masthead (site name) · rule · lead post (cover + 26px title + excerpt + solid
    button) · each further post (19px title + excerpt + text link, rule-separated) · rule · footer.
  All values are escaped; the reply's `contentHtml` is already-sanitized comment markdown.
