// HOW MANY ROWS THE WRITE COLUMN PUTS ON SCREEN AT ONCE.
//
// Both sides read it: the server hides everything past the first page so the first paint is
// already short, and the island reveals another page each time the foot of the list comes into
// view. Two numbers would mean the server drew 100 and the island thought it had drawn 80.
//
// ⚠️ IT IS A REVEAL, NOT A FETCH, and that is the whole design. Every piece is in the page —
// `docs/admin-one-dom.md` and `island/lib/write-filter.ts` both insist on it, because the
// search, the two filter rows and the sort are node moves rather than requests. A column that
// held only the rows it had fetched would have a search box that searched the rows it happened
// to have, which is worse than a long list. So the browser is spared the LAYOUT and the PAINT
// of a thousand rows, and the owner's search still reads every one of them.
export const WRITE_PAGE = 100

/**
 * HOW MANY PIECES ONE BULK REQUEST MAY NAME.
 *
 * Both sides read it, for the same reason `WRITE_PAGE` is shared: the route refuses past this
 * number, and the column that draws the key is the one that decides how many go in a request.
 * Two numbers would mean a control that fires a request its own server refuses, and the owner
 * would meet that as a red toast after doing the work of selecting.
 *
 * It is a ceiling on ONE REQUEST rather than on one press. A selection larger than this is sent
 * in runs of this size — three requests for six hundred pieces, where the per-piece way this
 * replaced was six hundred. The point of the route was never "exactly one request"; it was that
 * the count stops being the number of things the owner ticked.
 *
 * 200 is well past the hundred rows `WRITE_PAGE` reveals, so reaching it means the owner
 * scrolled and kept going. What it protects is a single thread: every piece is a read, a write
 * and an index update, and the key would otherwise sit there looking stuck.
 */
export const BULK_MAX = 200
