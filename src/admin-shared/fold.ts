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

/**
 * The same folding, one character at a time and lowercased — what `src/accent.ts` builds its
 * two lanes from.
 *
 * ⚠️ THE RANGES ARE ESCAPES, exactly as `slugify` writes them, and that is not cosmetic.
 * Spelled with the literal characters, the combining-mark range is a run of bytes that only
 * means U+0300-U+036F to a tool that decodes the file as UTF-8 — one that assumes Latin-1
 * reads it as a reversed range and throws `Range out of order in character class` at parse
 * time, taking the whole module with it. Measured: a bundler that did exactly that killed
 * every export in the file it was in. Escapes are pure ASCII, so no reader can get them
 * wrong, and the parsed regex is byte-for-byte the same one.
 *
 * It sat in `src/utils.ts` until the command palette became an island (ADR 0054, step 6):
 * that module pulls the pen grammar and the maths syntax in behind it, and the palette is on
 * every admin page.
 */
export function foldAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, 'd') // đ, Đ — NFD leaves the stroke, so these survive above
    .toLowerCase()
}
