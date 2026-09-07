# 0041 — Settings are grouped by the owner's question, and each tab saves one way

Date: 2026-09-07
Status: accepted
Supersedes the grouping in [0011](0011-settings-regrouped-into-seven.md); keeps its rule that
each tab answers one printed question.

## Context

[0011](0011-settings-regrouped-into-seven.md) replaced five tangled tabs with seven defined
ones and printed the question each answers under its name. That rule was right and is kept.
What it did not survive is fourteen months of growth: an AI tab arrived in 2026-08 without
amending the ADR, so seven is eight, and every setting added since landed on the tab whose
NAME matched the part of the code it came from rather than the tab whose QUESTION it
answered.

Measured on 2026-09-07, counting `input, select, textarea, [role=switch], [role=radiogroup],
button[aria-pressed]` inside `main` on each tab at 1440px:

| Tab | Controls | Switches | Height |
|---|--:|--:|--:|
| Site | 21 | 2 | 1,236px |
| Layout | 33 | 1 | 1,267px |
| Reading | 35 | 25 | 1,236px |
| **Appearance** | **137** | 10 | **2,825px** |
| Search & URLs | 19 | 7 | 1,236px |
| Connections | 22 | 3 | 1,236px |
| AI | 13 | 3 | 1,236px |
| System | 28 | 6 | 1,637px |

One tab holds 36% of every control in the screen and is more than twice as tall as any other.
Six tabs are the same height to within 31px, which is not a coincidence — it is the two-column
layout filling out whatever it is given, so the count is invisible until the page is scrolled.

The grouping fails on questions the owner actually asks:

- **"How do readers sign in to comment?"** — the switch that enables comments is on *Reading*;
  the Google and Turnstile keys that decide how a commenter proves they are a person are on
  *Connections*, three tabs away.
- **"Why did my newsletter not send?"** — the SMTP host is on *Connections*, the subscriber
  list is a different screen entirely, and nothing on the tab says whether the host answered.
- **"What does a post look like?"** — the deck, the reading time and the category label are on
  *Reading*; the table style and the pen that draws in the body are on *Appearance*; the hero
  image rule is on *Layout*.

There is a second failure underneath the first. Nine cards already save through their own
endpoint — redirects, Cloudflare, the S3 copy, MCP tokens, the backup schedule, security, the
import, the cache, the export — while every other key on the same screen waits for the sheet's
one Save button. A tab therefore shows two ways to save at once, with nothing saying which
button owns which card, and a screen that answers "did that save?" with "it depends which box
you were in" has to be read rather than used.

## Decision

**Seven tabs, grouped by the question the owner is holding when they open Settings, and each
tab saves exactly one way.**

| # | Tab | The question it answers | How it saves |
|---|---|---|---|
| 1 | Blog | What this blog is | one Save |
| 2 | Home & menu | What a reader sees when they open the front page | one Save |
| 3 | Posts | What surrounds the words on a post | one Save |
| 4 | Appearance | How it looks | one Save |
| 5 | Comments & mail | How readers answer back, and how mail leaves | card by card, and the sheet's Save |
| 6 | Server & connections | Who this machine talks to | card by card, and the sheet's Save |
| 7 | Account | You, and this admin | card by card, and the sheet's Save |

Three consequences follow, and they are the decision as much as the table is:

1. **The sheet's Save button renders on every tab** — revised the day this was accepted. It
   rendered on 1–4 only, so that no page-level save could be confused with a card's own, and
   two things were wrong with that. The backup card carried three ordinary settings keys (the
   schedule switch, how often, how many to keep) and no Save of any kind, so on tab 6 they
   could be changed and stored nowhere; that card now owns its keys like the rest. And a
   control that stands in the place the eye goes on four tabs and is absent on three reads as
   a fault on the three, whatever sentence is put in its place. The cards keep their own key,
   because storing and TESTING are not one act and only a card can do the second.
2. **A card that saves itself also TESTS itself.** `ConnectionCard` carries a lamp and one
   button: green means stored and the far end answered, amber means changed-and-not-yet-tried,
   red prints the remote error under the card rather than throwing it at a toast that is gone
   in four seconds. SMTP, Cloudflare, S3 and the AI key are reachable, so their button reads
   "Save and test"; MCP, redirects and security are not, so theirs reads "Save".
3. **Mixed keys collapse into one card, not one tab.** Tab 6 holds keys that belong to the
   shared settings record (the SEO switches, custom head/body code, the cache and storage
   lines) beside four cards with their own endpoints. They go into a single "Settings" card at
   the top of the tab with its own Save, which calls `PUT /api/settings` with only that card's
   keys. One card, one way to save it; the storage shape does not have to change to keep that.
   (Consequence 1 was revised the same day: the sheet's Save renders on every tab, so a tab
   made of self-saving cards is no longer a tab with no Save on it.)

**No stored shape changes.** `SiteSettings` keeps every key it has and keeps its name for each;
this ADR moves which tab renders a key, not where a key lives. That is what makes it reversible.

**Old links keep working.** `?tab=site|layout|reading|appearance|seo|connections|ai|system`
redirects to the new tab that now holds those keys (`site`→`blog`, `layout`→`home`,
`reading`→`post`, `appearance`→`appearance`, `seo`→`server`, `connections`→`people`, `ai`→
`server`, `system`→`server`), and `?setting=<key>` still lands on the card that holds the key.
Help, the home screen's setup band, the newsletter's SMTP link and the command palette all
address settings by those URLs, and a decision about grouping is not a licence to break four
screens that had no part in it.

## What this costs

- **Muscle memory.** Anybody who knows where a setting lives today has to look again once.
  The settings search and `?setting=` jumping are what make that once rather than always, and
  both already exist.
- **Two ways to save on one tab.** On 5–7 a card's own key and the sheet's key are both on
  screen, and they do different amounts: the card's stores that card and tries the far end,
  the sheet's stores every ordinary settings key waiting on the screen and counts them on its
  face. The cost is real and it is smaller than the one it replaces, which was a Save key that
  existed on four tabs and vanished on three.
- **`settings-index.ts` is re-keyed wholesale** — every entry's `tab` is reassigned, and the
  index is what both the search and `?setting=` read. A key with a stale tab is a search result
  that opens the wrong page, so the index and the tab components have to move in one commit.

## Alternatives rejected

- **Keep eight tabs and split Appearance only.** It fixes the height and none of the questions:
  comment sign-in still sits three tabs from the comment switch.
- **One long scrolling settings page with a sticky index.** It removes the "which tab?"
  question by removing tabs, and replaces it with 300 controls in one scroll — the arrangement
  0011 was written to escape.
- **Make everything save through the page-level Save.** It reads well and cannot be built:
  testing an SMTP host, minting an MCP token and starting a backup are not writes to a settings
  record, and pretending they are is how a Save button comes to mean four different things.
  The revision to consequence 1 does not adopt this: the sheet's key stores settings keys, and
  every action still belongs to the card that performs it.
