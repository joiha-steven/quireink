// Accent-folding, for every search the admin does over its own words.
//
// It sat in `admin/components/settings-index.ts` until the log screen became server-rendered
// HTML (ADR 0054): the server folds the haystack once, into `data-find`, and the island folds
// the needle on each keystroke. Two implementations of "which letters count as the same
// letter" is a search box that finds a row on one face and not the other.
//
// `đ` by hand, because it is not a composed character: `NFD` leaves it whole, so the stroke
// never decomposes and a query for `dong` would miss `đông` on a Vietnamese install.
/**
 * Fold accents away so a Vietnamese owner can type without them.
 *
 * Typing "be rong" for "Bề rộng" is what people actually do — it is faster than reaching for
 * tone marks, and every Vietnamese search box on the planet accepts it. NFD splits a letter
 * from its marks and the range strips the marks; `đ` is not a combining pair and has to be
 * replaced on its own.
 */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim()
}
