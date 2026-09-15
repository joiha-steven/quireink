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
  shiki: 'B. The value is hundreds of TextMate grammars, not the code that reads them',
  temml: 'B. LaTeX is a language, not a syntax',
  satori: 'B. HTML and CSS to SVG, for the social card',
  '@modelcontextprotocol/sdk':
    'B. A protocol under somebody else\'s revision, not a convenience',
  zod:
    'B. Not ours to remove: it is a dependency AND a peer dependency of the MCP SDK, so taking it out of this repository\'s own files would not take it out of the install',

  // ---- C: going, and the order is the owner's --------------------------------------------
  hono: 'C. A thin HTTP router, but 50 call sites. Last, and only when the rest is done',
  '@tiptap/starter-kit': 'C. The editor. ADR 0006 has to be replaced before this moves',
  '@tiptap/core':
    'C. With the editor. Named on 2026-09-15 rather than added: it arrived under `@tiptap/react` and the two files that used the adapter now build the instance themselves',
  '@tiptap/extension-bubble-menu':
    'C. With the editor. Same day, same reason: it arrived under `@tiptap/react/menus` and the floating bar registers it as a plain ProseMirror plugin now',
  '@tiptap/extension-image': 'C. With the editor',
  '@tiptap/extension-placeholder': 'C. With the editor',
  '@tiptap/extension-table': 'C. With the editor',
  '@tiptap/extension-task-item': 'C. With the editor',
  '@tiptap/extension-task-list': 'C. With the editor',
  '@tiptap/extension-text': 'C. With the editor',

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
