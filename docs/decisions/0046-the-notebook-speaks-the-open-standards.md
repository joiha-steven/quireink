# 0046 — The notebook speaks the open standards: IndieAuth, Micropub, Webmention

Date: 2026-09-09
Status: accepted

## Context

0045's door lets a passage cross from one Quire Ink to another with a browser in the loop.
That is the smallest thing that works, and it is Quire Ink talking to Quire Ink. The owner
asked for the third tier to be built on the open standards instead, so that a reader whose
notebook is a WordPress or a Hugo site can keep a passage from here, and a passage kept here
can tell its source, whatever software the source runs.

Three W3C recommendations cover exactly this and have for a decade, and the IndieWeb
community runs them daily: **IndieAuth** (your identity is your URL, and you sign in with
your own site), **Micropub** (a client posts to your site through one endpoint), and
**Webmention** (one page tells another that it linked to it). This blog already had most of
the first: an OAuth 2.1 authorization-code + PKCE server with a consent page, built for MCP
connectors (`src/web/admin/mcp.ts`). IndieAuth is that flow with three additions.

## Decision

**IndieAuth rides the MCP OAuth server.** A client is a URL and need not register: an
`https:` `client_id` whose `redirect_uri` shares its origin passes the redirect gate — the
spec's own rule for trusting a redirect without fetching the client page — and the consent
page names both, as before, and the owner still clicks Approve. The requested `scope` travels
INSIDE the signed code, so the token endpoint mints exactly what was approved: any writing
scope (`create`, `update`, `delete`, `media`, `draft`) becomes a `full` token, anything else
`read`. The token response carries `me` (the site's origin, with a trailing slash), and the
authorization endpoint answers IndieAuth's sign-in-only exchange — a code redeemed there
returns `{ me }` and mints nothing. The metadata document gains the scopes; every public
page advertises `rel="indieauth-metadata"`, `authorization_endpoint`, `token_endpoint` and
`micropub` — only while the switch that gates the OAuth server (the MCP switch) is on, so a
site never advertises a 503.

**Micropub writes into the notebook, never into the posts.** `POST /micropub` takes an
`h-entry` as a form or as JSON with a bearer token from that flow; `name`, `content`,
`bookmark-of` / `quotation-of` / `in-reply-to` (any of which makes it a clip), `post-status`
and `mp-slug` are honoured; `q=config` and `q=source` answer; `action=delete` moves a note
to the Trash. A read-only token gets `insufficient_scope`. Whatever arrives is a note (0044):
the notebook is where things from outside belong.

**A note speaks microformats.** The note page is an `h-entry` — `p-name`, `dt-published`,
`e-content`, `u-url`, a `p-author h-card`, and `u-quotation-of` on the source link — so a
site that receives a mention from it can read what it is.

**Webmention goes out when a clip is published**, from every write path (the admin API, the
door, MCP, Micropub): the source page is fetched through the SSRF guard, its endpoint found
by `Link` header or `rel="webmention"` markup, and `source`/`target` posted. Fire-and-forget:
a save never waits on somebody else's server, and a failure is a log line.

**Webmention comes in at `POST /webmention`**, advertised on every page. The target must be
on this site and the source must, on fetching, actually link to it; the endpoint answers
`202` and verifies in the background, rate-limited per address. What is kept is small — the
two URLs, when, whether it verified, and, when the source is a Quire Ink clip, the passage it
kept — so the owner can ask which sentence readers keep most (`list_mentions`, with a
`mostKept` count). **Nothing is shown to readers.** A mention is the owner's to read; a
public "most highlighted" is a later decision that needs a moderation story first.

## Consequences

- One table, `webmentions`, migration `013-webmentions`. No change to any existing row.
- The OAuth code payload gains an optional `scope`; codes issued before this carry none and
  mint `full`, exactly as they did.
- A Micropub client's post-status default is `published`, per the spec; the door's default
  stays private, because there the reader is a human who has not been asked.
- Verification fetches somebody else's page; the SSRF guard, the 15-second ceiling and the
  512 KB read cap bound what that costs. Spam is possible in principle (a page that links
  here) and is bounded to a row the owner never has to see; the same gate the comment form
  has is the next step if it ever matters.
