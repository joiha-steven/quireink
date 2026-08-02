// The CSS sheets are each ONE template literal, so a backtick anywhere inside one ends the
// string. It happened three times in `public.css.ts`, always in a comment, always around a
// CSS property name that reads naturally in backticks. Twice the server refused to boot;
// the third time the type checker caught it with two errors pointing at a line that looked
// fine.
//
// A comment saying "no backticks" was already in the file when it happened the third time,
// which is the argument for this being a check instead.

import { readdirSync, readFileSync } from 'node:fs'

// The sheets are DISCOVERED, not listed, and that is the whole point of this block.
//
// A hand-kept list went stale three times. The public sheet was split in two and renamed,
// and the check kept passing against a constant that no longer existed: the fourth backtick
// got through. Then `prose.css.ts` was split out carrying the warning "NO BACKTICKS anywhere
// below: check:css-literal enforces that" in its own header and was never added here, so the
// fifth got through on 2026-07-29 while the check reported ok and the server refused to boot.
// Then `front.css.ts` and `utility.css.ts` shipped unlisted, and the sixth was caught by the
// type checker instead — the guard reported "ok (6 sheets)" against a file it had never read.
//
// A rule that has to be remembered in a second file at the same time as the first one is
// written is a rule that gets forgotten, so the list is now the directory.
const SHEET_DIR = 'src/web'
const SHEETS = readdirSync(SHEET_DIR)
  .filter((name) => name.endsWith('.css.ts'))
  .map((name) => `${SHEET_DIR}/${name}`)
  .sort()

if (SHEETS.length === 0) {
  console.error(`✗ check:css-literal: no *.css.ts found in ${SHEET_DIR}/, which cannot be right`)
  process.exit(1)
}

let failed = false

for (const file of SHEETS) {
  const source = readFileSync(file, 'utf8')

  // Anchored on the declaration, NOT on the first backtick in the file: the module's own
  // doc comment contains several, and the first version of this check reported them and
  // failed on a clean file. A guard that cries wolf gets switched off.
  //
  // The FIRST such declaration, which is what makes `public.css.ts` work: it opens with
  // BASE_CSS and then exports PUBLIC_CSS as an interpolation of it, so anchoring on the last
  // one would scan a two-line string and miss the sheet entirely.
  const declAt = source.search(/(?:^|\n)(?:export )?const \w*CSS\w* = `/)
  const open = declAt === -1 ? -1 : source.indexOf('`', declAt)
  // The CLOSE is the terminator that follows the opener, not the last backtick in the
  // file: public.css.ts now ends with an interpolated export, so the last backtick sits
  // past the sheet and the scanned range came out empty.
  // Some sheets close with .trim() and some with a bare backtick opening a line.
  const ends = [source.indexOf('`.trim()', open + 1), source.indexOf('\n`', open + 1)]
    .filter((i) => i !== -1)
  const close = open === -1 || ends.length === 0 ? -1 : Math.min(...ends)
  if (open === -1 || close === -1) {
    console.error(`✗ check:css-literal: ${file} does not look like one template literal any more`)
    failed = true
    continue
  }

  const body = source.slice(open + 1, close)
  if (body.includes('`')) {
    const line = source.slice(0, open + 1 + body.indexOf('`')).split('\n').length
    console.error(`✗ check:css-literal: backtick inside the CSS literal, ${file}:${line}`)
    console.error('  It ends the string. Write the property name without backticks.')
    failed = true
  }

  // A comment that never opened. `ide.css.ts` carried a paragraph of prose with a closing
  // `*/` and no `/*`, so the browser read the prose as a selector, could not parse it, and
  // discarded the whole rule that followed: seven selectors that were supposed to darken
  // every count and date under the IDE chrome never applied, for as long as the switch has
  // existed. Nothing failed, nothing logged, and the sheet looked fine in the editor —
  // which is the argument for counting them here.
  const opens = (body.match(/\/\*/g) ?? []).length
  const closes = (body.match(/\*\//g) ?? []).length
  if (opens !== closes) {
    console.error(`✗ check:css-literal: unbalanced comments in ${file}`)
    console.error(`  ${opens} opening /* against ${closes} closing */.`)
    console.error('  An unopened comment is parsed as a selector and takes the next rule with it.')
    failed = true
  }
}

if (failed) process.exit(1)
console.log(`✓ check:css-literal: ok (${SHEETS.length} sheet(s))`)
