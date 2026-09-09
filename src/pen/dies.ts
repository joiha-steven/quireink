// The hand behind the pen, in one place to import from.
//
// Three generators, three seeds: the highlighter (`dies-highlight.ts`), the underline and
// the ring (`dies-lines.ts`), the link's dashes (`dies-link.ts`). Each draws from its own
// PRNG stream, so growing or reseeding one gesture can never move a stroke of another —
// the toolkit they share is `dies-kit.ts`, which holds the argument. This file is the
// door the rest of the pen uses, and it re-exports; it draws nothing itself.

export type { Die, DiePath, Fx, PathMode } from '@/pen/dies-kit'
export {
  PEN_SHORT_CHARS, PEN_SHORT_FROM, PEN_VARIANT_COUNT, mulberry, o2, r1, wavy,
} from '@/pen/dies-kit'
export { DIES, PEN_DIE_COUNT, PEN_GRIPS } from '@/pen/dies-highlight'
export type { PenGrip } from '@/pen/dies-highlight'
export {
  RING_DIES, RING_DIE_COUNT, RING_GRIPS, UNDER_DIES, UNDER_DIE_COUNT, UNDER_GRIPS,
} from '@/pen/dies-lines'
export type { RingDie, RingGrip, UnderGrip } from '@/pen/dies-lines'
