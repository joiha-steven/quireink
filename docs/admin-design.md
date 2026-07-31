# Admin editorial redesign — July 2026

## Goal

Bring the admin closer to Quire Ink's reading-first identity without changing the public typography, content model, publishing rules, or editor data flow. The new direction treats admin as a quiet editorial workspace rather than a generic analytics dashboard.

## Design principles

- Typography remains unchanged. Public reading settings and font presets are deliberately out of scope.
- Use a flat light-gray neutral canvas; visual hierarchy comes from spacing and rules, not decoration.
- Cards are reserved for genuinely independent data. Shadows are reserved for overlays.
- Writing is the primary admin task. The editor gets the full desktop width and hides global navigation.
- Detailed analytics, taxonomy, integrations, and system information stay on their dedicated screens instead of competing on the home page.
- Existing server actions, autosave, revisions, preview tokens, media picking, and publish behavior are preserved.

## Changes

### Admin shell

- Replaced the dotted canvas with a quiet light-gray neutral surface (no warm/yellow cast).
- Standardized panels with a restrained 16px radius, neutral border, and one-pixel ambient shadow.
- Reduced page gutters and capped the working width for more consistent density.
- Changed active navigation from a filled block to a slim position marker.
- Kept cache clearing in the persistent sidebar footer so it remains reachable from every admin screen.

### Dashboard

- Reduced the home page to core counts, traffic/attention widgets, recent activity, and a small system footer.
- Added a prominent `New post` action to the page header.
- Removed duplicate taxonomy, SEO, traffic-source, quick-action, and full runtime cards from the home page.
- Kept detailed destinations intact in Content, Analytics, Log, Settings, and Media.

### Content list

- Moved the new-content action into the page header.
- Replaced the segmented tab track with a quieter underline navigation.
- Flattened the table surface and changed heavy black status pills to dot-and-label statuses.
- Added compact category context below titles on narrow layouts.

### Editor

- Hides the global sidebar while editing to create a focus mode.
- Moves save, preview, publish, and property controls into a sticky editor header.
- Aligns the title with the public reading column.
- Lets long titles wrap naturally while the property inspector is open.
- Makes the property inspector collapsible and sticky on wide screens.
- Removes the bottom action bar so it no longer covers the end of long posts.
- Consolidates H1–H5 controls into a paragraph-style selector.
- Keeps Markdown, media, gallery, table, autosave, revisions, and publishing behavior unchanged.

### Settings

- Kept the efficient two-column desktop layout, with consistent panel chrome, aligned gaps, and a single-column mobile fallback.
- Preserved the existing task tabs and save semantics.
- Integration panels now follow a predictable top-to-bottom order instead of competing side by side.

## Verification checklist

- TypeScript/type generation
- ESLint
- Unit tests and repository invariant checks
- Production build
- Desktop browser review of dashboard, content, editor, and settings
- Mobile review of admin navigation and editor controls

## Follow-up candidates

- Add translated strings for new editor chrome labels currently expressed in Vietnamese.
- Convert very narrow content tables to stacked list rows.
- Split Integrations into an internal secondary navigation if the number of integrations grows.
- Replace native link prompt in the editor with a small accessible popover.

## Monochrome refinement

The second visual pass tightened the system after reviewing every admin surface on production:

- Admin feedback, status, analytics trends, media selection, warnings, destructive actions, and recovery banners now use only black, white, and neutral gray.
- Theme selection opens beside the bottom sidebar control instead of below the viewport.
- The mobile admin menu is an overlay and no longer pushes page content downward.
- The expanded sidebar is narrower (176px); collapsed width is 56px.
- H1–H5 are restored as always-visible editor controls because they are frequent writing actions.
- The editor action header uses the same bordered surface and internal padding as the writing frame, rather than a flush edge-to-edge strip.
- The formatting toolbar has its own sticky offset below the desktop action header; on mobile the action header scrolls away and formatting remains pinned.
- Admin navigation uses the custom Quire Ink line-icon language. The four public-header glyphs retain their established designs (search circle, three-circle palette, sun/moon, and two-line menu); a July 12 replacement was rejected and reverted.
- Tag labels render lowercase across the public rail, tag archives, post metadata, editor selections, and taxonomy management without mutating stored values.
- The mobile reading-rail handle is a restrained 16 × 64px edge tab with a 10 × 18px chevron. Keep it narrow; do not restore the earlier 24 × 76px footprint without a mobile review.
- The formatting toolbar offset is measured from the real action-header height, eliminating viewport- and translation-dependent gaps.
- Clear cache is restored to the admin operations footer; it remains available in both expanded and collapsed navigation.
- Legacy table and analytics panels no longer carry isolated shadows or card styling.
- Admin theme dropdown colors are isolated from the public site's configurable palette.

## Owner-approved visual decisions

- Do not change the public reading typography as part of admin-polish work; the current fonts and type settings are intentional.
- Keep Settings in two columns on desktop and one column only at the mobile breakpoint.
- Keep H1–H5 visible in the editor toolbar; these are frequent actions and must not be hidden inside a selector.
- Preserve the established four public-header icons unless a replacement is reviewed visually first. Shared button sizing still comes from `ICON_BTN`; preserving glyphs does not permit per-button chrome drift.
- Keep the editor action header framed and aligned to the editor surface, with the formatting toolbar sticky beneath its measured height.
- The square-corner rule applies only to the public reading interface. Admin is an application workspace: use the shared 16/12/8px radius hierarchy, never a global square reset and never arbitrary per-component rounding.

## Modern admin system — 2026-07-13

- Scoped the sharp-corner reset away from `.admin-shell`; frontend styling and typography remain unchanged.
- Rebuilt shared cards, tables, tabs, buttons, inputs, switches, focus rings, and empty states around a consistent neutral component system.
- Expanded the desktop sidebar to 208px (72px collapsed), added rounded active/hover surfaces, and converted the mobile menu into a floating rounded drawer.
- Rebalanced the workspace to a 1480px maximum with responsive 16/28/40/48px gutters and consistent 20–28px section rhythm.
- Dashboard stats are independent cards instead of a fused spreadsheet strip; traffic, attention, top posts, and activity use the same surface hierarchy.
- Content, Settings, Analytics, Media, Trash, Comments, Log, and Help share segmented tabs, rounded tables/panels, standard controls, and row hover feedback.
- Editor focus mode is preserved. The action header, writing frame, and property inspector are separate related surfaces; sticky toolbar, autosave, preview, revisions, media, taxonomy, and publish flows are unchanged.
- Editor formatting is a single non-wrapping icon row with horizontal overflow on narrow screens. The editor frame must not use `overflow-hidden`, because that breaks the nested sticky toolbar. Titles use content-driven height so long titles are never clipped.
- The formatting row centers its controls when they fit and naturally starts at the leading edge when it overflows; mobile remains a single horizontally scrollable line.
- The prose `contenteditable` must not inherit the global admin focus outline. The surrounding editor card supplies the workspace boundary; focus rings remain on discrete controls.
- Insert and delete input uses a block-style overlay caret, active-line pulse, and generated mechanical click. Keep visuals compositor-only, selection-safe, IME-safe, and governed by the global motion/reduced-motion settings; keep audio locally generated at the documented 45% internal volume and out of composition updates. The Rendering card switch controls the complete typewriter system and defaults on for existing installs.

The complete implementation record, production corrections, preserved invariants, verification results, and commit sequence for the July 13 work are a dated report, so they are not in this repository (ADR 0017). What binds is the contract above.
- Sidebar footer controls always use the same icon + label row structure; the theme control must show its sun/moon glyph before the applied mode label.
- Palette cards must remain readable in every state. Use neutral border/surface hierarchy for selected, available, and hidden palettes; never lower opacity on the entire card or its labels.
- Backup scheduling and import controls use shared rounded inputs and buttons. Native file-input chrome must stay visually hidden behind an accessible labeled trigger.
- The light admin canvas is neutral `#f5f5f5`; do not introduce cool blue-gray backgrounds into the application shell.

## Navigation and the progress bar — 2026-07-29

Measured before any code was written, in headless Chromium against a throwaway instance
seeded to the size of the real blog (70 posts, 40,000 analytics events).

**The first click on any admin route cost 330-390ms; the same route clicked again cost
23-35ms.** The difference was not data and not work: the CPU was idle for ~300ms of it, and
the page's own fetch had not started yet. Every page is a `lazy()` import, so a first visit
suspends; outside a transition React answers a suspension by showing the Suspense fallback,
and then throttles putting real content back by a fixed 300ms so that a fallback which
appears is never a flicker.

**The rules that follow from it:**

- **Route changes run inside `startTransition`** (`router.tsx`). The current page stays on
  screen until the new one is ready. No fallback is shown, so there is no reveal to
  throttle. The Suspense boundary in `App.tsx` is now reached on the FIRST paint only.
- **Scrolling to the top belongs after the commit**, not beside the click. During a
  transition the old page is still the one being looked at.
- **A navigation must show it is happening.** With the old page held on screen, the bar in
  `ui/TopProgress.tsx` is the only signal a click did anything. It covers both halves: the
  router's `pending` and every in-flight `useView`, through the counter in `pending.ts`.
- **The bar never claims a percentage.** Nothing here knows how far along a fetch is; it
  eases toward an edge it never reaches, then snaps closed. It honours `data-motion`.
- **The entry preloads the current route's chunk** before React runs (`main.tsx`), so the
  chunk downloads alongside the shell round trip instead of after it.

Measured after: Content 355 → 49ms, Media 336 → 59ms, Comments 348 → 43ms, Settings 346 →
45ms, Analytics 418 → 83ms. Cold load of `/admin` 501 → 329ms.

## The one rule for a setting — 2026-07-30

**A setting reads top to bottom: what it is, what to know about it, then the control.** The
owner asked for it after finding the screens "scattered", and they were: the font pickers put
their hint BELOW the grid, the palette card carried a tinted callout and a plain paragraph
saying related things at two different sizes, and the gap between a label and its control was
0.5, 1 or 2 depending on which file you opened.

It is enforced by primitives, not by discipline, because discipline is what had already
failed:

- **`Setting` in `components/kit.tsx`** places the three parts for any control that is not a
  text field: a picker grid, a switch, a row of buttons. `SETTING_LABEL` and `NOTE` are
  exported from the same file, and `ui/Input.tsx` builds a text field from them, so a field
  and a picker cannot drift apart.
- **`Input`/`Textarea` take a `note`.** They took a label and nothing else, which is why every
  hint was hand-placed by its caller and no two callers agreed.
- **`inline` is the one variation**, and only for a boolean: a 24px switch beside its label
  keeps a list of fifteen feature toggles scannable, and the ORDER is unchanged. `ToggleRow`
  is `Setting` + `Switch`, so it shares the label and note style rather than repeating it.
- **`SETTING_GAP`** is the space between two settings in a card. One number.
- **One control style per kind.** `CheckField` replaced the two raw `<input type="checkbox">`
  that were left (the palette cards' "show to readers", the SMTP TLS row) and looked like a
  different application from the switches above them.

**A button is a fixed object; the text beside it gives way.** `ui/Button` carries
`whitespace-nowrap shrink-0` for that reason: without them, a button in a flex row beside
anything long is squeezed until its own LABEL wraps. The MCP card shipped "Tạo token" broken
across two lines, and a Copy button 40px tall beside a 28px field. A read-only value box that
sits next to a button gets `min-h-10` to match it.

**A card holding a table is not a half-width card.** The MCP token table has five columns and
its last one was clipped at the card's edge in the two-column grid at every screen size.

### Cards go in column stacks, never straight into the grid

A grid lays its children out in ROWS, and a row is as tall as its tallest cell. Two cards of
different heights therefore leave a void under the shorter one, and the next card starts below
BOTH. The System tab showed it plainly: Import, then Backups at twice its height, then Cache
stranded at the foot of the left column with a hole above it. The owner's words were "is
splitting into two columns so hard".

So a tab is `GRID` holding two `COL` stacks, and the cards are assigned to a side by hand so
the two come out close in height. Each stack packs independently and there is no row to align
to.

**EVERY tab is two columns.** There is no one-column tab, and there was: Site held a single
card and Reading held fifteen feature toggles beside one comments switch. Two tabs of seven
behaving differently from the rest reads as a mistake rather than as a choice, which is exactly
how the owner read it. The answer is to split the CONTENT, not to leave the layout ragged:
Site is identity plus marks, and Reading is post features plus listing features (with the
activity log as its own small card, since a record of what the owner changed was never a
reader feature).

Corollary: **do not widen a card to fix its contents.** Making the MCP card span both columns
gave its table room and turned it into a wide slab under a two-column tab, which reads as a
mistake. A table that does not fit scrolls inside its card.
