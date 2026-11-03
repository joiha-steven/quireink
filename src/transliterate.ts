// Alphabets that map cleanly to Latin letters, one lowercase letter at a time, for slugs.
//
// CYRILLIC came with the Russian locale (2026-08-28): a fully-Cyrillic title used to slugify to
// NOTHING and fall back to `post-<timestamp>`, a URL nobody can read aloud. GREEK joined on
// 2026-09-30 for the same reason ("Ωμέγα Ελληνικά" became `post-<clock>`), since ADR 0064 says
// only CJK and emoji should reach that fallback. CJK still does, deliberately: romanizing
// Chinese or Japanese is a judgment call this function has no business making.
//
// Both run AFTER `normalize('NFD')` has taken the accents off (Greek tonos included) and after
// lowercasing, so only the bare lowercase letters need a row.

// BGN/PCGN-style.
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya',
}

// ELOT 743, simplified to one spelling per letter.
const GREEK: Record<string, string> = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k',
  λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't',
  υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
}

const LATIN: Record<string, string> = { ...CYRILLIC, ...GREEK }

/** Every Cyrillic or Greek lowercase letter in the text, in Latin letters. */
export const toLatin = (text: string): string =>
  text.replace(/[α-ωа-яё]/g, (c) => LATIN[c] ?? '')

// ß AND FULL-WIDTH LATIN, which `slugify` used to drop: "Straße" slugged to `strae` and a title in
// full-width letters ("Ｆｕｌｌ") to nothing at all (2026-11-03). ß and ẞ are spelled `ss`; the
// full-width ASCII block and the Latin ligatures (ﬁ, ﬂ) go through NFKC one character at a time.
// Not NFKC over the whole title: that would also turn `™` into `tm` and `²` into `2`, moving slugs
// that come out right today. Escapes, not literal characters, for the reason `admin-shared/fold.ts`
// records.
const WIDE = /[ßẞﬀ-ﬆ！-～]/g

/** ß, ẞ, the Latin ligatures and full-width ASCII, spelled in plain letters. */
export const foldWide = (text: string): string =>
  text.replace(WIDE, (c) => (c === 'ß' || c === 'ẞ' ? 'ss' : c.normalize('NFKC')))

/**
 * The same characters REMOVED, which is what `slugify` did with them before 2026-11-03: the
 * slug a term or series had then, so its old address can 301 to the new one (`taxonomy.ts`).
 */
export const dropWide = (text: string): string => text.replace(WIDE, '')
