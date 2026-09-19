# 0056 — A piece names its own language, and its translations name each other

Date: 2026-09-19
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

The admin speaks eleven languages and the reading site speaks eleven languages. A **post** spoke
none: there was one `settings.language`, it went into `<html lang>` on every page, and nothing
anywhere could say that this particular essay is in English while the blog is in Vietnamese.

That attribute is not decoration. It picks the hyphenation dictionary, the quote marks a browser
draws, the CJK face a system falls back to, and the voice a screen reader reads in. A blog with
one English post among the Vietnamese had that post announced as Vietnamese — and the reader it
was most wrong for was the one listening to it.

There was also no way to say that two pieces are the same writing in two languages, so a reader
who landed on one had no way to the other, and a search engine had no reason to believe they
were related rather than duplicated.

WordPress answers this with a plugin and Astro with routing. Ghost does not answer it at all.

## Decision

**Two columns on `posts` and on `pages`: `lang`, and `tr_group`.**

`lang` is the language the piece is written in. `tr_group` is an opaque id that every
translation of one piece shares.

Four things follow, and each of them could have gone another way.

**`NULL` lang is not "English". It is "nobody has said".** Every row written before this exists
has it, and those rows render exactly as they always did, in the site's language. Only a piece
that NAMES its language can be half of an hreflang pair — which is what makes it impossible for
a blog that has never touched this to be given a wrong pair by accident.

**A GROUP, not a pointer.** A pointer stored as a slug breaks the day that slug is renamed, and
three languages are a graph rather than a chain. A group is the only shape that holds both
without a join table.

**One rule, read by every surface.** `content/translations.ts` decides who is in a group, what
each member's language is, and what to do when two of them collide; the article's
`<link rel="alternate">`, the sitemap's `<xhtml:link>` and the line a reader presses all read
it. Two documents claiming different alternate sets for one URL is a disagreement a crawler
resolves by believing neither.

**A group with two pieces in one language is dropped whole, not deduped.** Deduping looks kinder
and produces an invalid document: the piece that lost the tie publishes a set it is not in, and
an asymmetric set may be ignored entirely. Dropping is the same answer on every surface, and the
editor's panel lists the group whether or not it can be advertised, so the collision is visible
where it was made.

## What this deliberately is not

**The site does not follow the piece.** The date, the reading time, the byline, the menu and the
footer stay in `settings.language` on every page. Making a whole page follow its piece means a
language-prefixed route, a listing per language, a feed per language, a sitemap per language and
a front page per language — a different product, and half of it would be worse than neither.

The **one** exception is the switcher's own label, which is in the piece's language: it sits in
a document whose `<html lang>` is the piece's, its only reader is the reader of that piece, and
"Cũng có bằng English" under an English headline is wrong for them.

**Notes have neither column.** A note is a page of a notebook and a clip quotes its source in the
source's own language ([0044](0044-a-note-is-not-a-post.md)); there is no second note that is
"the English one".

## Consequences

- **Three files reached their 400-line ceiling** and were split on the seams this work exposed:
  `types.ts` → `types-content.ts` (what the blog holds, against how it is configured),
  `layout.ts` → `layout-styles.ts` (a document, against a stylesheet), and `article.ts` →
  `article-head.ts` (what a page is, against what it says about itself).
- **`getPage` had its own hand-written column list** and went stale the moment a column was
  added, so every page rendered in the site's language while the index and the sitemap knew
  better. It reads `META_COLS` now. The constant exists so that there is one list.
- **No index on `tr_group`.** `schema.sql` runs before the migrations, so an index declared
  there against a column a migration is about to add fails on boot for every existing install —
  and declaring it only in the migration leaves a fresh database without it, because a fresh
  database records every step without running it. It is not needed: siblings are found over the
  index this blog already reads whole.
- **A status flip is a revision; a language change is too.** `lang` is in `projection`, because
  it changes the page a reader gets. The group is not, because pairing two pieces alters
  neither of their pages.
