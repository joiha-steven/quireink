# Motion — one engine, one switch (HARD RULES)

Four files ARE the engine, and nothing about how the product moves lives anywhere else:

| Half | Reading site | Admin |
|---|---|---|
| CSS — tokens, floor, click, entrances, gates | `src/web/motion.css.ts` (`MOTION_TOKENS` and `MOTION_GATES` also bracket the sign-in sheet) | the foot of `src/admin/admin.css` |
| Script — the gate, the scroll loop, the cross-fade | `src/assets/js/motion.ts` | `src/admin/motion.ts` |

A component's own sheet says WHAT moves (which property, which state); the engine says HOW
(how long, on which curve, whether at all). A duration literal outside these files is drift,
and the audit that built the engine (2026-09-06) found eleven of them across four files at
four values for three intents.

- **Tokens: `--dur-fast` .15s · `--dur-base` .2s · `--dur-slow` .5s · `--ease-out`
  `cubic-bezier(.2,.7,.3,1)`.** Declared twice on purpose — the admin never receives the
  public sheet — and the two declarations must stay equal; no guard can see a drift between
  them, so a change to one is a change to both in the same commit. Tailwind's `transition*`
  utilities read `--dur-fast` through `--default-transition-duration`, so a `transition` in a
  className and one in the sheet run at one speed. `--ease-out` is the one curve, introduced
  only once a real curve had been chosen (the rail's FLIP slide, then every entrance); the
  scroll-driven animations do NOT use it and must stay `linear` — a timeline a reader scrubs
  with a thumb is linear or it is wrong.
- **ONE switch gates ALL motion, on both sides.** `<html data-motion>` is server-rendered from
  `settings.motion.enabled` (no flash, no client JS) on the reading site, the sign-in page and
  the admin. `html[data-motion=off]` AND `@media (prefers-reduced-motion: reduce)` each set
  `animation:none!important;transition:none!important` on every element and pseudo-element
  (`::backdrop` included) — instant, no branching. Don't add a second gate, and don't gate one
  rule at a time: the admin did, and every Tailwind `transition`, six skeleton pulses and the
  sidebar's width kept moving with the switch off. A STATE that must survive with motion off
  (the progress bar's static two-thirds) is a rule of its own under both gates; a duration
  never is. Toggle in Admin → Appearance → Rendering.
- ⚠️ **The gates do NOT zero the tokens** (measured: `--dur-base` still reads .2s with the
  switch off). Script therefore never reads a token to decide whether to move: it asks
  `motionOn()` — the attribute and the media query — and `scrollBehavior()` for any
  programmatic scroll. Four admin call sites decided this for themselves before the engine
  (two read only the OS, two read nothing), so the switch stopped a hover and not a smooth
  scroll; the book's page turn held a BLANK spread for 130ms with the switch off, because its
  timer did not know the transition had gone. `fadeSwap()` is the replacement: a Web
  Animations fade that reads `--dur-fast` off the document and is instant behind the gate.
- **One scroll loop.** Anything that watches the scroll goes through `onScrollFrame(read,
  write)`: one `requestAnimationFrame` shared by every island, every island's READ (rects,
  `scrollY`) before any island's WRITE (a class), so a scroll frame forces layout once rather
  than once per island. Four islands ran four loops on a post before this, and the second
  loop's reads landed after the first loop's writes on every frame.
- **The floor.** Every pressable thing (`:where(a,button,summary,input,select,textarea,
  [role=button])`) eases its colour, opacity and shadow at `--dur-fast`, at specificity zero, so
  a component's own `transition` wins outright and nothing snaps beside a neighbour that eases.
  Only the properties a hover changes, never `all`: a transition on a layout property re-lays
  out on every frame, which is why the settings switch travels on a transform and the upload
  bars scale rather than widen.
- **THE CLICK is the one motion that is deliberately NOT symmetric.** A pressable control
  travels 1px and takes its carved shadow **instantly** — `active:translate-y-px
  active:duration-0` on `ui/Button`'s `SHAPE`, `transition-duration:0s` on the engine's list of
  the reading site's pressables — and only the RELEASE is sprung, on the inherited transition.
  A control that eases both ways feels like a screen; a key that drops now and springs back is
  what a hand expects of a pressed thing. Behind either gate the surface change stays and the
  travel goes — the state must still be legible without the movement, so relief is never the
  only cue.
- **The entrances.** A menu, a dialog, a toast, a slide-over ARRIVES rather than appears:
  `@starting-style` plus `transition-behavior: allow-discrete`, pure CSS, so `hidden = true`
  and `showModal()` stay the whole of the script. A dialog moves in OPACITY ONLY — a transform
  on it would make it the containing block for anything fixed inside it during the entrance,
  and the child would jump when the transform came off. An engine without `@starting-style`
  shows and hides instantly, which is the state every entrance rule starts from.
- **Cheap properties only** (`opacity`/`transform`/`translate`/colour/shadow) so motion never
  causes layout or CLS. **Nothing may hide content it cannot reveal**: an entrance starts from
  the visible state where unsupported; `.reveal` is gated behind `@supports
  (animation-timeline)` + `data-motion=on` + the owner's scroll-fade switch, and it is the ONLY
  entrance a card has — a second `view()` animation on `.post-list > article` sat in
  `book.css.ts` outside that switch until the engine, so a feed with the fade off still rose on
  the way in. There is no page-nav cross-fade in 2.0: cross-document View Transitions were
  considered and not shipped ([`spec/04-frontend.md`](../spec/04-frontend.md)).
- `settings.motion.keys` is a scoped editor preference, not another motion engine. It enables
  the custom caret response and the synthesized key sound; its visual part asks `motionOn()`.
  Audio is generated locally, at the level `settings.motion.keyVolume` names, and must ignore
  IME composition, modifiers/navigation, paste and held-key repeats. ⚠️ Sound is NOT gated by
  the engine or by reduced motion: a person who asked for less movement did not ask for
  silence, and the two settings are not the same request. Nothing in that path may animate
  the text.
