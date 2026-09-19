# 0058 — A paragraph holding nothing but a link becomes a card

Date: 2026-09-19
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

This blog has turned a paragraph holding nothing but a URL into something since the port: a
YouTube link becomes a player, a `.mp4` becomes a `<video>`, a Spotify link becomes an audio
frame. Every other link alone on its own line stayed a line of blue text with an address in it —
which is what a citation looks like when the author meant *go and look at this*.

Two cases in particular read badly. A link to a piece of writing elsewhere gave the reader
nothing to decide by: no title, no sense of what it was, no idea whose site it was. And a link
to the owner's own uploaded PDF looked identical to a link to a web page, so the reader learned
it was a 12 MB download by clicking it.

## Decision

**Two more things a standalone link can become: a bookmark card and a file card.** Both are off
for a blog that already exists and on for a new one.

**The markdown does not change.** The line an author wrote stays a bare URL — portable, the same
line every other renderer in the world reads as a link, and an export of this blog carries no
markup a different tool would have to learn. That is the bargain the video embed already made,
and it is what lets either card be switched off without touching a single piece of writing.

**One rule finds the paragraph.** `render/link-cards.ts` owns "a `<p>` whose whole content is
one link, or one bare URL", and the video pass, both card passes and the collector all read it.
Three regular expressions over one shape agree on the day they are written.

**The order is video, then card.** A YouTube URL is a player and has been since the port;
reaching it with a preview card first would replace an embed with a thumbnail on every existing
blog that had one, which is not a feature anybody switched on.

## How a bookmark card learns what it says

**A save does not reach out.** A body that renders with a standalone link nobody has looked up
writes the URL down — one `insert or ignore`, no network — and returns. The minute tick takes
the written-down rows five at a time and reads each page once, exactly as media variants are
finalised off the upload path. A card appears within a minute of the writing rather than during
the save, and a test that saves a hundred posts touches nothing outside the box.

**A row is fetched once, ever.** There is no refresh. That is a promise about what this feature
costs rather than an omission: this blog does not quietly re-crawl a list of other people's
pages every week on the owner's behalf. Correcting a card is deleting its row.

**The picture is brought home, and not into the Library.** A card that hotlinked its preview
would put a third-party request — and a third party's view of who is reading this blog — on
every page carrying a link, which is the one thing the reading side of this product does not do.
So the image is fetched through the same SSRF guard, byte cap and storage-quota check the
importer's image rescue uses, re-encoded to one 400px WebP, and written straight to the blob
store under `cards/`. **Not** `addMedia`: that would put somebody else's og:image in the owner's
own media grid, among their photographs, with a row and a variant set, and fifty links would be
fifty things to scroll past that they never uploaded.

**The switch is checked where the request would leave.** Noting a URL is free and stays
unconditional, so a blog that turns the feature on later already has its backlog and fills in
without anybody re-saving a post — but a blog with it OFF must not be reading other people's
pages on a timer. Reaching out is the whole of what the switch controls, and a version of this
that only stopped the DRAWING would have done the one thing the owner declined while showing
nothing for it.

**One fallback, reached three ways.** A URL nobody has read yet, a page that refused or had no
title, and the feature switched off all produce the same thing: the plain link the paragraph
already was. The renderer never sees a setting — it draws what it is handed — so "off" and
"unknown" are one code path in it and there is no second way for a card to fail to appear.

**Nothing that comes back is trusted.** The title, the description and the site name are chosen
by whoever runs the far server, travel through a database column, and land in this blog's HTML.
Nothing is escaped on the way in — escaping at the point of storage is how a value gets escaped
twice or not at all, depending on the reader — so `render/link-cards.ts` escapes on the way out,
unconditionally, with no branch that skips it.

## On by default, but only for a blog that has none

`NEW_SINCE_INSTALLS_EXISTED` in `content/settings.ts` is now the one list of feature defaults
that changed after this software had users. A blog with a settings row answered these questions
by never being asked them and keeps the old answer; a blog with no row at all is one nobody has
configured and gets today's. `bookText` established the shape; these two join it.

The asymmetry matters more here than it did there, because the bookmark card is the one feature
in this product that **reaches out**. Turning it on means saving a post causes this server to
fetch the pages behind its links. That is a thing to be asked rather than told.

**An existing blog therefore has to be TOLD the switches exist**, or the answer they were given
by default is the only one they will ever have. The settings rows carry the full sentence, the
Help screen has a section, and a release that ships this must say so in its notes —
[releases.md](../conventions/releases.md) carries that as a step.

## Consequences

- **`web/uploads.ts` still decides whether a file opens or saves.** The file card sets no
  `download` attribute: the `content-disposition` the route already sends is the right place for
  it, and setting it here would overrule that from the other end of the system for one of the
  two ways to reach the same file.
- **`fileKind` moved into `media/files.ts`** and the Library's own row now reads it. Two rules
  for "what kind of file is this" is a blog whose admin and whose page disagree about an upload
  in front of the owner.
- **The body cache key is NARROWED for cards, where it is whole for media.** The image maps are
  digested whole, so an upload re-renders every body — a cost the cache warmer absorbs because
  uploads are occasional. A link is not: a URL is noted on nearly every save, so the key sees
  only the rows the markdown names.
- **There is ONE `@media print` block, and `print.test.ts` now asserts it.** This sheet shipped
  six print rules of its own, and that test finds the print block with `indexOf` and reads to
  the end — so it read every screen rule after them as a print rule and reported nine unused
  selectors, three of which were sentences.
- **`media/files.ts` and `web/public.css.ts` both reached their ceiling** and were split on the
  seams this work exposed: `media/site-files.ts` (what the SITE wears — its icons, its rendered
  logo, its typeface) against the owner's attachment library, and `web/card.css.ts` (what a
  standalone link looks like), which took the player rules with it because they had been sitting
  between the series box and the callout since the port.

## What this deliberately is not

**Not an oEmbed client.** A card is built from Open Graph and the `<title>`, which every page
has, rather than from a provider registry that has to be kept in step with other people's APIs.

**Not visible in the editor.** The editor shows a bare URL as a link, exactly as it shows a
video URL as a link — the `video` node only exists in the session where one was pasted, and the
round trip is owned by `md/to-markdown.ts` either way. Making the editor draw cards means a node,
a schema change against a fixture that must not be regenerated, and a second place that decides
what a paragraph becomes. The gain is a preview; the cost is two answers to one question.
