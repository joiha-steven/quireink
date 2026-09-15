# The admin stops standing on somebody else's framework

ADR 0054's steps 6 and 7 — [`decisions/0054-the-admin-is-pages-again.md`](./decisions/0054-the-admin-is-pages-again.md),
which holds the decision and the order. The fourteen screens are
[`admin-conversion.md`](./admin-conversion.md); this file is the two steps that took the
frameworks out from under them. React went with the last of the chrome, and the wrapper around
ProseMirror went with the editor.

**The argument was never payload, in either step.** It is which decisions this product makes for
itself. The payload moved anyway, and the numbers are here because they were measured rather than
because they were the point.

### Step 6: React leaves, and four overlays come with it

The last of it. `react`, `react-dom` and their two type packages are out of `package.json`, `jsx`
is out of `src/admin/tsconfig.json`, the React `Bun.build` block is out of `scripts/build-admin.ts`
and four lines are out of `scripts/checks/deps.ts`. **45 files went**, and the admin stopped being
two kinds of program.

**What was left to convert was not a screen.** Step 5 ended with the React tree routing ONE page —
the dead end — and holding four things that belong to no screen at all: the command palette, the
shortcut sheet, the confirm dialog and the toast. They are [`web/admin/overlays.ts`](../src/web/admin/overlays.ts)
now, drawn by the server on every admin page, wired by five files under
[`island/lib/`](../src/admin/island/lib/) that the rail imports before its own early return —
because the picker, the toast and the confirm dialog are asked for by screens that have nothing to
do with the rail, including the sign-in shell, which draws no rail at all. **A question nobody
hears is a delete that happens in silence.**

⚠️ **AND THE NUMBER THE WHOLE ADR WAS FOR.** What the browser must have before the first frame, on
every admin page:

| | old (React) | new |
|---|---|---|
| before the first frame | 297 KB | **22 KB** |

There is no admin bundle any more. Every island is an entry of its own and a screen links the one
it needs; `check:bundle` measures the RAIL entry, because that is the one every page loads.

**The palette ships its hundred-odd rows as markup.** It is the clearest case of this ADR's second
decision: the rows are a fixed list the server already holds — `settings-index.ts` plus the
screens, the actions and the writing — so drawing them is the server's job and the island's job is
to hide the ones that do not match. It carries **both search lanes** (`data-pal-lower` and
`data-pal-fold`), which is `src/accent.ts`'s rule and not a fold of both sides: an unaccented query
finds every accent and an accented one finds only itself, because five Vietnamese words live inside
one folded spelling.

⚠️ **TEN TOUR FLOWS WENT RED FOR ONE REASON, AND AN ELEVENTH WENT WORSE THAN RED.** React mounted
an overlay the moment something opened it, so `document.querySelector('[role=dialog]')` could only
ever find the one that was open. Four are drawn and hidden on every page now, so that same line
finds the FIRST in the document — the confirm box — whatever is on screen. Three flows counted a
`<form>` that is the confirm dialog's own typed-name box; the picker flows opened the picker and
then measured the confirm box; the palette flows typed into its hidden input and found no rows.

The eleventh is the one worth writing down. **"Staying keeps an unsaved settings change" kept
passing while reaching into the hidden confirm box**, because clicking a hidden button does
nothing, and the page it therefore failed to leave is the page the flow wanted to still be on. A
guard that passes by not working is worth less than one that is red.

[`scripts/tour-ask.ts`](../scripts/tour-ask.ts) holds the answer once — `openDialog()` filters on
`checkVisibility()`, because only the confirm box carries `hidden` itself and the other three are
hidden by the scrim around them, and `offsetParent` is null for all four either way. `screenForms`
names the confirm dialog's form as the one exception, with its reason, rather than scoping the
check to `main`: a form arriving anywhere else must still turn the flow red.

**What the React deletion left behind, found by asking which files the island entries can still
reach.** Five modules nobody imported: the fetch layer every React page read its props through,
two re-export shims kept so call sites that no longer exist would not have to change their import,
and the browser's dictionary loader — 45 lines plus a green test, for a job the server does inside
the HTML now. Also 39 lines of CSS for a progress bar nothing draws any more, and **six of the
seven `crash*` strings in eleven languages**: they described a React error boundary, and a page
whose island fails to wire leaves its markup standing rather than going blank.

⚠️ **ONE THING THE ERROR BOUNDARY DID IS STILL NEEDED, and it had gone with it.** Chunk names carry
a content hash, so an update deletes the file an already-open tab is about to ask for. A navigation
always fetches markup naming the current build, so thirteen of the fourteen cases cannot happen any
more — but two things are still fetched on demand from a page that is already open, arrange mode
and the media picker, and one of them had no catch at all: a tab older than the server answered the
press by closing the menu and doing nothing, however often it was pressed, and left an unhandled
rejection where nobody was looking. Both say so now, in one sentence with a reload beside it, and
**neither reloads by itself** — the rail is on every admin page including the editor, and a reload
started there would be a reload of somebody's half-written post, begun because they pressed
"Arrange the menu". Details in [`admin-navigation.md`](./admin-navigation.md).

**What is left of React in this repo is nothing.** What is left of the wrapper around ProseMirror
is step 7.

### Step 7, first stage: the engine is named, and it was in the chunk three times

ADR 0054's last step is `@tiptap/*` out and `prosemirror-*` in — a change of which LAYER this
product depends on, not of what it does: the wrapper has a commercial tier and a company behind
it, and the engine underneath is MIT, one author, and older than this product.

The first stage is the cheapest half and it found the expensive thing. `prosemirror-model`,
`prosemirror-state`, `prosemirror-view` and `prosemirror-transform` are named in
`package.json` and on `check:deps`'s list with their reasons, and the twenty-three imports that
reached them through `@tiptap/pm/*` — which is literally `export * from "prosemirror-view"` —
now name them directly. Nothing about the editor changed.

⚠️ **AND NAMING THEM IS WHAT LET THE DUPLICATES BE SEEN.** Five packages had
`prosemirror-view@1.42.2` nested under them while the hoisted copy was 1.42.3, with ranges the
hoisted one satisfies — a lockfile that had drifted, and nothing in the tree that could say so.
Measured from the built artefact, not from `node_modules`:

| | before | after |
|---|---|---|
| copies of `prosemirror-view` in the editor chunk | **3** | **1** |
| the editor chunk, raw | 1,028 KB | **833 KB** |
| the editor chunk, gzipped | 325 KB | **264 KB** |
| the admin's JavaScript, all entries | 1,170 KB | **976 KB** |
| ready to type, three readings at 1440 | — | 108 / 108 / 115 ms |

Two `overrides` lines and a forced resolve. Ready-to-type does not move, and saying so is the
point: on localhost that number is not paying for parse.

**Two copies of ProseMirror is not merely weight.** Every `PluginKey` is identity-compared,
`instanceof` is how the view decides what a node is, and a second module record makes both
answer wrong — on a schema the two copies agree about, which is why it would surface as
behaviour nobody can reproduce rather than as an error. The repo had already met it as a TYPE
error and written a cast around it with a comment calling it a packaging fact: "when the
duplicate is deduped the cast becomes a no-op rather than a lie". It has been, so the cast is
gone rather than left standing.

**`check:bundle` counts the copies now**, from the artefact, using a string that appears exactly
once per copy of its package — and it fails when a probe stops matching at all, because a string
reworded upstream reads exactly like a clean bill. Both failure modes were proved by breaking
them on purpose. A `bun install` that re-nests a version now gets as far as the next build.

One more thing the sweep turned up: `node_modules/tiptap-markdown` was on disk and **not in
`bun.lock`**, left over from the day `MarkdownBridge.ts` replaced it. It was not shipping —
nothing imports it and a fresh clone never had it — but it was pinning a second
`prosemirror-markdown`. Removed.

### Step 7: the wrapper leaves, and the editor is 2,900 lines of this product's own

`@tiptap/core`, `@tiptap/starter-kit` and seven `@tiptap/extension-*` packages are out of
`package.json`. What replaces them is `src/admin/editor/` — a schema, a plugin stack, a keymap,
a table of input rules, a command table and a small `Editor` class.

**The argument was never payload**, and ADR 0054 says so: the wrapper has a commercial tier and
a company behind it, and the engine underneath is MIT, one author, and older than this product.
The payload moved anyway, because a wrapper that wraps twenty extensions ships twenty
extensions:

| the editor chunk | raw | gzipped |
|---|---|---|
| before this ADR's step 7 began | 1,028 KB | 325 KB |
| after the duplicate was deduped | 833 KB | 264 KB |
| **with the wrapper gone** | **524 KB** | **167 KB** |

The admin's JavaScript, every entry together: **1,170 KB → 776 KB**. And 102 plugins became 15 —
each package's extension contributed its own keymap plugin and its own input-rules plugin, and
every keystroke walked the lot.

**What made this survivable is that the serializer never depended on the wrapper.** `md/to-editor.ts`
builds ProseMirror JSON straight from a parse and `md/from-editor.ts` reads the tree back, and
both speak in node NAMES and attribute names. So the schema had to agree on strings, not on an
API — and the proof is direct: **45 corpus fixtures produce byte-identical Markdown through both
editors**, each one a fixed point.

⚠️ **THE SCHEMA WAS PROVED EQUAL BEFORE THE PACKAGES WENT, AND THE PROOF IS KEPT.**
[`schema-agreement.test.ts`](../src/admin/editor/schema-agreement.test.ts) compared the two
schemas field by field against a running Tiptap editor — 310 assertions — and now compares
against [`golden/editor/schema-before-step-7.json`](../golden/editor/schema-before-step-7.json),
captured from a worktree at the last commit where those packages were installed. **It must never
be regenerated**: a snapshot rebuilt from the thing it guards guards nothing, which is the same
warning `golden/v1/corpus/` carries.

**The one piece that is not obvious is the chain.** A ProseMirror command is
`(state, dispatch?) => boolean`, which is enough for one command; the toolbar asks for three at a
time. `run.ts` runs them against ONE transaction, so a later command sees what an earlier one
did and the whole gesture is a single entry in the undo history. What would go wrong without it
is silent — every button would still work, and one press of Bold would need three presses of
Mod-Z to take back — so the test asserts the SHAPE of what reaches the view.

**Five faults the rewrite turned up, each of which the previous layer was hiding:**

- ⚠️ **A highlight could not run across an inline code span**, and `InkMark.ts` had a paragraph
  saying the fix needed a forked mark and another dependency. The mark is ours; the fix is a
  named list where an underscore was. The server has always drawn ``==a `b` c==`` as one stroke
  and the editor now agrees — which matters because the old behaviour was a save that changed
  the reader's page.
- ⚠️ **`_` is not a list you can subtract from.** `'_ ink'` still excludes every mark: the first
  term already said all of them. Cost one attempt.
- ⚠️ **Changing a bullet list into a task list cannot be two steps.** Either order leaves an item
  of the wrong type inside its list for the length of one step, and `setNodeMarkup` checks, so it
  throws. The list is rebuilt and replaced whole.
- ⚠️ **`TextSelection.create` is the wrong door for "the end of the document".** The end is the
  position after the last paragraph, which cannot hold a caret. `between` walks to the nearest
  one that can. Found by a typing test putting its text in a paragraph that did not exist.
- ⚠️ **A colour suffix has to lift the pen.** `==go tay==#pink` recolours the stroke and then
  leaves the mark stored, so everything typed after it kept being highlighted — the stroke
  swallowed the rest of the sentence.

⚠️ **AND ONE DESIGN MISTAKE, CAUGHT BY THE TESTS THE SAME DAY IT WAS MADE.** The product's own
three plugins — find, the pen's grips, the gallery's column count — were at first passed in by
whoever built the editor. Twelve tests went red, and they were right to: `editorExtensions.ts`
existed in the first place because two test files had held a hand-copied list of extensions
prefaced by "the set the editor actually mounts", a claim nothing enforced. An editor built
anywhere in this repository is now the editor the writer uses.

**Two things replaced rather than removed.** `@tiptap/extension-bubble-menu` wraps `floating-ui`;
what this product asks of it is "above the selection, centred, flipped below when the top of the
sheet is in the way", which is `coordsAtPos` and arithmetic on two rectangles
([`editor/bubble.ts`](../src/admin/editor/bubble.ts)). And a typed URL still becomes a link — by
asking `md/gfm-autolink.ts`, the matcher the reader's page and the serializer already use, rather
than by carrying a second grammar.

**Paste rules are gone and that is a deletion, not an omission.** Each package carried one beside
each input rule. A plain-text paste is parsed as MARKDOWN by the product's own engine before a
rule could look at it, and that engine is a better reader of `**bold**` than a regex, because it
is the one the reader's page uses.
