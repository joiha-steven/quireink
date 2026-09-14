// The entity decoder, in a file of its own.
//
// It lived in `convert.ts` until `html-parse.ts` needed it, and `convert.ts` needs the parser:
// two modules that import each other work until the day one of them grows a top-level constant
// that reads the other. A leaf has no such day.
//
// Numeric references and a short list of named ones, run TWICE. Twice is not belt and braces:
// WordPress exports routinely carry `&amp;amp;` where a plugin encoded an already-encoded
// string, and one pass leaves `&amp;` on the page.
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
}
export function decodeEntities(s: string): string {
  let out = s
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 10)))
      .replace(/&([a-z]+);/gi, (m, name: string) => NAMED[name.toLowerCase()] ?? m)
  }
  return out
}
