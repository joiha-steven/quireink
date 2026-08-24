# The editor's own contract

The rules that are true of the WRITING SURFACE and of nothing else in the admin. Split out
of [`admin-design.md`](./admin-design.md) on 2026-08-24, when the key-feedback rework put
that file over its 400-line cap.

The seam is real rather than arithmetic. Every other screen in this admin is a form or a
list, and the visual contract next door is written for those: cards, gaps, one setting, one
of each. The editor is the one place that carries a second typeface (it is WYSIWYG, so it
must write in the face it publishes in), a caret this product draws itself, and a sound. Read
that file first; this one only adds what is true here.

## The editor

- The chrome is the SHEET'S OWN top rows (the Writing Desk mock's `sheettop`): the action
  line — back link + save state + word count on the left, quiet Markdown/Attributes text
  controls and the Preview/Save/Publish buttons on the right — is the card's first row, and
  the toolbar sticks directly under it. One piece: a floating band over a crack of page
  between it and the paper is what the owner called "kì kì" (2026-08-17). Never shadowed.
  The global sidebar shows again since the two-pane write screen; the write pane (the list
  column) sits beside the sheet from `xl` up, pinned at the same top as the sheet's chrome.
- The title lives ON the sheet (`SheetTitle`), in the reading face, with the meta line
  (status · last touched) under it. It aligns with the public reading column, wraps
  naturally, and uses content-driven height so a long one is never clipped.
- **The toolbar is BACK, by the owner's verdict after writing on the bare version**
  (2026-08-17, *"ở chế độ bình thường nên có thanh công cụ chứ"* — reversing ADR 0024
  step 4's removal, which the mock had endorsed). It sits at the top of the sheet under the
  action line, full-width, its groups centered, wrapping on a narrow window rather than
  scrolling. The Markdown source view has NO toolbar — raw text needs no formatting
  buttons. The called controls remain beside it: a selection raises the bubble, `/` on an
  empty line raises the insert menu (which prints each block's Markdown shortcut beside
  its row), and the table tools exist only while the cursor is in a table. The closing
  line under the writing says the two gestures once.
- The attributes are a right-hand slide-over (`SlideOver`) over a scrim, never a docked
  column — a column squeezed the writing to make room for the questions. The first Publish
  on an unpublished piece opens it as the publish sheet, footered "Later / Publish".
- The editor frame must NOT use `overflow-hidden` — it breaks the nested sticky bars. The
  table bar's sticky offset is measured from the real action-header height, so it does not
  drift with the viewport or the translation.
- The prose `contenteditable` must not inherit the global focus outline; the surrounding card
  is the boundary. Focus rings stay on discrete controls.
- **Key feedback is a CHOICE OF INSTRUMENT, not a switch** (2026-08-24): `woody`, `crisp`,
  `deep`, `off`. It defaults to `woody`, is stored as `motion.keys`, and migrates BOTH older
  spellings — the pre-2026-08-24 `motion.typewriter` boolean, and the machine names
  (`typewriter` / `tactile` / `linear`) it shipped under until 2026-08-25.
  ⚠️ **The names are not the names of real machines, on purpose.** The synthesis is modelled
  on those three mechanisms and says so at length in `key-voices.ts`, but the owner listened
  and said the honest thing — *"nghe chưa giống đồ thiệt cho lắm... đừng nên gọi tên thiệt,
  vì ko làm giống được"*. A label promising an Underwood and delivering a good synthesised
  knock makes the sound worse by comparison. They are named for what they are. The click is generated locally: no audio files anywhere, ever.
  ⚠️ **The three are three MACHINES, not three filter settings**, and this is the correction
  of 2026-08-25 (*"3 loại tiếng ko khác gì nhau"* — and they did not, because they were one
  noise burst through one bandpass at 1840 / 1144 / 972 Hz). A strike is now a SEQUENCE OF
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
- **How loud it is, is the owner's** (2026-08-25, *"tiếng có vẻ nhỏ"*): `motion.keyVolume`,
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
- **The caret stops blinking while the hands are moving**, and fades rather than switching:
  700ms past the last keystroke before it resumes, 1.2s ease-in-out, and never all the way
  to zero. A blink means "the cursor is here and nothing is happening", and during a burst of
  typing something plainly is.
- Autosave, revisions, preview tokens, media picking, taxonomy and publish behaviour are
  unchanged by any visual pass.
