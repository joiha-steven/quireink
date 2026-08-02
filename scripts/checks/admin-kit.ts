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

if (failed) process.exit(1)
console.log(`✓ check:admin-kit: ok (${RULES.length} primitive(s), ${files.length} file(s))`)
