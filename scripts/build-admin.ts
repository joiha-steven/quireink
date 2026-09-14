// Build the admin SPA: one JavaScript bundle (plus its lazy chunks) and one stylesheet.
//
// Separate from `build-assets.ts` because the two have nothing in common but the word
// "build". The public bundles are three hand-written files under a byte budget defended in
// review; this is React, Tiptap and Tailwind, and its size is deliberately not budgeted —
// only the owner ever loads it (ADR 0006, and 04-frontend.md on why admin payload is not a
// public concern). Keeping them apart stops the admin's weight from ever being weighed
// against the reader's.

import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// `fileURLToPath`, not `URL.pathname`: on Windows the latter yields "/C:/dev/..." and
// every filesystem call against it fails with EFAULT.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = `${ROOT}src/admin/dist`

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

const result = await Bun.build({
  entrypoints: [`${ROOT}src/admin/main.tsx`],
  outdir: OUT,
  target: 'browser',
  format: 'esm',
  splitting: true, // the editor's Tiptap chunk loads only when an editor opens
  minify: true,
  // The ENTRY carries the bundler's own hash, and that is a correctness rule before it is a
  // caching one. A route chunk may import the entry back — Bun 1.4 emits `from"./main.js"` in
  // every lazy chunk where 1.3 did not — so the name the shell loads and the name the chunks
  // import have to be the SAME string. Fingerprinting the entry in the server (`main.<hash>.js`
  // for a file on disk called `main.js`) made them two, the browser instantiated the module
  // twice, and the second copy of React threw "invalid hook call" on the first lazy screen.
  //
  // `admin.` with a DOT, not `main-`, so the one file that must be found by name stays
  // distinguishable from the twelve chunks that must not: those are `[name]-[hash].js` and
  // `[name]` is `main` for all of them.
  naming: { entry: 'admin.[hash].js', chunk: '[name]-[hash].js' },
  define: { 'process.env.NODE_ENV': '"production"' },
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

// THE ISLANDS, built apart from the SPA (ADR 0054).
//
// One entry per file in `src/admin/island/`, and separate from React because that is the whole
// point: the rail is the frame the owner navigates by and a converted screen is the page
// itself, so neither may wait for a bundle to be fetched, parsed and run. They share no module
// with React — their imports are `admin-shared/*` and a pure helper or two — so one bundle
// would have cost them that independence and bought nothing.
//
// A SCREEN'S ISLAND IS REQUESTED ONLY BY ITS OWN PAGE. `spa.ts` links the one the screen
// names, so the log's filters are not downloaded by anybody looking at the media library.
//
// `splitting` is ON for one reason: arrange mode is a dynamic import, and it should stay a
// separate file nobody downloads until they open it.
const islands = (await Array.fromAsync(new Bun.Glob('*.ts').scan({ cwd: `${ROOT}src/admin/island` })))
  .filter((n) => !n.endsWith('.test.ts'))
  .map((n) => `${ROOT}src/admin/island/${n}`)
  .sort()
const island = await Bun.build({
  entrypoints: islands,
  outdir: OUT,
  target: 'browser',
  format: 'esm',
  splitting: true,
  minify: true,
  naming: { entry: '[name].[hash].js', chunk: 'island-[name]-[hash].js' },
  define: { 'process.env.NODE_ENV': '"production"' },
})

if (!island.success) {
  for (const log of island.logs) console.error(log)
  process.exit(1)
}

// THE STYLESHEET IS TWO FILES CONCATENATED, and that is the whole build step now.
//
// `utilities.css` holds the utility classes, the reset and the design tokens, captured once
// from the Tailwind CLI that used to produce them on every build and kept as plain CSS
// (ADR 0053). `admin.css` holds the admin's own chrome, and goes SECOND because its rules are
// unlayered and the utilities are inside `@layer utilities`: that ordering is what lets the
// chrome win, and it is the ordering the CLI produced.
//
// The minifier is this repository's own, the one the reading page's sheets go through.
const { minifyCss } = await import(`${ROOT}src/web/css-min.ts`)
const utilities = await Bun.file(`${ROOT}src/admin/utilities.css`).text()
const chrome = await Bun.file(`${ROOT}src/admin/admin.css`).text()
const styles = minifyCss(`${utilities}\n${chrome}`)

// The editor is a `.prose` surface, so it needs the article's own typography — the same
// rules, from the same constant the public sheet uses. Appended rather than pasted into
// `admin.css`, because a second copy of a type scale stays in step for about a month.
//
// The pen comes too, and ALL of it. The public side links each half of the ink only to the
// pages whose HTML contains its element (ADR 0027), but the editor cannot know which
// gestures a post will use before the owner writes them — a stroke you cannot see while
// writing is a stroke you cannot place.
const { PROSE_CSS } = await import(`${ROOT}src/web/prose.css.ts`)
const { INK_CSS } = await import(`${ROOT}src/pen/ink.css.ts`)
await Bun.write(`${OUT}/admin.css`, `${styles}\n${PROSE_CSS}\n${INK_CSS}`)

let total = 0
for (const output of result.outputs) {
  const size = output.size ?? 0
  total += size
  console.log(`  ${output.path.split(/[\\/]/).pop()}  ${(size / 1024).toFixed(0)} KB`)
}
const sheet = Bun.file(`${OUT}/admin.css`).size
console.log(`  admin.css  ${(sheet / 1024).toFixed(0)} KB`)
console.log(`admin: ${(total / 1024).toFixed(0)} KB of JavaScript + ${(sheet / 1024).toFixed(0)} KB of CSS`)
