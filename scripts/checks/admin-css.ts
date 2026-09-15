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

/**
 * WHERE ADMIN MARKUP IS WRITTEN. It was one directory until 2026-09-14; ADR 0054 makes the
 * server render the rail, and it writes `class="…"` rather than `className={…}`.
 *
 * That difference is the reason this had to be widened deliberately rather than by adding a
 * path: a utility used only by the server's markup was invisible to this guard, which is the
 * silent failure it was written for — a class with no rule behind it does nothing, on a screen
 * only the owner ever opens.
 */
const SOURCES = ['src/admin', 'src/web/admin', 'src/admin-shared']
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
    // `className={…}` is React's, `class="…"` is the server's, and `className: '…'` is a node
    // view's — an element built in TypeScript rather than written as markup. One expression,
    // because the three are the same question asked in three languages and a second loop would
    // be a second place to forget one.
    //
    // ⚠️ THE THIRD FORM IS WHY THIS GUARD DID NOT GO BLIND. The editor's node views became plain
    // ProseMirror on 2026-09-15, which means they BUILD their elements — and the first cut
    // passed the class list as a bare argument, where nothing here could see it. The count
    // dropped by one and the check stayed green, which is precisely the shape of a guard that
    // has quietly stopped checking. A named `className` is the convention that keeps it honest.
    for (const m of text.matchAll(/(?:className|class)\s*[=:]\s*(\{|"|')/g)) {
      const quoted = m[1] === '"' || m[1] === "'"
      const start = m.index! + m[0].length - 1
      // The attribute's extent: to the closing quote, or across balanced braces.
      let end = start
      if (m[1] === '"' || m[1] === "'") {
        const quote = m[1]
        // ⚠️ SKIPPING `${…}`, because a quoted class list inside a template literal routinely
        // contains one — `class="find-hit${i === at ? ' find-hit-now' : ''}"` — and the
        // quotes inside it are not the attribute's closing quote. Stopping at the first `"`
        // cut the attribute in half and reported the remainder as a class name.
        end = -1
        for (let i = start + 1; i < text.length; i++) {
          if (text[i] === '$' && text[i + 1] === '{') {
            let depth = 0
            for (i += 1; i < text.length; i++) {
              if (text[i] === '{') depth++
              else if (text[i] === '}' && --depth === 0) break
            }
            continue
          }
          if (text[i] === quote) { end = i; break }
          if (text[i] === '\n') break
        }
      } else {
        let depth = 0
        for (end = start; end < text.length; end++) {
          if (text[end] === '{') depth++
          else if (text[end] === '}' && --depth === 0) break
        }
      }
      if (end < 0) continue
      let body = text.slice(start, end + 1)
      // ⚠️ AND A CLASS LIST BUILT WITH `+` IS STILL ONE CLASS LIST. A quoted attribute ends at
      // its closing quote, but an ASSIGNMENT does not: `el.className = 'a b' + ' c d'` is how a
      // long list is written when it has to fit inside a line limit, and reading only the first
      // piece is the third shape of the same blindness this guard was caught in on 2026-09-15.
      // Each continuation is appended to the extent, so the loop below sees all of it.
      if (quoted) {
        let at = end + 1
        for (;;) {
          const more = /^\s*\+\s*(['"`])/.exec(text.slice(at, at + 40))
          if (!more) break
          const from = at + more[0].length - 1
          const quote = more[1]!
          let close = -1
          for (let i = from + 1; i < text.length; i++) {
            if (text[i] === quote) { close = i; break }
            if (text[i] === '\n') break
          }
          if (close < 0) break
          body += ` ${text.slice(from + 1, close)} `
          at = close + 1
        }
      }
      // Two kinds of text in here, and both carry class names. The BARE text of a quoted
      // attribute is a class list as written; the text inside `${…}` or `{…}` is an
      // expression, where only its STRING LITERALS are classes — so `clsx(open && 'block')`
      // gives `block` and the condition gives nothing.
      //
      // ⚠️ THE EXPRESSION'S OWN BODY COUNTS, not just its `${…}` holes, and until 2026-09-15
      // this read only the holes. So `className={'block'}` and the literal half of
      // `className={cond ? 'a' : 'b'}` — the commonest form in the React admin — were classes
      // nothing here ever saw: 51 of them, found by planting a class with no rule and watching
      // the check stay green. That is the second time this guard was caught half-blind in one
      // day, and both times the symptom was the same: a number that did not move.
      const spans: string[] = []
      let plain = ''
      for (let i = 0; i < body.length; i++) {
        if (body[i] === '$' && body[i + 1] === '{') {
          let depth = 0
          const from = i
          for (i += 1; i < body.length; i++) {
            if (body[i] === '{') depth++
            else if (body[i] === '}' && --depth === 0) break
          }
          spans.push(body.slice(from, i + 1))
          continue
        }
        plain += body[i]
      }
      // The extent includes its own delimiters, and a class name contains neither — so for a
      // quoted attribute they become whitespace rather than the tail of the last token.
      // Without that every quoted attribute reported its final class as `w-full\"`.
      const literals = [...[...spans, quoted ? '' : plain].join(' ')
        .matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n$]*)`/g)]
        .map((lit) => lit[1] ?? lit[2] ?? lit[3] ?? '')
      // A `class="…"` attribute's own text is not a literal inside anything, so it is added
      // as one.
      for (const piece of [...literals, quoted ? plain.replaceAll(m[1], ' ') : '']) {
        for (const token of piece.split(/\s+/)) {
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
const classes = used(SOURCES.flatMap(sources), rulesOf)
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
