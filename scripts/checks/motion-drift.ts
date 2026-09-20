// ONE ENGINE, THREE DURATIONS, ONE CURVE — and this is what makes the last two true.
//
// `docs/conventions/motion.md` states it plainly: "A duration literal outside these files is
// drift, and the audit that built the engine (2026-09-06) found eleven of them across four
// files at four values for three intents." Nothing checked it, so by 2026-09-20 there were
// five more — `duration-[120ms]` on three rail rows, `.15s ease` on the link card, and a
// `transition-[width] duration-300` on a bar that could never animate — plus three different
// curves doing the floor's one job, one of them the framework's default buried in the captured
// utilities where nobody would look for a design decision.
//
// The engine files may hold literals: they are where a duration is DECLARED, and the ambient
// keyframes (a caret blink, a lamp's breath) are their own intents with no token. Everywhere
// else, a duration or a curve is written as the token or it is drift.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** The four files that ARE the engine, plus the captured utilities that mirror its tokens. */
const ENGINE = [
  'src/web/motion.css.ts',
  'src/admin/admin.css',
  'src/assets/js/motion.ts',
  'src/admin/motion.ts',
  'src/admin/utilities.css',
]

const ROOT = join(import.meta.dir, '..', '..')
const files: string[] = []
const walk = (dir: string): void => {
  for (const name of readdirSync(dir)) {
    if (name === 'dist' || name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|css)$/.test(name) && !name.includes('.test.')) files.push(full)
  }
}
walk(join(ROOT, 'src'))

/** A duration inside a transition/animation, or a Tailwind duration utility. */
const DURATION = /(?:transition[a-z-]*\s*:[^;}'"`]*|animation[a-z-]*\s*:[^;}'"`]*|duration-\[)([0-9][0-9.]*m?s)/g
const TAILWIND_DURATION = /\bduration-\[([0-9][0-9.]*m?s)\]/g
/** A raw curve where the token belongs. */
const CURVE = /cubic-bezier\([^)]*\)/g

const drift: string[] = []
for (const file of files) {
  const rel = file.slice(ROOT.length + 1)
  if (ENGINE.includes(rel)) continue
  // ⚠️ COMMENTS OUT FIRST. The first run of this check reported `0ms` from a sentence that
  // happened to follow the word "animation" two lines above it, which is the shape of a guard
  // people switch off.
  const text = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  for (const m of [...text.matchAll(DURATION), ...text.matchAll(TAILWIND_DURATION)]) {
    // `0s` is the click landing at once, which is the engine's own instruction and not a duration.
    if (m[1] === '0s') continue
    drift.push(`${rel}: ${m[1]} in ${m[0].slice(0, 44)}`)
  }
  for (const m of text.matchAll(CURVE)) drift.push(`${rel}: ${m[0]} — write var(--ease-out)`)
}

// The two token declarations must agree; no other guard can see a drift between them.
const decl = (rel: string): string => {
  // Stops at `;` OR `}`: the reading site declares its tokens inside a one-line rule, so the
  // value is closed by the brace and a `;`-only match swallowed the rest of the file.
  const m = /--ease-out:\s*([^;}]+)/.exec(readFileSync(join(ROOT, rel), 'utf8'))
  return m ? m[1]!.replace(/\s+/g, '') : '(none)'
}
const curves = ['src/web/motion.css.ts', 'src/admin/admin.css', 'src/admin/utilities.css'].map(
  (f) => `${f}=${decl(f)}`)
const values = new Set(curves.map((c) => c.split('=')[1]))
if (values.size !== 1) drift.push(`--ease-out is declared at ${values.size} values: ${curves.join(' ')}`)

if (drift.length > 0) {
  console.error(`✗ check:motion-drift: ${drift.length} literal(s) outside the engine`)
  for (const d of drift) console.error(`  - ${d}`)
  process.exit(1)
}
console.log(`✓ check:motion-drift: ok (${files.length} file(s), ${ENGINE.length} engine file(s))`)
