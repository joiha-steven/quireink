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
