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
