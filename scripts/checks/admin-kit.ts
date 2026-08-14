// The admin kit says a thing ONCE. This check is what makes that true.
//
// Every drift found on 2026-08-02 had the same shape: a primitive exists in `kit.tsx` or
// `ui/`, a screen needs it, and the screen copies the class list instead of importing it.
// The copy then diverges by a shade, two pixels or a missing `shrink-0`, and nothing says so
// — a settings field two pixels taller than the button beside it does not fail a type check
// and does not fail a test. Four primary buttons, three tab tracks, two form controls and two
// stat tiles were all found by photographing the running admin, which is not a thing anyone
// does on every commit.
//
// So the signatures are checked here instead. Each one is a string that appears in exactly
// one primitive and has no reason to appear anywhere else. Adding a variant to a primitive is
// fine; re-typing its class list into a screen is what this stops.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

type Rule = {
  /** What the primitive is, for the error message. */
  what: string
  /** The class fragment that only the primitive has any business containing. */
  signature: string
  /** Where it legitimately lives, as a path suffix. */
  home: string
  /** What the offender should do instead. */
  instead: string
}

const RULES: Rule[] = [
  {
    what: 'the form-control chrome',
    signature: 'focus:ring-2 focus:ring-neutral-200',
    home: 'src/admin/components/kit.tsx',
    instead: 'import CONTROL from components/kit, or use ui/Input',
  },
  {
    what: 'the segmented tab track',
    signature: 'rounded-xl bg-neutral-200/70 p-1',
    home: 'src/admin/components/kit.tsx',
    instead: 'use <Tabs>, with size="sm" for a filter inside a section',
  },
  {
    what: 'the button shape',
    signature: 'whitespace-nowrap rounded-lg',
    home: 'src/admin/ui/Button.tsx',
    instead: 'use <Button>, or buttonClass() for an <a>',
  },
  {
    what: 'the stat tile',
    signature: 'text-[1.65rem] font-semibold tracking-tight tabular-nums',
    home: 'src/admin/components/kit.tsx',
    instead: 'use <StatCard> (or <StatTile>, which is StatCard with a trend)',
  },
  {
    // The one that costs a FACE and not only a shade. The admin is set in two typefaces and
    // the second one travels on `NOTE_TEXT`; a hand-typed copy of these classes therefore
    // renders a sentence in the chrome font beside an identical sentence in the reading
    // font. Thirty-eight screens had done it, plus three files that had gone as far as
    // declaring `const HINT` with the same string — and twenty-five of the copies carried
    // `text-neutral-400 dark:text-neutral-500`, lighter than the primitive in light mode and
    // darker in dark mode, so they were the hardest hints to read in both.
    what: 'the hint text style',
    signature: 'text-xs leading-5 text-neutral-500',
    home: 'src/admin/components/kit.tsx',
    instead: 'import NOTE_TEXT from components/kit — or pass `note` to Setting / ui/Input',
  },
]

/** Source only. `dist/` is the built bundle and contains every signature by construction. */
function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'dist' || name === 'node_modules') continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sources(path))
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(path)
  }
  return out
}

let failed = false
const files = sources('src/admin')

if (files.length < 50) {
  console.error(`✗ check:admin-kit: only ${files.length} source files found, which cannot be right`)
  process.exit(1)
}

for (const rule of RULES) {
  let seenAtHome = false
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    if (!text.includes(rule.signature)) continue
    // Windows hands back backslashes; the rules are written with the repo's own separator.
    if (file.replaceAll('\\', '/') === rule.home) {
      seenAtHome = true
      continue
    }
    console.error(`✗ check:admin-kit: ${file} re-declares ${rule.what}`)
    console.error(`  Found ${JSON.stringify(rule.signature)}, which belongs to ${rule.home}.`)
    console.error(`  ${rule.instead}.`)
    failed = true
  }
  // A signature that no longer matches its own primitive means the primitive was reworded and
  // this rule went quietly dead — the exact way `check:css-literal` stopped guarding two
  // sheets while still reporting ok.
  if (!seenAtHome) {
    console.error(`✗ check:admin-kit: ${rule.home} no longer contains ${JSON.stringify(rule.signature)}`)
    console.error('  The rule is guarding nothing. Update the signature in this file.')
    failed = true
  }
}

/**
 * The other half of the same idea: no screen names a TYPEFACE.
 *
 * Which of the two faces a thing is set in is a question about its ROLE, and the roles are
 * `NOTE_TEXT` / `READING` / `data-prose`. A `fontFamily` on a screen answers it locally and
 * permanently, and answering it locally is how the admin ended up deciding faces by HTML TAG:
 * a `.admin p` rule in `admin.css`, under which `Setting` (whose hint is a `<p>`) and
 * `ui/Input` (whose identical hint is a `<span>`) rendered two hints of one kind, on one card,
 * in two different faces.
 *
 * The exception is a SPECIMEN: a picker tile painted in the face it offers. It must name a
 * family, because naming it is the whole control. So a `fontFamily` is allowed only in a file
 * that also marks that surface `data-specimen` — the same attribute that stops `admin.css`
 * normalising its x-height, so the two cannot be marked one without the other.
 */
// A DECLARATION, not a mention: the colon is required. Without it the check failed on a
// locale key called `fontFamilyLabel` and on this file's own prose about font families —
// and a guard that cries wolf is a guard somebody switches off.
const FAMILY = /fontFamily\s*:|font-family\s*:/
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  if (!FAMILY.test(text) || text.includes('data-specimen')) continue
  console.error(`✗ check:admin-kit: ${file} names a typeface`)
  console.error('  A face belongs to a role, not to a screen: use NOTE_TEXT, READING or data-prose.')
  console.error('  A picker painted in the face it offers marks that surface data-specimen.')
  failed = true
}

if (failed) process.exit(1)
console.log(`✓ check:admin-kit: ok (${RULES.length} primitive(s), ${files.length} file(s))`)
