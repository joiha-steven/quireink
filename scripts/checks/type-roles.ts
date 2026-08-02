// Every size on the reader's page comes from a type ROLE, so the owner's typography
// settings actually control the page.
//
// The rule was written at the top of `public.css.ts` from the beginning — "every size from
// a type role, no hardcoded px sizes" — and by the time anyone measured, the islands sheet
// carried nine literals, a related-post title had no size rule at all and fell back to the
// body size, and the comment thread was a role the settings could not reach. A rule that
// only exists in a comment is a rule that has already been broken.
//
// What counts as compliant:
//   * `var(--fs-<role>)`             the owner's setting for that role
//   * `inherit`                      deliberately taking the surrounding size
//   * a value in `em`                an ornament measured against its OWN context (a drop
//                                    cap, a dinkus), which stays right at every role size
//   * a listed exception             below, with a reason
//
// The sheets are DISCOVERED, not listed, for the same reason `check:css-literal`'s are: a
// hand-kept list of files goes stale in the commit that adds a file, and a guard reading six
// of eight sheets still prints a tick. `mobile.css.ts` was never in the list here and nobody
// noticed, because it happens to carry exactly one size and that one is legitimate.
//
// `login.css.ts` is the one real exclusion. The sign-in page renders with an empty base
// sheet, so no `--fs-*` variable is defined on it and a role reference there would resolve
// to nothing.

import { readdirSync, readFileSync } from 'node:fs'

const SHEET_DIR = 'src/web'
const NOT_SCANNED = new Set(['login.css.ts'])
const SHEETS = readdirSync(SHEET_DIR)
  .filter((f) => f.endsWith('.css.ts') && !NOT_SCANNED.has(f))
  .map((f) => `${SHEET_DIR}/${f}`)
  .sort()

if (SHEETS.length === 0) {
  console.error(`✗ check:type-roles: no *.css.ts found in ${SHEET_DIR}/, which cannot be right`)
  process.exit(1)
}

/**
 * Literal sizes that are NOT text.
 *
 * Each of these sizes a GLYPH used as an icon — a multiplication sign for close, angle
 * brackets for previous and next. Their size is a hit target, decided with the padding
 * around them, and tying it to the reader's body-text setting would make the close button
 * grow when someone chose larger type.
 *
 * Adding to this list should feel like a decision. That is the point of it being a list
 * rather than a naming convention.
 */
const ALLOWED = new Map<string, string>([
  ['.lightbox-close', 'the × glyph, sized with its 2.5rem hit target'],
  ['.lightbox-prev,.lightbox-next', 'the ‹ › glyphs, sized with their 3rem hit targets'],
  ['.book-x', 'the × glyph that closes book mode, sized with its padding'],
  ['.book-arrow', 'the page-turn arrows in book mode, sized with their hit targets'],
  ['.search-close', 'the × glyph that closes the search overlay'],
  [
    'form.search input,form.subscribe input,.search-input,.comment-form input,.comment-form textarea',
    'not a size but a FLOOR: max(16px,1em). iOS Safari zooms the whole page when a focused '
    + 'control sits below 16px and --fs-small measures 14px here, so tapping the sign-up '
    + 'field shifted the layout sideways and left it there. A larger type role still wins.',
  ],
])

/**
 * Rules that take a role's SIZE without its leading and tracking, on purpose.
 *
 * A role is three numbers, not one. Taking the size alone is what made the owner's
 * line-height and letter-spacing settings dead on eight surfaces at once — a figcaption
 * kept the body's 1.7 leading however the caption role was set, and the whole footnote
 * block with it. Nothing in review catches that, because the rule LOOKS wired: it names a
 * role variable.
 */
const PARTIAL_OK = new Map<string, string>([
  ['.subscribe-card h2', 'font-size:inherit — it deliberately takes the card\'s own size'],
])

type Finding = { file: string; line: number; selector: string; value: string }
type Partial = { file: string; line: number; selector: string; role: string; missing: string[] }
const findings: Finding[] = []
const partials: Partial[] = []

/**
 * The declaration block a match sits in: from its opening brace to the next `}`.
 *
 * Declaration blocks do not nest, so the first `}` after the match ends this one. An
 * `@media` wrapper is not a problem for the same reason — the match is always inside the
 * innermost block.
 */
function blockFor(body: string, at: number): string {
  const open = body.lastIndexOf('{', at)
  const close = body.indexOf('}', at)
  return open === -1 || close === -1 ? '' : body.slice(open + 1, close)
}

/**
 * The selector a declaration belongs to.
 *
 * From the brace that opens this rule, back to whichever came last before it: the previous
 * rule's `}` or an enclosing `{` (an `@media` block). Comments in between are dropped, and
 * a selector written across two lines is joined, so a multi-line selector matches the
 * single-line form in ALLOWED.
 */
function selectorFor(body: string, at: number): string {
  const open = body.lastIndexOf('{', at)
  if (open === -1) return ''
  const start = Math.max(body.lastIndexOf('}', open), body.lastIndexOf('{', open - 1)) + 1
  return body.slice(start, open)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('')
    .trim()
}

for (const file of SHEETS) {
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(/font-size:\s*([^;}]+)/g)) {
    const value = match[1]!.trim()
    const role = /^var\(--fs-([a-z0-9]+)\)$/.exec(value)?.[1]
    if (role !== undefined) {
      // The size is wired. Now the other two thirds of the role: a rule that states one
      // dimension of a role and inherits the rest is a setting the owner cannot move.
      const selector = selectorFor(source, match.index)
      if (PARTIAL_OK.has(selector)) continue
      const block = blockFor(source, match.index)
      const missing = [
        block.includes(`line-height:var(--lh-${role})`) ? '' : `line-height:var(--lh-${role})`,
        block.includes(`letter-spacing:var(--ls-${role})`) ? '' : `letter-spacing:var(--ls-${role})`,
      ].filter(Boolean)
      if (missing.length > 0) {
        partials.push({
          file, line: source.slice(0, match.index).split('\n').length, selector, role, missing,
        })
      }
      continue
    }
    if (value === 'inherit' || /^[\d.]+em$/.test(value)) continue
    const selector = selectorFor(source, match.index)
    if (ALLOWED.has(selector)) continue
    findings.push({
      file, line: source.slice(0, match.index).split('\n').length, selector, value,
    })
  }
}

if (findings.length > 0) {
  console.error('✗ check:type-roles: a size on the reader\'s page that the owner cannot set')
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.selector || '(unknown selector)'}  font-size:${f.value}`)
  }
  console.error('  Use var(--fs-<role>), or add the selector to ALLOWED with a reason.')
}

if (partials.length > 0) {
  console.error('✗ check:type-roles: a role taken by its size alone — leading or tracking is dead')
  for (const p of partials) {
    console.error(`  ${p.file}:${p.line}  ${p.selector || '(unknown selector)'}  (${p.role})  add ${p.missing.join(' + ')}`)
  }
  console.error('  A role is three numbers. Add them, or list the selector in PARTIAL_OK with a reason.')
}

if (findings.length > 0 || partials.length > 0) process.exit(1)

console.log(
  `✓ check:type-roles: ok (${SHEETS.length} sheet(s), `
  + `${ALLOWED.size} literal + ${PARTIAL_OK.size} partial exception(s))`,
)
