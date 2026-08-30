// Guard #9: the promise custom CSS is written against still describes the software.
//
// This product ships no themes, so when the 155 knobs run out the answer is the owner's own
// stylesheet — and `docs/appearance.md` promises them a set of variable names and class names
// that "will not be renamed without a note in the changelog". Until 2026-08-31 nothing read
// that list. Renaming a variable or a class would have broken every custom stylesheet in the
// wild, silently, on somebody else's blog, with eight guards and 2448 tests all green.
//
// Three ways it can rot, and all three fail here:
//
//   1. A promised name DISAPPEARS from the code. The contract is now a lie.
//   2. The doc and `src/content/appearance-contract.ts` DRIFT. Whichever a reader trusts,
//      one of them is wrong — and the doc is the one users read, so both directions matter.
//   3. The list goes EMPTY, or the files move. Then this check passes vacuously, which is
//      how `check:css-literal` went quietly dead twice (see its header). Counted and
//      asserted, not assumed.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PROMISED_NAMES, PROMISED_SELECTORS, PROMISED_VARS } from '../../src/content/appearance-contract'

const DOC = 'docs/appearance.md'

/** Everything that can emit a variable or a class onto a public page. */
const SOURCE_DIRS = ['src/web', 'src/render', 'src/content', 'src/assets/js']

/**
 * ⚠️ THE CONTRACT ITSELF IS NOT EVIDENCE THAT THE CONTRACT HOLDS.
 *
 * `appearance-contract.ts` lives in `src/content`, which is one of the directories scanned
 * below — so on the first cut of this file every promised name was found in the very list
 * being checked, and the guard passed no matter what the rest of the code did. Renaming
 * `.author-box` everywhere it is actually used left it green. Found by trying to break it,
 * which is the only way this kind of blindness is ever found.
 */
const NOT_EVIDENCE = 'appearance-contract.ts'

function sources(): string {
  let out = ''
  for (const dir of SOURCE_DIRS) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts') || f.includes('.test.') || f === NOT_EVIDENCE) continue
      out += readFileSync(join(dir, f), 'utf8') + '\n'
    }
  }
  return out
}

const fail: string[] = []

// --- 3, first: a guard with nothing to check is not a passing guard --------------------
if (PROMISED_VARS.length === 0 || PROMISED_SELECTORS.length === 0) {
  fail.push('the contract lists no variables or no selectors, which cannot be right')
}
if (!existsSync(DOC)) fail.push(`${DOC} is missing — the promise has no text`)

const code = sources()
if (code.length < 10_000) {
  fail.push(`read only ${code.length} bytes of source; the directories must have moved`)
}

// --- 1: every promised name still exists ----------------------------------------------
//
// A variable is looked for as `--name`, which appears wherever it is declared or read. A
// selector is looked for by its bare word, because markup writes `class="prose"` while a
// sheet writes `.prose` — matching the bare word finds both and cannot miss a rename, which
// is the only thing this is for.
for (const name of PROMISED_NAMES) {
  const needle = name.startsWith('--') ? name : name.replace(/^[.#]/, '').replace(/^header\.|^footer\./, '')
  if (!code.includes(needle)) {
    fail.push(`${name} is promised in the contract but appears nowhere in ${SOURCE_DIRS.join(', ')}`)
  }
}

// --- 2: the doc and the module say the same thing --------------------------------------
const doc = existsSync(DOC) ? readFileSync(DOC, 'utf8') : ''
for (const name of PROMISED_NAMES) {
  if (!doc.includes(name)) fail.push(`${name} is in the contract but not in ${DOC}, which is what users read`)
}

// And the other direction, so a name added to the prose alone cannot become a promise
// nobody guards. Only the fenced block is scanned: the doc's prose mentions variables in
// passing, and a mention is not a promise.
const from = doc.indexOf('### The variables that are safe to set')
const to = doc.indexOf('### The class names that are safe to target')
if (from === -1 || to === -1) {
  fail.push(`${DOC} no longer has the two sections this check reads`)
} else {
  const promisedVars = new Set(PROMISED_NAMES)
  for (const m of doc.slice(from, to).matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
    if (!promisedVars.has(m[1]!)) {
      fail.push(`${m[1]} is offered in ${DOC} but is not in the contract, so nothing guards it`)
    }
  }
}

if (fail.length > 0) {
  console.error(`✗ check:appearance-contract: ${fail.length} problem(s)`)
  for (const f of fail) console.error(`  - ${f}`)
  console.error('')
  console.error('  This list is what custom CSS is written against, and this product has no')
  console.error('  themes — it is the only way an owner can go past the settings. Renaming a')
  console.error('  name here breaks stylesheets on blogs you will never see. Keep the name, or')
  console.error('  retire it in src/content/appearance-contract.ts, docs/appearance.md and the')
  console.error('  changelog together.')
  process.exit(1)
}

const varCount = PROMISED_VARS.reduce((n, g) => n + g.vars.length, 0)
console.log(`✓ check:appearance-contract: ok (${varCount} variable(s), ${PROMISED_SELECTORS.length} selector(s))`)
