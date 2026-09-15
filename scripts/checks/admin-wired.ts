// Guard #12: every control the admin DRAWS has something that hears it.
//
// THE FAULT THIS EXISTS FOR. ADR 0054 made each admin screen server-rendered HTML with a
// `data-x` hook on every control, and a small island that wires the hooks. The two halves live
// in different directories and nothing joined them, so a screen could ship with its markup
// finished and its island never written — and what the owner then has is a button that does
// nothing when pressed. No error, no toast, no request, no console line. Every test passes,
// because a test asserts markup or asserts a function, and the missing thing is the join.
//
// It was not one slip. On 2026-09-15 a sweep found the MCP card could not mint, copy, revoke or
// refresh a token; the WordPress importer could not choose a file or start; the custom font
// upload, the Home tab's four editable lists, Clear cache, the keystroke-sound preview and the
// write column's trash key were all inert. `docs/spec/07-parity-admin.md` lists most of them as
// shipped features. The admin is the area a type error cannot see (ADR 0006), and this is the
// join a type error cannot see either.
//
// WHAT IT READS. Every `data-*` hook written in `src/web/admin`, against every name mentioned
// anywhere in the islands (`src/admin`, `src/admin-shared`, `src/assets/js`) and in the built
// stylesheet, and against the tour's flows — a marker the tour steers by is a hook with a
// reader, even though nothing in the product reads it.
//
// ⚠️ EVERY HOOK, NOT THE ONES INSIDE A `<button …>` — and the first cut of this guard made
// exactly that mistake. It matched `<button[^>]*` and read the hooks out of the tag text, which
// misses every screen that passes the hook IN: `settings-home.ts` builds its list keys through
// a local `key(label, mark, attr, off)` helper, so `data-featured-up` and `data-featured-remove`
// live in the CALLER's string and never appear inside a tag. Five dead controls were invisible
// to the guard written to find them, on the first run, in the file that had the most of them.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SCREENS = 'src/web/admin'
const ISLANDS = ['src/admin', 'src/admin-shared', 'src/assets/js', 'scripts']
const SHEET = 'src/admin/dist/admin.css'

/**
 * Hooks that are drawn but deliberately not wired, each with the reason.
 *
 * ⚠️ AN ENTRY HERE IS A PROMISE THAT THE CONTROL DOES SOMETHING ANYWAY. Adding a hook to this
 * list to get a green check is how the eight above shipped; the only honest entries are ones
 * where the browser itself is the handler.
 */
const ELSEWHERE = new Map<string, string>([])

/** Source with its comments taken out. See the note on `islands` below for why that matters. */
const bare = (src: string): string => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\n)\s*\/\/[^\n]*/g, '$1')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'dist' || name === 'node_modules') return []
    if (statSync(path).isDirectory()) return files(path)
    return /\.ts$/.test(name) ? [path] : []
  })
}

/**
 * Every hook the admin's markup writes, and the file that writes it.
 *
 * `data-k` and its relatives are the FORM's vocabulary rather than a control's own hook — they
 * are read generically by `settings-form.ts`, by path and not by name — so they are counted
 * once under their own prefix and not per setting.
 */
function written(): Map<string, string> {
  const out = new Map<string, string>()
  for (const file of files(SCREENS)) {
    if (/\.test\.ts$/.test(file)) continue
    // ⚠️ COMMENTS ARE NOT MARKUP. The note explaining why a hook was REMOVED names the hook, and
    // a scan that counts it reports the removal as the fault it was written about.
    const text = bare(readFileSync(file, 'utf8'))
    for (const hook of text.matchAll(/data-([a-z][a-z0-9-]*)/g)) {
      const name = `data-${hook[1]}`
      if (!out.has(name)) out.set(name, file)
    }
  }
  return out
}

/**
 * Whether anything reads a hook back.
 *
 * Three spellings count, because all three are how the islands actually reach one: the
 * attribute in a selector (`[data-mcp-delete]`), the `dataset` property (`el.dataset.mcpRow`),
 * and a PREFIX the code completes itself (`data-s3-` + a field name). The prefix rule is what
 * keeps this from crying wolf over a family of hooks driven by one loop, and a guard that cries
 * wolf gets its complaint dismissed, and the next complaint with it.
 */
function heard(hook: string, prose: string, css: string): boolean {
  if (css.includes(hook)) return true
  const bare = hook.slice(5)
  const camel = bare.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
  const parts = bare.split('-')
  const prefixes = parts.map((_, i) => `data-${parts.slice(0, i + 1).join('-')}`)
  // ⚠️ `dataset.` IN FRONT OF THE CAMEL SPELLING, not the camel spelling loose. A bare
  // `\bs3Bucket\b` is satisfied by `IntegrationStatus.s3Bucket` — a server type that has nothing
  // to do with reading an attribute — and `data-s3-bucket` was excused by it while its five
  // siblings were reported. A rule that lets a field name vouch for a hook is a rule that goes
  // quiet exactly where the names line up.
  return prefixes.some((p) => prose.includes(p))
    || new RegExp(`dataset(?:\\.|\\[')${camel}\\b`).test(prose)
}

/**
 * ⚠️ THIS FILE IS NOT A READER, AND NEITHER IS ANY OTHER GUARD. The first run with `scripts/`
 * included excused `data-s3-*` and `data-mcp-delete` because THIS comment names them: a guard
 * that reads its own prose as evidence reports every hook it has ever described as wired. The
 * same goes for comments anywhere else — a note saying a control "is not wired yet" would
 * otherwise be the proof that it is.
 */
const islands = ISLANDS.flatMap(files)
  .filter((f) => !/\.test\.ts$/.test(f) && !f.includes('scripts/checks/'))
/**
 * ⚠️ AND THE SCREENS READ A FEW OF THEIR OWN. `rail.ts` ships a boot script as a STRING — it has
 * to run before the first frame, so it cannot be an island — and it reads `data-mac` off every
 * chord to swap the key names on a Mac. A hook read by the markup file that draws it is read.
 *
 * Only the READING spellings count here, never the writing one: the attribute inside a
 * `querySelector` bracket, `getAttribute('…')`, or `dataset.x`. Counting a screen's own
 * `data-mac="…"` would make every hook vouch for itself and the guard would pass on an empty
 * admin.
 */
function readsInMarkup(): string {
  const out: string[] = []
  for (const file of files(SCREENS)) {
    if (/\.test\.ts$/.test(file)) continue
    const text = bare(readFileSync(file, 'utf8'))
    for (const hit of text.matchAll(/\[(data-[a-z0-9-]+)[\]=]|getAttribute\(['"`](data-[a-z0-9-]+)|dataset\.([A-Za-z0-9]+)/g)) {
      out.push(hit[1] ?? hit[2] ?? `dataset.${hit[3] ?? ''}`)
    }
  }
  return out.join('\n')
}

const prose = [...islands.map((f) => bare(readFileSync(f, 'utf8'))), readsInMarkup()].join('\n')
const css = readFileSync(SHEET, 'utf8')
const drawn = written()

const deaf: string[] = []
for (const [hook, file] of [...drawn].sort()) {
  if (ELSEWHERE.has(hook) || heard(hook, prose, css)) continue
  deaf.push(`${hook} — drawn in ${file}`)
}

console.log(`  ${drawn.size} hook(s) in the admin's markup, ${islands.length} island file(s) reading`)
if (deaf.length === 0) {
  console.log('✓ check:admin-wired: ok')
} else {
  console.log(`✗ check:admin-wired: ${deaf.length} hook(s) that nothing reads`)
  for (const line of deaf) console.log(`  - ${line}`)
  console.log('  A drawn control with no reader is a key that does nothing when pressed.')
  console.log('  Wire it in `src/admin/island/`, or take the markup out.')
  process.exit(1)
}
