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
import { TYPE_ROLES as ENGINE_ROLES } from '../../src/content/fonts'
import { PROMISED_ATTRIBUTES, PROMISED_NAMES, PROMISED_SELECTORS, PROMISED_VARS, TYPE_ROLES } from '../../src/content/appearance-contract'

const DOC = 'docs/appearance.md'

/** Everything that can emit a variable or a class onto a public page. */
const SOURCE_DIRS = ['src/web', 'src/render', 'src/pen', 'src/content', 'src/assets/js']

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


/**
 * Every name the admin puts at the top of a tab or a card, from the English dictionary.
 *
 * Read from the locale rather than from the components: a card's title is `t.cardShape`, so
 * the STRING a reader sees only exists here, and this is the same file a translator edits.
 */
/**
 * Which cards live on which tab, as the admin actually renders them.
 *
 * A set of names is not enough: "Site → Layout & menu" uses two labels that both exist and
 * still sends the owner to the wrong tab, which is precisely the failure this check was
 * written for — the settings were reorganised and the map was not. So the map is a map.
 *
 * ONE source since the screen became a page (ADR 0054): `src/web/admin/screens/settings-<tab>.ts`,
 * one file per tab, each drawing its cards with `panelCard({ title: t.cardX })` or
 * `connectionCard({ title: t.cardX })`. It read two React files before that — `SettingsView.tsx`
 * for five tabs rendered inline and `Settings<X>Tab.tsx` for three more — and both are gone.
 */
const TABS: Map<string, Set<string>> = (() => {
  const en = readFileSync('locales/admin/en.ts', 'utf8')
  const value = (key: string): string | null => {
    const m = new RegExp(`^\\s*${key}: '([^']+)',`, 'm').exec(en)
    return m ? m[1]! : null
  }
  const titles = (src: string): Set<string> => {
    const out = new Set<string>()
    // `panelCard({ title: t.cardX })` and `connectionCard({ title: t.cardX })`, which is how
    // every card on every tab names itself now.
    for (const m of src.matchAll(/\btitle: t\.(\w+)/g)) {
      const v = value(m[1]!)
      if (v) out.add(v.toLowerCase())
    }
    return out
  }
  const byKey = new Map<string, Set<string>>()
  const dir = 'src/web/admin/screens'
  for (const f of readdirSync(dir)) {
    // `settings-blog.ts`, not `settings-appearance-theme.ts`: a tab is one file, and the ones
    // split out of it are read through their own tab's file below.
    const m = /^settings-([a-z]+)\.ts$/.exec(f)
    if (!m || m[1] === 'shell' || m[1] === 'safety') continue
    const own = readFileSync(join(dir, f), 'utf8')
    // A tab that split its cards into helper files imports them; read those too, so a card
    // moved out of the tab's own file does not disappear from this map.
    const extra = [...own.matchAll(/from '@\/web\/admin\/screens\/(settings-[a-z-]+)'/g)]
      .map((x) => join(dir, `${x[1]!}.ts`))
      .filter((path) => existsSync(path))
      .map((path) => readFileSync(path, 'utf8'))
    byKey.set(m[1]!, titles([own, ...extra].join('\n')))
  }
  // Keyed by the LABEL a reader sees ("Search & URLs"), not by the internal id ("seo").
  const out = new Map<string, Set<string>>()
  for (const [key, cards] of byKey) {
    const label = value(`tab${key[0]!.toUpperCase()}${key.slice(1)}`)
    if (label) out.set(label.toLowerCase(), cards)
  }
  return out
})()

const fail: string[] = []

/** `header.site` and `html.dark` are written with their tag; markup and sheets only carry the bare word. */
/**
 * The name as a whole word. A plain `includes` let `.fc` be satisfied by `.fc-lead` and `.toc`
 * by `.toc-end`, so a name could vanish while a longer cousin kept the check green.
 */
const hasWord = (text: string, word: string): boolean =>
  new RegExp(`(?<![\\w-])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(text)

const bare = (selector: string): string => selector.replace(/^[a-z]+\./, '').replace(/^[.#]/, '')

// --- 3, first: a guard with nothing to check is not a passing guard --------------------
// The floors are the counts at the time of writing, so a list that quietly loses a group of
// names fails here instead of passing with less. Raise them when names are added.
const varTotal = PROMISED_VARS.reduce((n, g) => n + g.vars.length, 0)
if (varTotal < 47 || PROMISED_SELECTORS.length < 100 || PROMISED_ATTRIBUTES.length < 5) {
  fail.push(
    `the contract has ${varTotal} variables, ${PROMISED_SELECTORS.length} selectors and `
    + `${PROMISED_ATTRIBUTES.length} attributes; fewer than 47, 100 and 5 cannot be right`,
  )
}
// The type-role list in the contract is hand-kept; the engine's is the truth.
if (TYPE_ROLES.map(([r]) => r).join() !== ENGINE_ROLES.join()) {
  fail.push(`the contract's type roles (${TYPE_ROLES.map(([r]) => r).join(' ')}) differ from the engine's (${ENGINE_ROLES.join(' ')})`)
}
// Every selector says where it is drawn, and every surface is in use: a theme API with no
// front-page names, or none shared, has lost a group rather than found it unnecessary.
const SURFACES = ['blog', 'front', 'shared']
for (const s of PROMISED_SELECTORS) {
  if (!SURFACES.includes(s.surface)) fail.push(`${s.name} has surface "${String(s.surface)}", not one of ${SURFACES.join(', ')}`)
}
for (const surface of SURFACES) {
  if (!PROMISED_SELECTORS.some((s) => s.surface === surface)) fail.push(`no selector is on the "${surface}" surface`)
}
{
  const seen = new Set<string>()
  for (const n of PROMISED_NAMES) {
    if (seen.has(n)) fail.push(`${n} is listed twice in the contract`)
    seen.add(n)
  }
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
  const needle = name.startsWith('--') || name.startsWith('data-') ? name : bare(name)
  if (!hasWord(code, needle)) {
    fail.push(`${name} is promised in the contract but appears nowhere in ${SOURCE_DIRS.join(', ')}`)
  }
}

// --- 2: the doc and the module say the same thing --------------------------------------
const doc = existsSync(DOC) ? readFileSync(DOC, 'utf8') : ''
for (const name of PROMISED_NAMES) {
  if (!hasWord(doc, name)) fail.push(`${name} is in the contract but not in ${DOC}, which is what users read`)
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

// The class section the same way: a backticked class in the doc's list must be in the
// contract. `header.site` is compared by its bare word, like the check above.
const classFrom = doc.indexOf('### The class names that are safe to target')
const attrFrom = doc.indexOf('### The attributes that are safe to select on')
if (attrFrom === -1) fail.push(`${DOC} has no "The attributes that are safe to select on" section`)
if (classFrom !== -1 && attrFrom > classFrom) {
  const known = new Set(PROMISED_SELECTORS.map((s) => bare(s.name)))
  for (const m of doc.slice(classFrom, attrFrom).matchAll(/`([^`]+)`/g)) {
    for (const c of m[1]!.matchAll(/[.#][A-Za-z][\w-]*/g)) {
      if (!known.has(bare(c[0]))) fail.push(`${c[0]} is offered in ${DOC} but is not in the contract, so nothing guards it`)
    }
  }
  for (const m of doc.slice(attrFrom).split('\n## ')[0]!.matchAll(/`(data-[a-z-]+)/g)) {
    if (!PROMISED_ATTRIBUTES.some((a) => a.name === m[1])) fail.push(`${m[1]} is offered in ${DOC} but is not in the contract, so nothing guards it`)
  }
}

// --- 4: the knob table points at screens that exist -----------------------------------
//
// `docs/appearance.md` opens with "the knobs, roughly in the order they change a first
// impression", and its second column tells the owner where to click. CLAUDE.md calls that
// page "the OWNER's map of every knob" and "a promise to users: update it in the same
// commit".
//
// The promise broke without anyone noticing. Settings were reorganised — the code even says
// so, "LAYOUT — where things sit; split out of Site, which had no reason to hold both" — and
// the map stayed where it was. On 2026-08-31 EIGHT of the eleven distinct paths in that
// table named a screen that does not exist: Appearance → Homepage (it is Layout → Front
// page), Appearance → Type (Font, or Text sizes), Appearance → Colour, Appearance → Images,
// Appearance → Reading, Appearance → Brand. A reader following the first thing on the page
// went looking for cards nobody had shipped in months.
//
// Deliberately narrow. A general "check every arrow in every doc" pass was written first and
// produced thirteen findings of which three were real — the rest were Synology's menus and
// prose that happened to contain an arrow. A guard that cries wolf gets switched off, so
// this one reads ONE table and nothing else.
const TABLE_END = doc.indexOf('### About the table settings')
const tableFrom = doc.indexOf('| Setting | Where | What moves |')
if (tableFrom === -1 || TABLE_END === -1) {
  fail.push(`${DOC} no longer opens with the knob table this check reads`)
} else {
  const rows = doc.slice(tableFrom, TABLE_END).split('\n').filter((l) => l.startsWith('|'))
  let paths = 0
  for (const row of rows) {
    const where = row.split('|')[2]?.trim()
    if (!where || !where.includes('→')) continue
    paths++
    const [tab, card] = where.split('→').map((x) => x.trim().replace(/\*\*/g, '').toLowerCase())
    const cards = TABS.get(tab!)
    if (!cards) {
      fail.push(`${DOC}: the knob table sends the owner to "${where}", and no settings tab is called "${tab}"`)
    } else if (card && !cards.has(card)) {
      fail.push(`${DOC}: the knob table sends the owner to "${where}", but that tab has no card called "${card}"`)
    }
  }
  // The table is not the only place this page gives directions. "Appearance → Advanced →
  // Custom CSS" sat in the prose for months naming a step that has never existed, and it was
  // found by a reader going to look for it. Same rule, applied to the bold paths in THIS file
  // only — a general sweep of every arrow in every doc was tried and was mostly Synology's
  // menus.
  for (const m of doc.matchAll(/\*\*([A-Z][^*\n]*?→[^*\n]*?)\*\*/g)) {
    const steps = m[1]!.split('→').map((x) => x.trim().replace(/[.,:;]$/, '').toLowerCase())
    const cards = TABS.get(steps[0]!)
    if (!cards) continue // not a settings path; the page also says things like "Reader → tap"
    paths++
    for (const step of steps.slice(1)) {
      if (cards.has(step)) continue
      fail.push(`${DOC}: "${m[1]}" names "${step}", which is not a card on that tab`)
      break
    }
  }

  if (paths < 10) fail.push(`${DOC}: only ${paths} knob paths found; the table must have moved`)
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

console.log(
  `✓ check:appearance-contract: ok (${varTotal} variable(s), ${PROMISED_SELECTORS.length} selector(s), `
  + `${PROMISED_ATTRIBUTES.length} attribute(s))`,
)
