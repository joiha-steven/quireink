// WHAT A RECOVERED SNAPSHOT MAY NOT BRING WITH IT.
//
// A crash snapshot is the writer's WORDS, saved without being asked for. It is not the piece's
// identity, and on a piece that already has a row in the database the difference is the whole
// question: the slug is the published URL, and the date is where the piece sits in the archive.
// A snapshot taken before a rename carries the old slug; restoring it whole renames a published
// post, silently, as the price of getting a paragraph back.
//
// ⚠️ ONE RULE, ONE PLACE, and that is the point of the file rather than a tidiness argument.
// The rule was written three times — once per editor — and the three copies did not agree. The
// post kept its slug AND its date; the note's comment claimed the same rule and the code kept
// only the slug, so restoring a snapshot into a saved note quietly moved its publication date.
// Nothing was red: no unit test reaches a restore, and the tour has no flow that restores into
// a piece that already has a date. Found by reading the three side by side while merging them
// (2026-09-15) and fixed before the merge, so the server-rendered sheet has one behaviour to
// reproduce rather than two to choose between.

/** The fields that belong to the ROW rather than to the draft. */
type Identity = { slug: string; date?: string }

/**
 * The snapshot, with the live piece's identity put back.
 *
 * `hasRow` is false for a piece that has never been saved — there is no identity to protect
 * yet, and the snapshot's own slug is the only one there is.
 *
 * `date` is copied only when the live draft HAS one: a page has no date field, and writing
 * `date: undefined` onto its draft would add a key its type does not carry.
 */
export function withLiveIdentity<T extends Identity>(snapshot: T, live: T, hasRow: boolean): T {
  if (!hasRow) return snapshot
  const kept: T = { ...snapshot, slug: live.slug }
  if (live.date !== undefined) kept.date = live.date
  return kept
}
