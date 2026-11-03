# 0074 — A share card dates a piece in the piece's own language

Date: 2026-11-04
Status: accepted · narrows [0056](0056-a-piece-names-its-own-language.md): of what stays in `settings.language`, the date drawn on the share card now follows the piece
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

[0056](0056-a-piece-names-its-own-language.md) gave a post and a page a language of their own and
kept the site out of it: the date, the reading time, the byline, the menu and the footer stay in
`settings.language` on every page. It made one exception, the translation switcher's label,
because its only reader is the reader of that piece.

The share card (`/og`) is the same case and 0056 did not name it. It is a picture of one piece,
seen in a timeline or a chat, far from the site's menu and footer: the piece's title and opening
words, and a date under them. An English post on a Vietnamese blog shared as a card read
"19 thg 10, 2026" under an English headline. Inside the site, that date sits in the site's
chrome and reads as the site's; on the card there is no chrome, and the date is one line of the
piece's own picture.

The owner decided on 2026-11-04 that the card's date follows the piece.

## Decision

**The card's date is formatted in the piece's language.** `article-head.ts` passes the piece's
language, the one `<html lang>` already carries, to `formatDate` for the card, in place of
`settings.language`. A piece with no language (`NULL`, *nobody has said*) gets the site's, so a
blog that has never set one draws every card exactly as before.

**When the card cannot draw that date, it keeps the site's.** The card's faces are Latin, Latin
Extended, Vietnamese and Cyrillic (`render/og.ts`, `ogFontsCover`); a Japanese, Korean or Chinese
date carries 年, 년 or 日, and the card declines a line it cannot draw, which would leave a
post's card with no foot at all. The date it drew before is better than none.

**Nothing to invalidate.** The card is a pure function of its query string and the date travels
in it as text, so a piece in another language is another URL. No card drawn before is answered
for it, here or by a scraper's cache.

## What stays

Everything else 0056 kept in `settings.language`, for the reasons it gave: the date line on the
article page, the reading time, the byline, the menu, the footer, every listing, feed and the
cards of the home, category and tag pages, which show no piece's date. The structured data was
never in a language: `datePublished` is an ISO instant.

## Consequences

- A piece whose language changes gets a new `og:image` URL; a platform that kept the old card
  shows it until it reads the page again, which is how every edit to a title already behaves.
- The rule that a piece's own picture speaks its language now covers two things, the switcher's
  label and the card's date. A third would be the place to ask whether the card's foot, not one
  line at a time, should follow the piece.
