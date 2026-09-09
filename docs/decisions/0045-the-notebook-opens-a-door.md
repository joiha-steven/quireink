# 0045 — The notebook opens a door: a clip page, a bookmarklet, and the pen that sends

Date: 2026-09-09
Status: accepted

## Context

0043 gave the reader a pen that writes in their browser, and 0044 gave the owner a notebook
apart from the posts. The third tier joins them: a passage a reader marks on one Quire Ink
should be able to travel to the notebook on their own. The two blogs are two processes on two
servers that have never heard of each other (0021), and the reader's marks on the first are in
that browser alone.

The reflex was a token: the reader pastes a key from their notebook into every blog they read.
That is a secret copied into a dozen strangers' localStorage, revoked one at a time. The other
reflex was for the sending blog to call the receiving one — which needs discovery, an
identity, and a channel that either server can be lied to over.

The thing already in the room is the browser. It talks to both blogs; on the reader's own
notebook it is already signed in as the owner; and a form on a page is a way to hand it a
passage that no server has to trust.

## Decision

**The door is a page: `GET /notes/clip`, the owner's, no script.** It reads where the passage
came from, that page's title, the passage and the reader's words off the query string, shows
them, and offers one form: a title, the note, private or public (private by default — nothing
arrives on the site by accident), and *Keep*. The form posts to itself; the answer is a page
with the way to the note. Anyone not signed in is sent to sign in and returned. This is what
lets the door work from a popup another site opened, from a phone, with scripts off — and it
is the shape the next door (Micropub) keeps.

**The pen sends by opening the door.** A mark's card gains *Send to my notebook*. The first
time, it asks one question — the notebook's address — and remembers it in this browser; from
then on it opens the door in a small window with the passage and the words. No token travels
and none is stored: the reader is the owner over there, and already signed in. The same
question Mastodon asks on a remote follow, for the same reason: a browser will not let one
site read another's memory.

**A bookmarklet makes any page a source.** With nothing to keep, the door is the tool's own
page: a link to drag to the bookmarks bar which, on any page at all, takes the selection and
opens the door with it. Not only Quire Ink blogs — the notebook keeps passages from anywhere.

**Two words are the door's, not a note's.** `clip` and `feed.xml` are refused as note slugs.

## Consequences

- The reader-pen bundle grows by ~1.2 KB for the button, the question and the URL.
- A passage arrives as a query string, so it is bounded: 4,000 characters, a page of a book
  rather than a book. A name collision keeps the passage under a dated slug rather than
  refusing it — the reader has already left the other page to bring it.
- What this still does not do: identify the sender to the source (that is IndieAuth and
  Webmention, next), or take a passage without a browser in the loop (Micropub, next). The
  door is deliberately the smallest thing that lets a passage cross between two blogs today.
