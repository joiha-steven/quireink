# The editor's own contract

The rules that are true of the WRITING SURFACE and of nothing else in the admin; the rest of
the admin is [`admin-design.md`](./admin-design.md). Read when touching the editor.

The seam is real rather than arithmetic. Every other screen in this admin is a form or a
list, and the visual contract next door is written for those: cards, gaps, one setting, one
of each. The editor is the one place that carries a second typeface (it is WYSIWYG, so it
must write in the face it publishes in), a caret this product draws itself, and a sound. Read
that file first; this one only adds what is true here.

## The editor

- The chrome is the SHEET'S OWN top rows (the Writing Desk mock's `sheettop`): the action
  line — back link + save state + word count on the left, quiet Markdown/Attributes text
  controls and the Preview/View/Save/Publish buttons on the right — is the card's first row, and
  the toolbar sticks directly under it. One piece: a floating band over a crack of page
  between it and the paper was rejected as looking off (2026-08-17). Never shadowed.
  The global sidebar shows again since the two-pane write screen; the write pane (the list
  column) sits beside the sheet from 1640px up, pinned at the same top as the sheet's chrome.
- **Reading the piece is a button on that row, beside Preview** (2026-09-11) — for a post that
  is published, saved and past its date; a note points at `/notes/<slug>`. It lived only in the
  attributes sheet's header before, so looking at your own published post cost opening a panel
  first. It is not in both places: the sheet keeps History and Analytics. On a phone it joins
  Preview inside the row's "⋯". ⚠️ **Measured 2026-09-11:** with it the action line wraps to two
  rows above `lg` in the long-label locales (Russian at 1920: 56px → 100px). Vietnamese and
  English stay on one row at 1640, which is where the write pane arrives beside the sheet.
- The title lives ON the sheet (`SheetTitle`), in the reading face, with the meta line
  (status · last touched) under it. It aligns with the public reading column, wraps
  naturally, and uses content-driven height so a long one is never clipped.
- **The toolbar is BACK, by the owner's verdict after writing on the bare version**
  (2026-08-17 — "/" alone is fine in the Markdown view, but the normal view wants a
  toolbar, reversing ADR 0024 step 4's removal, which the mock had endorsed). It sits at the top of the sheet under the
  action line, full-width, its groups centered, wrapping on a narrow window rather than
  scrolling. The Markdown source view has NO toolbar — raw text needs no formatting
  buttons. The called controls remain beside it: a selection raises the bubble, `/` on an
  empty line raises the insert menu (which prints each block's Markdown shortcut beside
  its row), and the table tools exist only while the cursor is in a table. The closing
  line under the writing says the two gestures once.
- **A SAVE MAY NOT CHANGE THE READER'S PAGE.** This is the editor's one hard contract and it
  was unwritten until 2026-08-30, when it turned out to be broken: 19 of the 45 fixtures in
  `golden/corpus` published differently after one pass through the writing surface. Footnote
  references and callout tags were escaped into `\[^1\]` and `\[!NOTE\]` — which the maths
  extension then claimed, so the reader got an empty formula mid-sentence rather than even the
  literal text. Table column alignment was dropped. Consecutive pictures lost the blank line
  between them and landed inside one `<p>`. `ReaderSyntax.ts` and `TableMarkdown.ts` hold the
  repairs; `editor-corpus.test.ts` holds the contract, by rendering every fixture before and
  after and comparing the HTML.
  ⚠️ **A fixed point is not the contract.** That file's original law — serialize twice, compare
  — passed on all four of those, because a document that is destroyed once and then holds still
  IS a fixed point. Anything that asks "does it settle?" is blind to "did it lose something?".
  ⚠️ **Nor is "it still renders".** Eight fixtures are allowed to move, because Markdown itself
  permits the normalisation — entities decode, a lazy line folds, a reference link is written
  back inline. Excusing them by asserting only that the output is non-empty made the hatch
  wider than the law: any of the eight could have collapsed to one character and the check
  would have said ok. Each now carries a BEHAVIOUR it belongs to, both counts are bounded, and
  what it publishes after a save is pinned in `golden/editor/` and compared byte for byte —
  the same shape `src/render/golden.test.ts` uses for its divergences from 1.x.
- **Keyboard: one table, in `editorKeys.ts`**, read by the handlers AND by the Help screen, so a
  chord cannot move without the printed sheet following it. Tiptap's own bindings are left as
  they come; what this product adds is `Mod-s` (save), `Mod-k` (link), `Mod-Shift-h`
  (highlighter), `Mod-Shift-o` (ring), `Mod-Shift-x` (strip marks), `Mod-Shift-a` (Attributes),
  `Mod-Shift-m` (Markdown source) and `Mod-\` (focus).
  ⚠️ **`Mod-s` is not a convenience.** Autosave here writes to localStorage and NEVER to the
  server — deliberately, so editing a published post cannot push half a sentence live. Before
  this chord existed, a writer pressing Cmd+S got the browser's own "Save page as…" dialog and
  a reasonable belief that the work was safe. Collisions were checked against the live keymap
  and against the browsers; `Mod-Shift-i` and `Mod-Shift-p` were dropped for belonging to
  DevTools and to a Firefox private window.
- **The autosave is TWO copies and neither of them is the published body.** localStorage on
  this device (since M2) and `posts.autosave_json` on the server (2026-08-30), written on the
  same timer and on the same flushes — interval, `pagehide`, `visibilitychange` to hidden, and
  leaving the screen — with the middle two going by `sendBeacon`, because a `fetch` started as
  the tab goes away is routinely killed mid-flight. The interval is a setting
  (`autosaveSeconds`, 120 by default, floored at 15), and the flushes are why widening it is
  safe: none of them may be dropped to "simplify" this. Only Save/Publish moves `content`, so
  editing a live post still cannot push half a sentence to a reader.
  ⚠️ **Uniform for drafts and published posts**, and that is the decision rather than the
  shortcut. "A draft is not live, so autosave straight into its row" is a RACE: it can be
  published a second later and the status the write read is already stale.
  The editor offers back whichever copy is newer, and says which — the device's almost always,
  the server's in the one case the device cannot help with. A piece that has never been saved
  has no row to hang a snapshot on, so localStorage stays its only copy until the first save,
  and on the way back in it is REOPENED into the editor rather than offered above an empty
  page: it is the only copy there is, so there is nothing for it to be restored over.
  ⚠️ **The key follows the PIECE, not the screen** — `quire:draft:post:new` until the piece has
  a row, then its own slug. Fixed at the value it had when the editor mounted (until
  2026-09-07), everything typed after a new post's first save went on being written under
  `new`, where the editor that reopens that post never looks and the next blank sheet reopens
  it as a piece of its own.
- The attributes are a right-hand slide-over (`SlideOver`) over a scrim, never a docked
  column — a column squeezed the writing to make room for the questions. The first Publish
  on an unpublished piece opens it as the publish sheet, footered "Later / Publish".
- The editor frame must NOT use `overflow-hidden` — it breaks the nested sticky bars. The
  table bar's sticky offset is measured from the real action-header height, so it does not
  drift with the viewport or the translation.
- The prose `contenteditable` must not inherit the global focus outline; the surrounding card
  is the boundary. Focus rings stay on discrete controls.
- **Key feedback is a CHOICE OF INSTRUMENT, not a switch** (2026-08-24): `woody`, `crisp`,
  `deep`, `off`. It defaults to `woody`, is stored as `motion.keys`, and older spellings are
  migrated on read.
  ⚠️ **The names are not the names of real machines, on purpose.** The synthesis is modelled
  on those three mechanisms and says so at length in `key-voices.ts`, but they do not sound
  close enough to the real machines to borrow their names. A label promising an Underwood and delivering a good synthesised
  knock makes the sound worse by comparison. They are named for what they are. The click is generated locally: no audio files anywhere, ever.
  ⚠️ **The three are three MACHINES, not three filter settings.** A strike is a SEQUENCE OF
  EVENTS, written as physics in `key-voices.ts`:
  **woody** runs a lever, throws a typebar at the platen through a ribbon, and lets
  the carriage step — three events over 60ms, a low wooden thump with an inharmonic metal
  ring on it, and a bright escapement tick after; the **space bar** strikes nothing at all
  and **return** throws the carriage all the way back;
  **crisp** snaps a leaf and then bottoms out 14ms later, bright and gone in 40ms;
  **deep** has no bump, a blunted onset, and a quiet upstroke 62ms later.
  Measured, and held there by `key-render.test.ts`: brightness (energy above 2 kHz) is
  0.37 / 0.08 / 0.00, and the spectral centre is 2236 / 460 / 226 Hz. Every fundamental sits
  above 200 Hz **because of the speaker, not the ear** — a laptop is down hard by then, and a
  thock drawn at 150 Hz measures beautifully and is inaudible on the machine it is for.
  Four keys, three takes of each (level-matched to the first, so takes differ in grain and
  not in force), plus a few percent of playback rate: forty keys in a line never repeat.
  Selection-safe, IME-safe, and skipped entirely during composition.
  ⚠️ **Nothing animates the TEXT.** Until 2026-08-24 every keystroke animated the whole
  block's opacity from 0.9 and nudged it 0.6px, which at sixty words a minute is a paragraph
  strobing five times a second — reported as "nháy". The sound carries the keystroke, the
  caret carries the position, and the words hold still. Do not put a pulse back on the block.
- **How loud it is, is the owner's** (2026-08-25, the fixed level being too quiet):
  `motion.keyVolume`,
  0-100, a plain linear fraction of a full scale defined once in `key-sound.ts`. The voice
  table holds the BALANCE — between the instruments, and between a letter and a space — and
  the slider is the only number that says how loud the whole thing is, so nothing about that
  balance changes when it moves. A row with no volume stored reads as the default 60. 0 is a
  real answer — the caret with the sound off — and is not the same setting as `keys: 'off'`.
- **The three instruments are levelled by measurement, not by eye** (`LEVEL` in
  `key-sound.ts`): A-weighting for the ear, plus a second-order high-pass at 250 Hz for the
  laptop speaker, geometric mean of the two. Their PEAKS therefore differ by 5:1 and that is
  correct — matching peaks is how the thock ends up inaudible and the crack ends up painful.
  A soft ceiling (`WaveShaper`, unity below 0.7) sits in front of the destination once,
  because the crest factors differ by 5× and two transients can land 14ms apart and add.
  Re-measure with the same method if a voice is retuned.
  The synthesis lives in `key-sound.ts`, apart from `key-feedback.ts`, because the settings
  screen plays a key as you drag the slider and must not pull Tiptap into its bundle to do
  it. A volume control you cannot hear while setting it is a trip to the editor per nudge.
  The sound is NOT gated by the motion engine or by reduced-motion: somebody who asked for
  less movement did not ask for silence, and those are not the same request.
- **The pen answers the hand** (2026-09-09, ADR 0049): a highlight, underline or ring JUST
  applied draws itself across the words — 200ms for the highlighter, 160 for the underline,
  240 for the ring — by growing the background the pen sheet already paints from nothing to
  its width. `pen-feedback.ts` notices the mark step after the fact and puts `pen-fresh` on
  the element for a beat; nothing enters the document, an existing mark never replays, and
  a document opening full of marks does not sweep. The words do not move. Gated by the two
  motion rules like everything else. With it, a felt-tip squeak (`pen-sound.ts`, rendered as
  arithmetic like the key click and measured by `pen-sound.test.ts`: 1.5-3 kHz, rising across
  a highlight, up and back around a ring), at `motion.penSqueak` — heard only with an
  instrument chosen and the slider above zero, and held at 0.45 of a key because it sits in
  the ear's loudest octave and lasts five times as long.
- **The caret stops blinking while the hands are moving**, and fades rather than switching:
  700ms past the last keystroke before it resumes, 1.2s ease-in-out, and never all the way
  to zero. A blink means "the cursor is here and nothing is happening", and during a burst of
  typing something plainly is.
- Autosave, revisions, preview tokens, media picking, taxonomy and publish behaviour are
  unchanged by any visual pass.
