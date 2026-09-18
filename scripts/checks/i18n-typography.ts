// THE MARKS A LANGUAGE WRITES WITH, held per language rather than per repository.
//
// Every one of these drifted in the same direction and for the same reason: a string holding an
// apostrophe has to be escaped inside single quotes, so whoever wrote it reached for double
// quotes and typed the ASCII `'` — and a file that was 214 apostrophes correct ended up with 21
// that were not. Counted 2026-09-19 before this check existed: French 214 to 21, Italian 103 to
// 16, English 3 to 9, German writing its quotation marks three different ways in one file, and
// six of the eleven languages spelling an ellipsis `...` while the other five spelled it `…`.
//
// None of it breaks a page, which is exactly why it needs a check rather than a note: nothing
// else in this repository would ever go red over it, and a reader of one language only sees the
// wrong mark, never the inconsistency that produced it.
//
// ⚠️ THE LANGUAGE DECIDES, NOT THE AUTHOR. German quotes with „low-high“, French and Russian
// with «guillemets», Japanese with 「corner brackets」. A single rule for the repository would be
// a rule that is wrong in four languages.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** `key: '…'` on one line, which is how every locale file is written. */
const LINE = /^\s{2,}([a-zA-Z][\w]*):\s*(['"`])((?:\\.|(?!\2).)*)\2\s*,?\s*$/gm

/** The pair a language opens and closes a quotation with. */
const QUOTES: Record<string, [string, string]> = {
  de: ['„', '“'],
  // Guillemets, and it is the languages' own preference rather than a French import: Spanish
  // calls them comillas latinas and puts them first, Italian and European Portuguese the same.
  // Counted before this check: es 37 to 0, it 32 to 5, pt 29 to 7 — the minority was drift.
  es: ['«', '»'],
  fr: ['«', '»'],
  it: ['«', '»'],
  pt: ['«', '»'],
  ru: ['«', '»'],
  ja: ['「', '」'],
}
/** English, Vietnamese, Korean and Chinese: the curly pair. */
const DEFAULT_QUOTES: [string, string] = ['“', '”']

/**
 * Strings whose content is typed into somebody else's interface, character for character.
 *
 * `commentsGoogleHelp` names the OAuth client type as Google spells it on the button — "Web
 * application", with the straight quotes that are part of quoting a literal value. Curling them
 * would be correcting a quotation nobody asked us to correct.
 */
const LITERALS = new Set(['commentsGoogleHelp'])

type Fault = { file: string; key: string; says: string; found: string }

const faults: Fault[] = []
const files: string[] = []
for (const dir of ['locales', 'locales/admin']) {
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.ts') || name === 'langs.ts' || name === 'types.ts') continue
    files.push(join(dir, name))
  }
}

for (const file of files) {
  const lang = file.slice(file.lastIndexOf('/') + 1, -3)
  const [open, close] = QUOTES[lang] ?? DEFAULT_QUOTES
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(LINE)) {
    const key = m[1] ?? ''
    // The raw value with its escapes resolved: `\'` inside double quotes is one apostrophe.
    const value = (m[3] ?? '').replace(/\\'/g, "'").replace(/\\"/g, '"')
    const at = (found: string, says: string) => faults.push({ file, key, says, found })

    // An apostrophe between letters is a contraction or an elision, and every language that has
    // one spells it `’`. A pair of straight quotes around a phrase is a quotation, caught below.
    if (/\w'/.test(value) && !/(^|[\s([])'[^']{1,60}'($|[\s.,;:!?)\]])/.test(value)) {
      at("'", 'an apostrophe is ’')
    }
    if (!LITERALS.has(key)) {
      if (value.includes('"')) at('"', `quotes here are ${open} ${close}`)
      // Marks from another language's convention: German quotes appearing in Italian, say.
      for (const [other, [oOpen]] of Object.entries(QUOTES)) {
        if (other === lang) continue
        if (value.includes(oOpen) && oOpen !== open) at(oOpen, `that mark belongs to ${other}, this is ${lang}`)
      }
      if (!(lang in QUOTES) && /[“”]/.test(value)) {
        // The default pair IS “ ”, so this only fires when one half is missing its partner.
        const opens = (value.match(/“/g) ?? []).length
        const closes = (value.match(/”/g) ?? []).length
        if (opens !== closes) at('“”', 'one half of a pair is missing')
      }
    }
    // `https://...` is an address cut short, not a sentence trailing off.
    if (/(?<![./])\.\.\.(?!\.)/.test(value)) at('...', 'an ellipsis is …')
  }
}

if (faults.length > 0) {
  console.error(`✗ check:i18n-typography: ${faults.length} string(s)`)
  for (const f of faults.slice(0, 20)) {
    console.error(`  - ${f.file} ${f.key}: ${f.says} (found ${f.found})`)
  }
  if (faults.length > 20) console.error(`  … and ${faults.length - 20} more`)
  process.exit(1)
}
console.log(`✓ check:i18n-typography: ok (${files.length} file(s), ${Object.keys(QUOTES).length + 1} convention(s))`)
