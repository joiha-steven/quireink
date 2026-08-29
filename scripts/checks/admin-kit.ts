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
    // Added 2026-08-22, after MediaLibrary was found carrying a byte-identical copy of this
    // string. The copy had also missed the tap-target padding that went onto the original,
    // which is exactly the drift this file exists to stop: a screen re-types a primitive,
    // the primitive later grows, and the copy stays behind where nothing can see it.
    what: 'the quiet sheet-top tool',
    signature: 'text-xs text-neutral-500 transition hover:text-neutral-900',
    home: 'src/admin/components/sheet.tsx',
    instead: 'import SHEET_TOOL from components/sheet',
  },
  {
    what: 'the form-control chrome',
    signature: 'focus:ring-2 focus:ring-neutral-200',
    home: 'src/admin/components/kit.tsx',
    instead: 'import CONTROL from components/kit, or use ui/Input',
  },
  {
    what: 'the segmented tab track',
    signature: 'items-end gap-6 border-b border-neutral-200',
    home: 'src/admin/components/tabs.tsx',
    instead: 'use <Tabs>: size="lg" is the underlined section strip, size="sm" the inline filter',
  },
  {
    what: 'the button shape',
    signature: 'whitespace-nowrap rounded-md',
    home: 'src/admin/ui/Button.tsx',
    instead: 'use <Button>, or buttonClass() for an <a>',
  },
  {
    what: 'the stat tile',
    signature: 'text-[1.875rem] font-medium leading-none tracking-[-0.02em] tabular-nums',
    home: 'src/admin/components/scale.ts',
    instead: 'use <StatCard> (or <StatTile>, which is StatCard with a trend)',
  },
  {
    // The one that costs a COLOUR the admin does not have. A native checkbox or radio with
    // no `accent-color` is not unstyled — it is painted in the OS accent, which is blue.
    // Five controls shipped that way (both editors' status radios, the redirect's
    // "permanent", the newsletter's picker and its resend confirmation) and the two that had
    // remembered disagreed on the shade, so the admin drew its tick three ways.
    what: 'the checkbox / radio tick',
    signature: 'accent-neutral-900 dark:accent-white',
    home: 'src/admin/components/kit.tsx',
    instead: 'import CHECK from components/kit, or use ui/Switch’s CheckField',
  },
  {
    // Thirty-eight screens hand-typed this rather than import it, plus three that went as far
    // as declaring `const HINT` with the same string — and twenty-five of the copies carried
    // `text-neutral-400 dark:text-neutral-500`, lighter than the primitive in light mode and
    // darker in dark mode, so they were the hardest hints to read in both. It used to cost a
    // FACE as well as a shade; since the admin went to one face (2026-08-15) a copy costs the
    // size and the leading, which is still the difference between a readable hint and the
    // smallest text on the screen.
    what: 'the hint text style',
    // `italic` since 2026-08-29, and the signature moved with it — a hint is set apart from
    // its label by SLANT because it cannot be set apart by shade: measured at 4.74:1 on a
    // white card against the 4.5:1 floor, with `neutral-400` two steps down at 2.58:1.
    signature: 'text-[0.8125rem] italic leading-[1.55] text-neutral-500',
    home: 'src/admin/components/scale.ts',
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
 * A RAISED WHITE PILL, by shape rather than by exact string — and this is the rule the exact
 * strings above could not have caught.
 *
 * `signature` matching assumes a copy is a COPY. Six segmented controls proved otherwise: the
 * site-language picker, the analytics range strip, and four pickers inside the editor (video
 * size, highlight stroke, image alignment, gallery ratio) all drew the tab strip's pill, and
 * every one of them had chosen `bg-neutral-100` where the primitive said `bg-neutral-200/70`.
 * One shade apart, so the check passed for months while the admin carried seven of one
 * control. They were found by photographing the running admin on 2026-08-15, which is exactly
 * the thing the check exists so nobody has to do.
 *
 * So this matches the IDEA: a white fill lifted on a shadow, which after the 2026-08-15 rework
 * is not a thing the admin draws anywhere. A raised white chip on a tinted tray is the stock
 * dashboard's segmented control, and the admin's is `tabItemClass(active, 'sm')`.
 *
 * A surface that is `sticky` or `fixed` is exempt, and the exemption is read off the SAME LINE
 * rather than kept as a list of filenames — a list goes stale silently and says nothing about
 * why. `docs/admin-design.md` reserves the shadow for overlays, and a bar pinned over content
 * the owner is scrolling past is genuinely one: the editor's action header earns it, a picker
 * sitting still in a form does not.
 */
// STILL `sm|md`, and the card's new contact step does not need this widened — which is the
// point worth writing down. Those two are the shadows of a card PRETENDING to float while
// sitting in the flow, which is the costume this guards against. `lg` and above are what a
// real overlay wears, and the admin has three: the slash menu, the bubble bar, the date
// picker. The card's own step (2026-08-29) is an arbitrary 1px of contact at 4% — an edge,
// not a lift — so it was never one of these and the guard did not have to move for it.
const RAISED = /bg-white[^'"`\n]*\bshadow-(sm|md)\b/
const PINNED = /\b(sticky|fixed)\b/
for (const file of files) {
  const path = file.replaceAll('\\', '/')
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!RAISED.test(line) || PINNED.test(line)) continue
    console.error(`✗ check:admin-kit: ${path} raises a white surface on a shadow`)
    console.error('  The admin draws no shadow except on an overlay. For a segmented control use')
    console.error('  <Tabs size="sm">; for a panel use CARD, which is a sheet with a hairline.')
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
