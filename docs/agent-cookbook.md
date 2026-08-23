> Split from the README's MCP section — worked examples of what an agent can DO with the
> tool surface, for owners. The tool internals live in [`mcp.md`](./mcp.md); the discovery
> endpoints in [`agent-ready.md`](./agent-ready.md).

# Agent cookbook

Connect Claude (or any MCP client) to your blog — the README's [MCP section](../README.md#let-an-ai-agent-write-for-you-mcp)
shows the two steps — and these are prompts that do a real job, not demos. Every one goes
through the same code the admin uses: same slug rules, same revisions, same trash.

The tool surface has two halves. The **writing half**: posts, pages, taxonomy, media,
files, a safe slice of settings. The **reading half**: traffic, audience counts, comments,
full-text search over your own archive, and whether a newer release is out. Two things are
deliberately NOT reachable over MCP, ever: subscriber email addresses, and commenters'
emails and IPs. An agent stewarding your blog needs counts and words, not identities.

## The Monday report

```text
Using my blog's MCP server: pull traffic for the last 7 days and compare it to the
week before. Tell me, in plain words: what people read, where they came from, what
grew and what fell. End with ONE suggestion for what to write next, based on which
existing posts still pull readers.
```

`get_traffic` answers with the same numbers the dashboard draws, so the agent's report
and your admin never disagree.

## The newsletter draft

```text
List my posts from the last month, read the three most recent published ones, and
draft a newsletter issue as a new DRAFT post titled "Letter #12": one short intro in
my voice, one paragraph per post, no marketing tone. Do not publish it.
```

The agent reads with `list_posts` + `get_post`, writes with `create_post`, and the draft
waits for you. `get_audience` tells it how many confirmed readers the letter will reach —
but never who they are.

## The moderation sweep

```text
List the comments on my blog. Flag anything that is spam or abuse, tell me why, and
after I confirm, move those to the trash.
```

`delete_comment` is a soft delete — everything lands in the admin's Trash, where you can
restore it. An agent cannot destroy a comment permanently; only you can, in the admin.

## The archive audit

```text
Go through all my published posts. For each: does it have an excerpt, categories and
tags? Search the archive for posts that cover overlapping ground and could link to
each other. Give me a table of what is missing, worst first — change nothing yet.
```

`search_posts` is the owner's own full-text search (drafts included), which is what makes
"find the posts that should link to each other" possible without downloading the archive.

## The front-page editor

```text
Look at my traffic for the last 30 days. Then recompose my front page: pin the post
that best represents the blog as the lead, order the category strips by which
categories people actually read, and keep the popular row on 30 days.
```

`compose_homepage` curates the composed front the owner designed — which rows, what size,
where their posts come from. The layout grammar itself is not negotiable, which is exactly
why an agent can be trusted with it. It also warns when a strip names a category with no
posts, rather than silently rendering an empty row.

## The Friday evening makeover

```text
It's autumn. Switch the blog to the sepia palette with Literata as the reading font,
then send me the next newsletter issue as a test so I can see the look in email too.
```

`update_appearance` only offers the curated menus — six palettes, the font presets —
because an agent never sees the rendered page, and every option on the menu is one the
owner's own screens offer. `send_test_newsletter` mails **only the owner**; the recipient
is not something an agent can choose, and the real broadcast is not available over MCP
at all. Don't like the look on Monday? One sentence switches it back.

## The standing habits

Ask once in a client that supports schedules (Claude's own scheduled tasks, or a cron
calling the client) and the job repeats:

- *"Every Monday 8am, run the Monday report and leave it as a draft titled with the date."*
- *"Once a week, list comments and flag anything that needs my eyes."*
- *"When I say 'ship it', take my newest draft, tighten the title, fill the excerpt,
  and publish."*

## Where the lines are

- **Sensitive settings can't be written.** The settings tool exposes title and description;
  fonts, domains, mail and auth are admin-only.
- **Deletes are soft.** Posts, pages, media, comments — everything goes to the Trash first.
- **Every action is logged.** The activity log shows the agent's work the same way it shows
  yours, and revoking the token in the admin stops it mid-sentence.
- **`get_update_status`** tells the agent which version you run and whether a newer release
  exists — the same amber/green dot the admin wears — so "is my blog up to date?" is a
  question your assistant can answer.
- **Appearance is a menu, not a palette.** No hex colors, no CSS over MCP — preset ids
  only, because every preset is already a good screen.
- **The newsletter's send button stays human.** The agent can draft and can send a test
  to you alone; the broadcast to your readers is yours to press.
- **`create_snapshot`** before anything big — the agent can take the same backup the
  scheduler takes.
