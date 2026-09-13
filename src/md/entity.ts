// The HTML5 named character references, as data.
//
// All 2,125 of them, because CommonMark's rule is the whole HTML5 table and nothing less:
// `&copy;` is the character, `&MadeUpEntity;` is the literal text, and a parser carrying a
// shortlist gets the second case wrong for every name it forgot. Seventeen examples in the
// spec are about this and `marked` fails twelve of them.
//
// A `.json` file rather than a TypeScript literal so the 400-line rule does not have to make
// an exception for a table nobody reads: it is generated data, and `src/md/entities.json` is
// exactly the WHATWG list with the semicolon-less legacy spellings dropped — CommonMark
// requires the semicolon, and `&ampfoo` is not an entity.
//
// Regenerate with: curl https://html.spec.whatwg.org/entities.json
import table from './entities.json'

export const ENTITIES: Record<string, string> = table as Record<string, string>

/**
 * Where an `&` in this text would be read as an entity on the way back in.
 *
 * The SERIALIZER'S question, not the parser's. A bare `&` means nothing in Markdown unless it
 * opens a complete reference, so `M&A` needs no backslash — and escaping every one anyway put
 * `M\&A` into 44 of this blog's 92 posts on their first save, a diff in the author's file with
 * no author behind it. `&amp;` does need one, or it resolves to `&` on the next read.
 */
export function entityStarts(text: string): Set<number> {
  const at = new Set<number>()
  const re = /&(?:[A-Za-z][A-Za-z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});/g
  for (let m = re.exec(text); m !== null; m = re.exec(text)) at.add(m.index)
  return at
}

/**
 * Every entity and numeric reference in a string, resolved.
 *
 * Used where a value is NOT inline content and so never reaches the inline parser: a link's
 * URL, a title, a link reference definition. `[link](foo&auml;)` points at `fooä`, and leaving
 * the entity alone sent readers to a URL with a literal `&auml;` in it.
 */
export function resolveEntities(text: string): string {
  return text.replace(
    /&(?:([A-Za-z][A-Za-z0-9]{1,31})|#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6}));/g,
    (whole, name: string | undefined, dec: string | undefined, hex: string | undefined) => {
      if (name) return ENTITIES[name] ?? whole
      const n = dec ? Number(dec) : parseInt(hex!, 16)
      if (n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '\uFFFD'
      return String.fromCodePoint(n)
    },
  )
}
