// The posts the showcase fixture is built from: the shape of a seeded post, and the order
// they arrive in. The words themselves are in the four siblings.
//
// ONE SUBJECT: letterforms and the making of pages. Calligraphy, type, layout, printing, and
// nothing else. A demo whose posts wander across five topics reads as filler; a demo that
// stays on one reads as a real publication, and this one can talk about the thing the reader
// is looking at while they look at it.
//
// SEVERAL LANGUAGES, on purpose. The bundled subsets cover latin, latin-ext and vietnamese
// (`src/render/font-faces.ts`), so Vietnamese tone marks, German umlauts, Polish ogoneks,
// Czech hačeks, Turkish dotless i and Icelandic eth all render in the real face. CJK is
// deliberately absent: no bundled subset carries it, so it would fall back to a system font
// and demonstrate the opposite of the point.
//
// ONE LINE PER PARAGRAPH. The renderer turns a single newline into a `<br>`, so prose typed
// at 90 columns comes out ragged.
//
// EVERY POST EARNS ITS PLACE BY SHOWING SOMETHING. The fixture is the only thing a visitor
// to demo.quireink.com ever sees, so a renderer feature absent from it is a feature the demo
// claims and never proves. It went up with four highlights, three footnotes, one callout and
// one equation across eighteen posts — no code fence and no table anywhere — which is how a
// site that renders maths, code, tables and five callout types came to look like a site that
// renders paragraphs. The posts added since are each written around a gap in that list.
//
// THE SPLIT IS BY CATEGORY, and the fourth file is the exception: `-intl` is by LANGUAGE,
// because its four posts exist to prove the latin-ext subsets and their categories are
// incidental. The other three split at the 400-line cap `check:filesize` enforces, which one
// file of twenty-eight posts cannot stay under.

export type Seed = {
  title: string
  slug: string
  excerpt: string
  category: string
  tags: string[]
  /** Days before the newest post. Irregular on purpose: a real archive is not a metronome. */
  ago: number
  body: string
  series?: string
  order?: number
}

import { TYPE_POSTS } from './seed-content-type'
import { HAND_POSTS } from './seed-content-hand'
import { PRESS_POSTS } from './seed-content-press'
import { INTL_POSTS } from './seed-content-intl'

/**
 * Every published post in the fixture, newest first once sorted by `ago`.
 *
 * The seeder does not sort — it walks this array and subtracts `ago` days from the same
 * origin for each — so the order here is presentation order in nothing at all. What matters
 * is that no two posts share an `ago`, because two posts on the same timestamp make the
 * listing's order depend on SQLite's tie-breaking rather than on the fixture.
 */
export const POSTS: Seed[] = [...TYPE_POSTS, ...HAND_POSTS, ...PRESS_POSTS, ...INTL_POSTS]

/**
 * The two series, and the parts they run over.
 *
 * Stated here rather than left implicit in the posts because a series is the one piece of
 * metadata whose ORDER is a claim about time: part 2 published before part 1 reads as a
 * mistake, and the fixture made exactly that mistake for its first two releases. Both series
 * below run oldest part first, so the newest post in a series is its latest instalment.
 */
export const SERIES = {
  reading: 'Designing a reading page',
  press: 'Ink and press',
} as const
