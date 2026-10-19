# 0073 — A settings tab no longer prints its question under the strip

Date: 2026-10-19
Status: accepted · amends [0011](0011-settings-regrouped-into-seven.md) and [0041](0041-settings-by-the-owners-question.md): each tab still answers one question; the question is no longer printed on the tab
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

[0011](0011-settings-regrouped-into-seven.md) printed the question each tab answers under the tab
strip ("Who this machine talks to.", "How it looks: palette, typefaces…"), because the tabs it
replaced had been named for parts of the code and a name alone said little. [0041](0041-settings-by-the-owners-question.md)
regrouped the tabs by the owner's question and kept the printed line.

What the line does today, checked on the server-drawn screen on 2026-10-19:

- It repeats the selected tab's own name one row lower, in italic small print, on every tab.
  The names it explained are the owner's questions now ("Comments & mail", "Server &
  connections"), which is the work the sentence used to do.
- Nothing reads it. The panel is named by `aria-label` from the tab's label, with no
  `aria-describedby`; the settings search indexes settings, not tabs; and Help already lists
  the seven tabs with the same seven sentences (`admin-shared/help.ts`), where somebody asking
  what the tabs are for is looking.
- It costs a row on every tab: 20px at 1440, 40px at 375, where it wrapped.

## Decision

**The sentence leaves the page.** The row under the strip keeps the explanations switch alone,
its right edge on the sheet's right padding line. The seven locale keys stay: Help prints them.

Each tab still answers one question, and that is still how a setting is placed (0041). What
changes is only that the question is not printed on the tab.

## What this costs

- A first-time owner reads one fewer sentence per tab. The settings search, `?setting=` links
  and Help cover the case the line was written for, which was not knowing where a setting is.
- `.tab-hint` keeps its name for the lines that use it now (the Advanced band's hint, the
  theme-owned line on Posts); its comment in `admin.css` says why.
