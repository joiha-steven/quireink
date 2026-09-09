# 0047 — A reader's marks travel by a code, not an account

Date: 2026-09-09
Status: accepted

## Context

0043 gave the reader a pen and kept every mark in the browser it was made in. It named
three tiers and promised the second: the reader who has marked a few things is offered a way
to have them on the next device, "through the sign-in commenters already have, or a
notebook code in the shape of `SETUP_CODE`, for those who will not use Google."

The obvious design is an account: a row per reader, a password, a session. This blog has
refused that for readers twice already — 0007 for the owner's sign-in and 0013 for
commenters, where a signed cookie stood in for a table — and the reasons have not changed.
A reader account is a support burden, a password to reset, a table of addresses to protect,
and a door a personal blog does not want to be responsible for. What tier two needs is far
less than an account: a NAME the server can file marks under, which the reader can present
again from somewhere else.

## Decision

**A reader is named by something they hold, never by who they are.**

- **A notebook code.** `POST /api/pen/code` mints twenty characters from an alphabet with no
  look-alikes (no `0`/`O`, `1`/`l`/`i`), shown once in groups of four, in the shape of the
  setup code the owner already knows. The browser keeps it in `localStorage` and sends it as
  a header on every call; the server keeps its SHA-256 and nothing else. The code IS the key:
  whoever holds it holds the marks, and losing it loses them. That is stated to the reader
  in the sentence beside the code, and it is the design rather than a shortcoming — a key
  that can be recovered is an account by another name.
- **The commenter cookie.** A reader who has signed in with Google to comment (0013) is
  already named by a signed cookie the browser sends on its own. Their reader id is an HMAC
  of the address under a secret of its own (`reader-marks`), so the table never holds an
  address and cannot be joined to one by the commenter secret either. Google is a door only
  where the owner has configured it; the island offers it when the page says so.

**One table, opaque to the server.** `reader_marks` holds one row per reader per page — the
same JSON list the browser keeps — checked only for shape (a list of marks each naming its
words) and size (128 KB a page, 500 pages a reader). `reader_keys` holds the hashed codes. A
year untouched and either is swept by the tick. Nothing is shown to the owner: the admin has
no view of it and the MCP has no tool for it. A reader's marks are the reader's.

**The server's copy is the truth once a page has one.** On load the island draws what the
browser has, asks who it is, and if the server has that page replaces the browser's list with
the server's; if not, it seeds the server from the browser. Every change is written back
after a short debounce. Two devices marking the same page in the same minute overwrite each
other — the trade for having no merge algorithm to get wrong, and the right one for a
reader's highlights.

**The reader can leave.** "Forget on this device" drops the code from this browser and
nothing else; "Forget everywhere" deletes every row under the name and the code itself.

## Consequences

- Four public write routes under `/api/pen`, declared with their reasons in the routes guard.
  Authorised by the code header or the SameSite cookie, neither of which a cross-site page can
  supply; rate limited per address; `404` while `features.readerPen` is off, so a blog that
  never offered this never serves it.
- The reader-pen bundle grows from 10.3 to 13.1 KB (budget 13,400): twelve labelled controls
  and four calls. It is loaded on article pages only, and only while the pen is on.
- A blog that offers this stores data a reader wrote. It is bounded, opaque, swept after a
  year, deletable by the reader, and invisible to the owner; the admin's description of the
  switch says so, in every language.
- Tier three (0045, 0046) is untouched: a mark can still be sent to a notebook of the
  reader's own, kept here or not.
