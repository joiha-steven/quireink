// Guard #11: every class the admin writes in its markup has a rule in its stylesheet.
//
// This is the guard that makes ADR 0053's Tailwind removal safe rather than merely done. Until
// 2026-09-14 the CLI scanned the admin tree on every build and invented a rule for any utility
// class it found, so adding `mt-7` to a component just worked. Nothing scans now: `mt-7` with no
// rule behind it is a class that does nothing, applied to an element that then sits in the wrong
// place, on a screen only the owner ever opens.
//
// That is a silent failure, and this turns it into a loud one.
//
// WHAT IT READS. Class names come out of `className=` in the admin tree, and rules come out of
// the BUILT stylesheet — `src/admin/dist/admin.css`, after `utilities.css`, `admin.css`, the
// prose sheet and the pen have all been concatenated. Reading the built file rather than the
// sources is deliberate: it is what the browser gets, and a rule that exists in a source file
// the build forgot to include is not a rule.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = 'src/admin'
const SHEET = 'src/admin/dist/admin.css'

/**
 * Classes that are real but are not written as `.name` anywhere: they are set on elements by
 * something else and styled through a descendant selector, or they belong to a library's own
 * DOM. Each one is listed with who puts it there.
 */
const ELSEWHERE = new Set([
  'dark', // ThemeProvider, on <html>; every rule that uses it is `.dark .thing`
  'group', // a marker for `group-hover:`, which styles the CHILD
  'peer', // the same, for `peer-checked:`
])

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'dist') return []
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

/**
 * Every class name the stylesheet defines.
 *
 * CSS escapes a class that holds punctuation — `md\:flex`, `top-1\/2`, `\[\&\>\*\]\:mb-5` — so
 * the backslashes come off before the name is recorded, which is how it was written in the JSX.
 */
function defined(css: string): Set<string> {
  const found = new Set<string>()
  for (let i = 0; i < css.length; i++) {
    if (css[i] !== '.') continue
    // A decimal inside a value (`.5rem`) is not a selector; a class starts with a letter, an
    // underscore, a dash — or a BACKSLASH, because `.\[\&\>\*\]\:mb-5` is a class whose
    // first character had to be escaped. Missing that case made this report every arbitrary
    // variant in the admin as undefined.
    if (!/[A-Za-z_\\-]/.test(css[i + 1] ?? '')) continue
    let name = ''
    let j = i + 1
    for (; j < css.length; j++) {
      const c = css[j]!
      if (c === '\\') { name += css[j + 1] ?? ''; j++; continue }
      if (/[A-Za-z0-9_-]/.test(c)) { name += c; continue }
      break
    }
    if (name) found.add(name)
    i = j - 1
  }
  return found
}

/** Class tokens, from every `className` in the tree. Interpolations are skipped, not guessed. */
function used(files: readonly string[], rulesOf: ReadonlySet<string>): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/className\s*=\s*(\{|")/g)) {
      const start = m.index! + m[0].length - 1
      // The attribute's extent: to the closing quote, or across balanced braces.
      let end = start
      if (m[1] === '"') {
        end = text.indexOf('"', start + 1)
      } else {
        let depth = 0
        for (end = start; end < text.length; end++) {
          if (text[end] === '{') depth++
          else if (text[end] === '}' && --depth === 0) break
        }
      }
      if (end < 0) continue
      const body = text.slice(start, end + 1)
      // Only the STRING literals inside it, so `clsx(open && 'block')` gives `block` and the
      // condition gives nothing.
      for (const lit of body.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n$]*)`/g)) {
        for (const token of (lit[1] ?? lit[2] ?? lit[3] ?? '').split(/\s+/)) {
          if (!token || token.includes('$') || !/^[-A-Za-z[]/.test(token)) continue
          // SHAPED LIKE A UTILITY, or it is not judged. A `className={...}` expression holds
          // strings that are not classes at all: the right-hand side of a comparison, a label,
          // a variant name. Telling those apart properly would mean parsing the expression, so
          // the rule is the shape instead: a dash, a colon, a bracket or a slash. Every utility
          // that takes an argument has one, and `flex` or `bold` alone is either a real class
          // the stylesheet defines — in which case it passes anyway — or not a class.
          if (!/[-:[/]/.test(token) && !rulesOf.has(token)) continue
          const seen = out.get(token) ?? []
          if (!seen.includes(file)) seen.push(file)
          out.set(token, seen)
        }
      }
    }
  }
  return out
}

if (!existsSync(SHEET)) {
  console.error(`admin-css: ${SHEET} does not exist — run \`bun run build:admin\` first`)
  process.exit(1)
}

const rulesOf = defined(readFileSync(SHEET, 'utf8'))
const classes = used(sources(SOURCE), rulesOf)
const missing: string[] = []
for (const [token, files] of classes) {
  if (rulesOf.has(token) || ELSEWHERE.has(token)) continue
  missing.push(`${token} — used in ${files[0]}${files.length > 1 ? ` and ${files.length - 1} more` : ''}`)
}

console.log(`  ${classes.size} class name(s) in markup, ${rulesOf.size} defined by the stylesheet`)
if (missing.length === 0) {
  console.log('✓ check:admin-css: ok')
} else {
  console.log(`✗ check:admin-css: ${missing.length} class(es) with no rule`)
  for (const m of missing.sort()) console.log(`  - ${m}`)
  console.log('  Nothing scans the source for utilities any more (ADR 0053). Write the rule in')
  console.log('  `src/admin/utilities.css`, or the style in `src/admin/admin.css`.')
  process.exit(1)
}
