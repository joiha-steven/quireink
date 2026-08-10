// The owner's own history, for the Log screen.
//
// Split out of `seed-admin.ts` rather than shortened, and by the same rule that split the
// fixture in the first place: one file per SCREEN's worth of state, not one file per
// hundred lines. `seed-admin.ts` fills the screens that hold the site's content — drafts,
// trash, revisions, the mailing list, redirects. This one fills the screen that holds what
// the owner DID, which is a different kind of fixture and the only one that is a hand-written
// timeline rather than a by-product of writing rows.
//
// Nothing else in the seeder produces a single log entry, and the reason is worth knowing:
// `logActivity` is called by the ROUTE handlers, never by the store functions the seeder
// uses (`grep -rn 'logActivity(' src/` — every hit is under `src/web/`). So a fixture built
// through the store layer is invisible to the log by construction, and the Log page showed
// "No activity yet" on a site with twenty-eight posts in it.

import { logActivity, type ActivityAction } from '@/server/activity'
import { one, run } from '@/store/query'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

/**
 * The timeline, newest LAST.
 *
 * Written in the order things happened because that is the only way to keep the story
 * straight while editing it; the Log screen renders it newest first.
 *
 * `origin` is the fixture's anchor (the newest published post) and `now` is the real clock.
 * They are separate because the last four entries are things that happened to a site that is
 * already live — a send, a spam deletion, a cache clear — and dating those from the anchor
 * puts them before posts they came after.
 */
function entries(origin: number, now: number): [ActivityAction, string, number][] {
  return [
    ['settings.save', '', origin - 250 * DAY],
    ['post.create', 'ink-paper-and-the-colour-between-them', origin - 224 * DAY],
    ['post.create', 'registration-and-the-millimetre', origin - 195 * DAY],
    ['taxonomy.update', 'Printing', origin - 194 * DAY],
    ['post.create', 'a-signature-a-gathering-a-quire', origin - 167 * DAY],
    ['post.create', 'trapping-and-the-black-that-is-not-black', origin - 152 * DAY],
    ['series.update', 'Ink and press · 3 post(s)', origin - 152 * DAY + 2 * HOUR],
    ['post.create', 'imposition-why-page-one-sits-beside-page-eight', origin - 141 * DAY],
    ['media.upload', 'imposition-sheet.png', origin - 141 * DAY + HOUR],
    ['post.create', 'paper-weights-and-the-table-nobody-agrees-on', origin - 130 * DAY],
    ['post.create', 'reading-on-paper-and-glass', origin - 118 * DAY],
    ['post.create', 'der-blocksatz-und-die-luecke', origin - 112 * DAY],
    ['post.create', 'dau-phu-tieng-viet', origin - 104 * DAY],
    ['media.upload', 'nib-angles.png', origin - 96 * DAY],
    ['post.create', 'thu-phap-va-nhip-tho', origin - 96 * DAY + HOUR],
    ['post.create', 'ruling-a-page-before-you-write-on-it', origin - 88 * DAY],
    ['post.create', 'chancery-italic-in-ninety-minutes', origin - 79 * DAY],
    ['post.create', 'uncials-and-the-slow-hand', origin - 71 * DAY],
    ['post.create', 'the-broad-edged-pen', origin - 63 * DAY],
    ['post.create', 'five-inks-and-when-to-reach-for-each', origin - 55 * DAY],
    ['settings.save', '', origin - 55 * DAY + 3 * HOUR],
    ['post.create', 'la-chasse-et-l-approche', origin - 48 * DAY],
    ['post.delete', 'three-weeks-with-a-reed-pen', origin - 40 * DAY],
    ['post.create', 'the-em-the-en-and-three-dashes', origin - 38 * DAY],
    ['post.create', 'die-kunst-der-kapitaelchen', origin - 34 * DAY],
    ['post.create', 'the-measure-is-the-design', origin - 30 * DAY],
    ['media.upload', 'measure-and-return-sweep.png', origin - 30 * DAY + HOUR],
    ['redirect.save', '/the-measure', origin - 30 * DAY + 2 * HOUR],
    ['post.create', 'noktasiz-i-ve-bas-harfin-tuzagi', origin - 27 * DAY],
    ['post.create', 'a-type-scale-you-can-defend', origin - 21 * DAY],
    ['media.upload', 'modular-scale.png', origin - 21 * DAY + HOUR],
    ['redirect.save', '/type-scale', origin - 21 * DAY + 2 * HOUR],
    ['post.create', 'hacek-a-rytmus-ceske-sazby', origin - 16 * DAY],
    ['post.create', 'what-a-subsetter-removes', origin - 13 * DAY],
    ['post.create', 'optical-size-is-not-a-scale', origin - 9 * DAY],
    ['series.update', 'Designing a reading page · 4 post(s)', origin - 9 * DAY + HOUR],
    ['post.create', 'ogonek-nie-jest-przecinkiem', origin - 5 * DAY],
    ['post.update', 'five-inks-and-when-to-reach-for-each', origin - 3 * DAY],
    ['page.create', 'about', origin - 2 * DAY],
    ['post.create', 'the-golden-canon-and-its-arithmetic', origin],
    ['media.upload', 'registration-target.png', origin + HOUR],
    ['newsletter.send', 'the-golden-canon-and-its-arithmetic — 18/20', now - 2 * DAY],
    ['comment.delete', 'PrintDeals (spam)', now - 30 * HOUR],
    ['cache.clear', '', now - 5 * HOUR],
  ]
}

/**
 * Write the timeline.
 *
 * Called after settings are saved, because `logActivity` no-ops when `features.activityLog`
 * is off and the default it reads has to be the fixture's, not the fresh-install one.
 */
export async function seedActivity(origin: number, now: number): Promise<number> {
  const rows = entries(origin, now)
  for (const [action, detail, at] of rows) {
    await logActivity(action, detail)
    // `logActivity` stamps the clock and returns nothing, so the row it just wrote is the
    // highest id in the table — this seeder is the only writer and it is single-threaded.
    const row = one<{ id: number }>(`select max(id) as id from activity_log`)
    if (row?.id != null) run(`update activity_log set at = ? where id = ?`, at, row.id)
  }
  return rows.length
}
