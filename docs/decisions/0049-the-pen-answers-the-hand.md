# 0049 — The pen answers the hand

Date: 2026-09-09
Status: accepted

## Context

The editor already answers a keystroke: a click made on the spot in one of three
instruments, a caret that holds still while the hands move, and a rule written in blood
that nothing animates the words (`docs/admin-editor.md`, 2026-08-24). Applying a mark
answered with nothing. Select words, press the highlighter, and the stroke is simply there,
fully drawn, as if it had always been — which is exactly what a pen does not do.

The last step of the pen programme asked for two things: the stroke should draw itself when
it is applied, about 200 ms, and a felt tip should be able to squeak.

## Decision

**A mark just applied draws itself, once.** The pen sheet paints a stroke as a background
under the words; the editor grows that background from nothing to its width — 200 ms for
the highlighter, 160 for the underline, 240 for the ring, which has three pieces and comes
in from both ends. The mechanism is the seam the key feedback established: nothing enters
the document. `pen-feedback.ts` notices the transaction that added the mark, finds the
elements it became, and puts a class on them for a beat; the stylesheet does the rest. An
existing mark never replays, a document opening full of marks does not sweep, typing inside
a mark does nothing, and if ProseMirror redraws the node mid-beat the class goes with it and
nothing is the worse. The words do not move at any point: only the ink under them arrives.
The two motion gates (the owner's switch, the OS preference) zero it like every animation.

**A felt tip squeaks, on the switch the owner already has.** The squeak is rendered as
arithmetic like the key click — noise through a resonant band-pass whose centre glides,
under an envelope with the stick-slip flutter on it — three takes per gesture, no audio file.
Three shapes: the highlighter rises as the hand speeds up; the underline is short and nearly
flat, a pencil rather than felt; the ring goes up and comes back down around the word. It is
one setting, `motion.penSqueak`, on by default, and it is heard only while an instrument is
chosen and the slider is above zero: the instrument and the volume are the owner's one answer
about sound, and the pen rides them rather than asking twice. Held at 0.45 of a key, because
it sits in the ear's loudest octave and lasts five times as long.

## Consequences

- One setting, one class, three keyframes, two files beside the key feedback's, and a test
  that measures the squeak's band, its rise, its fall and its silence rather than describing
  them.
- The squeak shares the key click's context and ceiling, so two sounds landing together are
  limited once, not twice.
- The reading site is untouched: a reader's pen (0043) draws its marks the moment they are
  made and asks for nothing more; this is the writer's desk answering the writer.
- The pen programme is complete: the module (0042), the reader's pen (0043), the notebook
  (0044), its door (0045), the open standards (0046), the code (0047), the sheet (0048), and
  now the desk.
