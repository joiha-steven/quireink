// The posts the showcase fixture is built from: the shape of a seeded post and the order they
// arrive in. The words are in the six siblings.
//
// ONE SUBJECT: letterforms and the making of pages. A demo that wanders across five topics
// reads as filler; one that stays on a subject reads as a real publication, and this one can
// talk about the thing the reader is looking at while they look at it.
//
// SEVERAL LANGUAGES, on purpose. The bundled subsets cover latin, latin-ext and vietnamese, so
// tone marks, umlauts, ogoneks, hačeks, dotless i and eth all render in the real face. CJK
// joined them on 2026-08-15 — nothing CJK is SHIPPED, which was the real constraint and has
// not moved; the stacks now name PingFang, Hiragino, Yu Mincho and the Notos before the
// generic, so CJK lands in a decided face at zero download (`seed-content-cjk.ts`).
//
// ONE LINE PER PARAGRAPH: the renderer turns a single newline into a `<br>`.
//
// EVERY POST EARNS ITS PLACE BY SHOWING SOMETHING. This fixture is the only thing a visitor to
// demo.quireink.com sees, so a renderer feature absent from it is one the demo claims and
// never proves. It went up with no code fence and no table anywhere, which is how a site that
// renders maths, code and tables came to look like a site that renders paragraphs.
//
// THE SPLIT IS BY CATEGORY, except `-intl` and `-cjk` (by LANGUAGE, since those posts exist to
// prove the subsets) and `-page` (by SERIES). Everything splits at the 400-line cap.

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
import { PAGE_POSTS } from './seed-content-page'
import { HAND_POSTS } from './seed-content-hand'
import { PRESS_POSTS } from './seed-content-press'
import { INTL_POSTS } from './seed-content-intl'
import { CJK_POSTS } from './seed-content-cjk'

/**
 * Every published post in the fixture, newest first once sorted by `ago`.
 *
 * The seeder does not sort — it walks this array and subtracts `ago` days from the same
 * origin for each — so the order here is presentation order in nothing at all. What matters
 * is that no two posts share an `ago`, because two posts on the same timestamp make the
 * listing's order depend on SQLite's tie-breaking rather than on the fixture.
 */
export const POSTS: Seed[] = [...TYPE_POSTS, ...PAGE_POSTS, ...HAND_POSTS, ...PRESS_POSTS, ...INTL_POSTS, ...CJK_POSTS]

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
