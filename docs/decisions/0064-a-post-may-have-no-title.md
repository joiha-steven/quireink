# 0064 — A post may have no title

Date: 2026-09-25
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

A reader asked for short posts: a thought, a quick update, a link with a line under it, a
small announcement. Public, with their own address, in the blog's list and in the feed,
tagged and filed like any post, drawn in the same style — "a middle ground between a full
blog post and the existing Notes", without changing what Notes are.

Notes were the obvious answer and the wrong one. [0044](0044-a-note-is-not-a-post.md) keeps a
note out of the post feed, the front page and the newsletter on purpose, and the notebook is
where Micropub and the reader's pen deliver things from outside
([0046](0046-the-notebook-speaks-the-open-standards.md)). Moving notes into the feed would
break the one promise that made them useful.

A fourth kind — its own table, editor, routes and scope tab — would be a post with one field
missing, built twice.

## Decision

**A short post is a post with an empty title.** Nothing new is stored: `posts.title` has
always defaulted to `''`, and the API already took a post named only by its slug. What
changes is that the site stops assuming every post has a name.

**Publishing.** The editor publishes a post with words and no title; a page still needs a
name, and a note still needs a title or a source. The admin API and MCP's `create_post`
take a post that is only `content`.

**The address is its first words.** `slugFromWords` — six words, through the same `slugify`
— before the `post-<clock>` fallback, which now only CJK and emoji reach. The first save pins
it: before this, an untitled draft derived a fresh slug on every save and was renamed each
time.

**Where the post is drawn, its words are drawn — never a headline invented from them.** The
article has no `h1` and no standfirst. A listing card has no heading and its date becomes the
permalink, the way every microblog does it. A front-page card shows its standfirst, linked. The
newsletter block has no headline. The RSS item has no `<title>` and the JSON Feed item has
none either (both formats allow it; a titleless JSON item carries its words as
`content_text`).

**Where only a name will do, it is called by its first words.** `postName` in
`src/content/untitled.ts`: the title, else the excerpt cut at a word to seventy characters
with one ellipsis, else the slug. It names the post in the `<title>`, the share card, the
schema `headline`, the read-next link, related posts, a series, the archive, the sidebar,
search, `llms.txt`, the 404's latest list and a one-post newsletter subject.

## Consequences

- A short post's list card and feed item carry its **excerpt**, not its body: listings and
  feeds read metadata only, and a link inside a short post is plain text there. The article
  has the whole thing. Rendering bodies into the list would be a per-post render on every
  listing and is not part of this.
- A post whose first words are a picture and nothing else is named by its slug.
- The admin still shows an untitled post as `(untitled) #n` with its standing line beneath.
- The `api/v1` read API returns `title: ""` as stored: it is data, and a client deciding how
  to show it is the client's business.
