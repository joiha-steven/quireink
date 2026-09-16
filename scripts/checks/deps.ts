// Guard #10: every package in `package.json` is one somebody decided to keep.
//
// ADR 0053 makes writing it here the default and a dependency the exception. A rule with no
// check is a rule the next session overrides by default, which is exactly how ADR 0005's
// "keep `marked`, `shiki`, `sharp`, `satori`, `nodemailer` and the MCP SDK" stayed the working
// policy for seven weeks after the deadline it was written for had been discharged.
//
// So the list is HERE, with a reason on every line, in the same shape as `GONE` in `docs.ts` and
// `DIVERGED` in the golden compare: an exception on the record is a decision, an exception in
// somebody's head is an omission.
//
// It fails BOTH WAYS. A package that is installed and not listed fails, which is the point. A
// package that is listed and no longer installed fails too, because a list that keeps entries
// for things that left is a list nobody has read lately.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Tier A of ADR 0053: what the code runs ON. Not packages, and listed for the reader. */
const FLOOR = 'Bun, `bun:sqlite`, and the runtime\'s own TLS'

/**
 * Tier B: kept because writing it would make the product WORSE, not merely slower.
 * Tier T: a tool that never ships to anyone.
 * Tier C: on its way out, with the ADR that will remove it.
 */
const ALLOWED: Record<string, string> = {
  // ---- B: writing these would be a downgrade ------------------------------------------
  sharp:
    'B. Image codecs. A hand-written JPEG or AVIF decoder, on a public upload route, on the owner\'s own machine, is a memory-safety surface nobody here would audit',
  shiki: 'B. The value is hundreds of TextMate grammars, not the code that reads them. 346 of them, loaded one at a time when a fence names one (2026-09-16)',
  temml: 'B. LaTeX is a language, not a syntax',
  satori: 'B. HTML and CSS to SVG, for the social card',
  '@modelcontextprotocol/sdk':
    'B. A protocol under somebody else\'s revision, not a convenience',
  zod:
    'B. Not ours to remove: it is a dependency AND a peer dependency of the MCP SDK, so taking it out of this repository\'s own files would not take it out of the install',

  // ADR 0054 named these as the layer this product wants to depend on, in place of the
  // `@tiptap/*` wrapper above it: MIT, one author, and older than this product, where the
  // wrapper has a commercial tier and a company behind it. They were already installed —
  // every one of them arrives under Tiptap — so this is a change of WHO DECIDED, not of what
  // is on disk.
  //
  // ⚠️ AND DECLARING THEM IS WHAT LET THE DUPLICATES BE SEEN. Measured 2026-09-15 from the
  // built artefact, not from the tree: the editor chunk carried `prosemirror-view` THREE
  // times and `prosemirror-transform` twelve paths' worth, because five packages had a
  // 1.42.2 nested under them while the hoisted copy was 1.42.3 — with ranges that the
  // hoisted one satisfies. Two `overrides` lines and a forced resolve took the admin's
  // JavaScript from 1,170 KB to 976 KB, of which the editor chunk is 1,028 → 833.
  'prosemirror-model': 'B. The document model: the schema, the nodes, the marks',
  'prosemirror-state': 'B. The state and the plugin system every editor behaviour hangs off',
  'prosemirror-view': 'B. The editable surface itself, and the node views',
  'prosemirror-transform':
    'B. Steps and mapping — the half of the model a serializer and the find strip both walk',
  // The rest of the engine, named as `editor/` came to use each one directly. Every one was
  // already installed under Tiptap; what changed is who asked for it.
  'prosemirror-commands': 'B. The base keymap and the commands every editor needs',
  'prosemirror-history': 'B. Undo. Not a thing to write twice',
  'prosemirror-keymap': 'B. Chords to commands, with the platform\'s own Mod key',
  'prosemirror-inputrules': 'B. Markdown as it is typed, and the Backspace that takes it back',
  'prosemirror-schema-list': 'B. Split, lift and sink a list item — the three hard ones',
  'prosemirror-tables':
    'B. Cell selection, column spans and the table keymap. The one piece here that is genuinely large',
  'prosemirror-dropcursor': 'B. Where a dragged picture would land',
  'prosemirror-gapcursor': 'B. A caret between two blocks that cannot hold one',

  // ---- C: going, and the order is the owner's --------------------------------------------
  hono: 'C. A thin HTTP router, but 50 call sites. Last, and only when the rest is done',
  // ---- and what is no longer here ------------------------------------------------------
  //
  // `@tiptap/*` — nine packages — left on 2026-09-15, which is ADR 0054's step 7 discharged.
  // `react` and `react-dom` left on the 15th too, with step 6. Both are recorded here rather
  // than only in the history because tier C was written as a list of things on their way out,
  // and a tier that empties without anybody noticing is a tier nobody was reading.

  // ---- T: tools, which never reach a reader ---------------------------------------------
  typescript: 'T. The compiler',
  '@types/bun': 'T. Types for the runtime',
  '@happy-dom/global-registrator': 'T. A DOM for the editor suites, registered per test file',
}

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const installed = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
].sort()

const violations: string[] = []

for (const name of installed) {
  if (ALLOWED[name] === undefined) {
    violations.push(
      `${name} is in package.json and not on the list. Adding a dependency is the owner's decision (ADR 0053); if it was taken, put it here with its reason`,
    )
  }
}
for (const name of Object.keys(ALLOWED)) {
  if (!installed.includes(name)) {
    violations.push(`${name} is on the list and not installed. Remove the line`)
  }
}

const runtime = Object.keys(pkg.dependencies ?? {}).length
console.log(`  ${installed.length} package(s) declared, ${runtime} of them at runtime`)
console.log(`  the floor, which is not on the list: ${FLOOR}`)
if (violations.length === 0) {
  console.log('✓ check:deps: ok')
} else {
  console.log(`✗ check:deps: ${violations.length} violation(s)`)
  for (const v of violations) console.log(`  - ${v}`)
  process.exit(1)
}
