# 0054 — The admin is pages again, and the editor is the only client left

Date: 2026-09-14
Status: accepted · replaces [0006](0006-admin-stays-react-spa.md)
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

[0006](0006-admin-stays-react-spa.md) kept the admin as a React SPA during the port, and it was
right to. It also wrote down, in its own Consequences, the bill that this ADR is paying:

> **Cost accepted:** React idiom has a high ten-year mortality, so this code will need
> rewriting eventually. That is the right trade, because the cost of rewriting it later is
> falling faster than the risk of keeping it is rising.

Four things have moved since 2026-07-27.

**The deadline it was written under is discharged.** The port shipped at
[0012](0012-flatten-repo-after-cutover.md).

**The intent is now on the record.** [0053](0053-a-dependency-is-a-decision.md) makes writing it
here the default and a dependency the exception. React and the Tiptap wrapper are in its tier C.

**The harness 0006 asked for exists, and is four times the size it asked for.** That ADR made
the admin's lack of parity coverage a condition and required "a scripted headless tour of at
least 30 flows". `bun run tour` runs **124**, in a real browser, and asserts geometry and
contrast as well as behaviour. A screen-by-screen rewrite is measurable in a way it was not.

**The other half of the product already works this way.** The reading site is Hono rendering
HTML with small islands of plain JavaScript in `src/assets/js/`, and it has been since
[0008](0008-hand-written-css-no-tailwind-public.md). The admin being a different kind of program
means every rule about pages has two answers.

What is being carried:

| | |
|:--|:--|
| Admin TypeScript, tests and build output excluded | **29,509 lines** |
| `.tsx` components | **176** |
| Hook call sites | **731** (321 `useState`, 143 `useEffect`, 135 `useRef`, 64 `useCallback`, 40 `useMemo`) |
| JavaScript the owner's browser downloads | **2,420 KB** |
| API endpoints the admin calls | **51** |

## Decision

**The admin becomes server-rendered HTML with islands, the same shape as the reading site.
React and `react-dom` go. The editor stays a client-side application, on ProseMirror directly.**

Four things follow from that, and each is a decision in its own right.

**1. Navigation is the browser's again.** The client router goes and each admin screen becomes a
Hono route that renders HTML. Moving between screens is a page load. For a program one person
opens, that is not a regression — it is what the reading site does, and it removes the router,
the route-level code splitting and every loading state that exists only because navigation was
being simulated.

**2. The eleven admin dictionaries stop shipping.** They are translated strings picked at render
time, so the server picks them and the browser is sent one language: the words, already chosen,
inside the HTML. That alone is most of a megabyte.

**3. The editor is the exception, and stays one.** ProseMirror is an application, not a page, and
[the pen](0049-the-pen-answers-the-hand.md), the maths nodes, find-and-replace and the Markdown
bridge are all built on it. Only the wrapper leaves: `@tiptap/*` is a convenience layer over
ProseMirror, and 15 of this repository's import sites already reach through it to
`@tiptap/pm/*`, which IS ProseMirror re-exported.

**4. ProseMirror becomes a direct dependency, in tier B of [0053](0053-a-dependency-is-a-decision.md).**
It arrives today underneath Tiptap; after this it is named. That is an addition, so it is stated
here rather than made quietly: `prosemirror-state`, `-view`, `-model`, `-transform`, `-commands`,
`-keymap`, `-history`, `-inputrules`, `-schema-list`, `-dropcursor`, `-gapcursor`, `-tables`.
The reason it is an exception and not tier C is the one 0006 gave and that has not weakened in
seven weeks: **Vietnamese IME with Telex**, across four browsers, in the program its owner writes
in every day. `key-feedback.ts` already carries the scar tissue of handling one composition
event. ProseMirror is ten years of the rest.

### The order, and why it is this one

Cheapest first, and the editor last, so that the hardest screen is converted by someone who has
already converted fifteen others.

1. **The screens that are forms.** Settings, and the first-run steps. Mostly inputs that POST.
2. **The screens that are lists.** Posts, pages, notes, comments, subscribers, redirects.
3. **The library.** Uploads, with the one real island: the drop target and its progress.
4. **The dashboard and analytics.** Charts, which are islands over data the server already has.
5. **The editor.** Last, and on its own, and in two steps: `@tiptap/react` first (the three React
   node views become plain ProseMirror ones), then Tiptap itself.

### What proves each step

- **The tour's flows for that screen stay green.** They are written against the rendered page and
  not against React, so they do not need rewriting to keep working. A flow that has to change to
  pass is a behaviour that changed, and that is the signal.
- **`check:admin-css` keeps every class honest**, which is what makes moving markup between files
  safe at all.
- **The editor's own suites**: 2,074 lines and 122 blocks, including the corpus round trip whose
  second law is that a save may not change the reader's page.
- **Telex, by hand, before the editor step ships.** No harness here reaches an IME. This is a
  condition, not a suggestion.

## Consequences

- **The admin stops being a second kind of program.** One way to render a page, one way to write
  an island, one set of conventions.
- **Roughly 2 MB stops being downloaded**, most of it dictionaries and the framework. This does
  not matter for speed on the owner's machine and was never the argument; it matters because it
  is 2 MB of somebody else's decisions.
- **This is the largest single change since the port**, and it is the one with the most ways to
  be quietly wrong. It is deliberately cut into five steps that each ship.
- **`@tiptap/*` leaves; `prosemirror-*` arrives.** The count of packages barely moves. The point
  is which layer this project depends on: the wrapper has a commercial tier and a company behind
  it, and the engine underneath is MIT, one author, and older than this product.
- **0006's parity concern outlives it.** The admin is still the area a type error cannot see.
  The tour is the answer, and every step of this owes it a flow.
