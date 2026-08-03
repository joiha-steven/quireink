# 0011 — Settings regrouped into seven defined tabs

Date: 2026-07-28
Status: accepted

## Context

The frozen tree's settings screen had five tabs: Site, Content, Appearance, SEO,
Integrations. The owner's words, on being asked what to change while the admin was being
ported: *"sẵn xem lại sự sắp xếp của mấy thứ trong cài đặt, phân nhóm, định nghĩa cho tốt,
cái cũ đang rối"* — review the arrangement, the grouping and the definitions; the old one
is tangled.

It was. Three of the five tabs were named after nothing in particular:

- **Site** held the site's identity (title, description, language, logo, favicon) AND the
  page layout (column width, posts per page, menu, featured, sidebar, footer). Two
  unrelated jobs behind one word.
- **Content** held reader features, the comment system, and a one-time WordPress importer.
  The importer is a tool, not a setting, and it had already been moved here from
  Integrations once because it fitted there even less.
- **Integrations** held a backup destination, an AI protocol server, a CDN cache purge and
  an SMTP host. The only thing those four share is that they involve a network.

The practical cost: nothing told you which tab a given setting was behind, so finding one
meant opening all five.

## Decision

Seven tabs, each answering exactly one question, with that question printed under the tab
rather than left implicit:

| Tab | The question it answers |
|---|---|
| Site | What is this site: its name, its language, its marks |
| Layout | Where things sit on the page: the column, the menu, the sidebar, the footer |
| Reading | What a reader gets on a post, and whether they can reply |
| Appearance | How it looks: palette, typefaces, text sizes, motion |
| Search & URLs | How machines see the site, and where old addresses lead |
| Connections | Other services this site talks to |
| System | Moving content in and out, and the state of the install |

Two extra tabs is the price of never having to guess which one to open.

**No stored shape changed.** Every setting still lives in one state object and saves
together through `PUT /api/settings`, which merges. This is a regrouping of the UI and
nothing else, so it cannot lose a setting or migrate one.

## Why this is an exception to the porting rule

[`v2/CLAUDE.md`](../../CLAUDE.md) says: move it, do not improve it. That rule exists
because every "small improvement" made in transit is a place a behaviour can vanish
without anyone noticing, and silent feature loss is the top risk in the register.

This change was **asked for explicitly**, and it is the safest possible kind of exception:
it moves cards between tabs and changes no field, no handler and no stored value. The rule
still holds for everything else in the admin, which moved verbatim.

## Consequences

- Seven locale keys and seven definition strings, in all six admin languages.
- `?tab=` deep links to the old names (`content`, `integrations`) no longer resolve and
  fall back to the first tab. Nothing links to them: the only producer was the Google
  Drive consent redirect, which no longer exists ([parity exception
  1](../spec/00-rationale.md)).
- The Backup card became the manual archive, because Drive-connect is gone for a separate
  reason recorded there.
