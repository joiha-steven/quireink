---
name: quireink-write
description: Write, edit, publish and steward a Quire Ink blog through its built-in MCP server — drafting and scheduling posts, tagging and taxonomy, media, the composed front page, traffic reports, comment moderation, backups and the archive audit. Use when the user asks you to write or publish to their blog, report on its readers, tidy its archive, or moderate its comments.
---

# Working a Quire Ink blog over MCP

Every tool below is a thin wrapper over the same functions the admin calls: same slug
rules, same revisions, same soft delete, same activity log. Nothing you do here is a
side door, which also means nothing you break here is invisible to the owner.

Tool internals: [`docs/mcp.md`](../../../docs/mcp.md). Worked prompts:
[`docs/agent-cookbook.md`](../../../docs/agent-cookbook.md).

## Before the first call

MCP is **off until the owner turns it on** (Admin → Settings → Connections → MCP) and
issues a token. Tokens are shown once, hashed after that, and **expire 180 days after
creation**. A 401 on every call usually means one of those two things, not a bug worth
debugging: ask the owner to check the toggle and the token's age.

## The surface, in the order you will reach for it

**Writing.** `create_post` `update_post` `patch_post` `get_post` `list_posts`
`delete_post` · `create_page` `update_page` `get_page` `list_pages` `delete_page` ·
`list_categories` `list_tags`

**The site itself.** `compose_homepage` (the composed front: lead, picks, category rows,
most-read) · `update_appearance` (palette, fonts, sizes) · `get_settings`
`update_settings` (a safe slice only)

**Media and files.** `add_media_from_url` `list_media` `delete_media` · `import_images`
(one batch per call: fetch images still loading from other hosts into the library and
rewrite the references; loop until `remaining` is 0, stop early on `moved: 0`) ·
`list_files` `delete_file`

**Reading the blog.** `get_traffic` `get_post_traffic` `get_audience` `search_posts`
(the owner's own full-text search, drafts included) `get_update_status`

**Stewarding.** `list_comments` `reply_comment` `delete_comment` · `create_snapshot`
(a backup) · `send_test_newsletter` · the trash: `list_trashed_posts`
`list_trashed_pages` `list_trashed_media` `list_trashed_files` and the matching
`restore_post` `restore_page` `restore_media` `restore_file`

## What is deliberately not here

**Subscriber email addresses, and commenters' emails and IPs, are unreachable over MCP,
ever.** `get_audience` returns counts. An agent stewarding a blog needs numbers and words,
not identities. There is no tool that broadcasts a newsletter to real subscribers
(`send_test_newsletter` goes to the owner) and none that mints a token. If a task seems to
need one of those, say so and hand it back — do not look for a way around it.

## House rules for writing

- **Draft by default.** Create as a draft and say it is waiting, unless the user asked for
  it live. Publishing is one edit away for them; unpublishing something readers already saw
  is not.
- **Write Markdown, in their voice.** Read two or three of their recent posts with
  `get_post` before writing the first one. The blog stores Markdown, so what you write is
  what is kept, not a conversion of it.
- **Slugs are the site's memory.** Renaming one leaves a redirect behind automatically, but
  do not rename slugs in bulk to tidy them. Old links in other people's posts are the point.
- **Excerpt, categories, tags, every time.** They drive the front page, the rails and search.
  An audit that finds them missing is the most common real job on this blog.
- **Deleting is soft.** Everything lands in Trash and the owner can restore it. You cannot
  destroy anything permanently; only they can, in the admin. This is not a reason to be
  casual — a trashed post is off the site immediately.

## Jobs worth knowing by shape

- **The Monday report.** `get_traffic` for 7 days against the 7 before, then plain words:
  what was read, where from, what grew, what fell — and one suggestion for the next post
  based on which existing posts still pull readers.
- **The archive audit.** Walk published posts; report missing excerpts, categories and
  tags, plus pairs that cover overlapping ground and should link to each other. Report
  first, change nothing until told.
- **The moderation sweep.** `list_comments`, flag spam or abuse **with the reason**, and
  trash only after the owner confirms. Comments already pass a gate the blog runs itself
  (ADR 0032), so what reaches the queue is what got through it, not the raw firehose.
- **The front page.** `compose_homepage` curates the composed front the owner designed.
  Order the rows by what people actually read; do not invent a new layout for them.
- **Before anything destructive**, `create_snapshot`.

## Do not

- Do not publish, delete or email on your own initiative. Drafts and reports are yours;
  anything a reader would see is theirs.
- Do not paste the MCP token into a file, a commit, or a message. If you have seen one, it
  is already too widely known — tell the owner to rotate it.
- Do not fabricate figures. If `get_traffic` returns nothing for a window, say the window is
  empty; a blog with no readers yet is a fact, not an error to paper over.
