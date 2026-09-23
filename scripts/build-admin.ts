// Build the admin's islands and its stylesheet.
//
// Separate from `build-assets.ts` because the two have nothing in common but the word "build".
// The public bundles are three hand-written files under a byte budget defended in review; this
// is the admin's own, and its size is deliberately not budgeted — only the owner ever loads it
// (04-frontend.md on why admin payload is not a public concern). Keeping them apart stops the
// admin's weight from ever being weighed against the reader's.
//
// ⚠️ THERE IS NO SPA HALF ANY MORE. This built `src/admin/main.tsx` and its lazy chunks until
// ADR 0054's step 6; every screen is HTML now and what is left is one entry per island.

import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// `fileURLToPath`, not `URL.pathname`: on Windows the latter yields "/C:/dev/..." and
// every filesystem call against it fails with EFAULT.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = `${ROOT}src/admin/dist`

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

// THE ISLANDS (ADR 0054).
//
// One entry per file in `src/admin/island/`. They were built apart from the React bundle
// because that was the whole point: the rail is the frame the owner navigates by and a screen
// is the page itself, so neither may wait for a bundle to be fetched, parsed and run. The
// bundle is gone and the arrangement is the reason the admin is quick — a page carries the
// behaviour of the page, and nothing else.
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
// The pen comes too, and ALL of it — but IN A SHEET OF ITS OWN since 2026-09-23. The public side
// links each half of the ink only to the pages whose HTML contains its element (ADR 0027); the
// editor cannot know which gestures a post will use before the owner writes them, so it takes
// the whole pen. What it no longer does is hand the pen to every OTHER screen: every rule in it
// is `.prose mark|u[data-pen]`, and the writing sheet is the only `.prose` the admin draws.
// Measured that day: 523.5 of the 671 KB sheet, on the dashboard, the library and the analytics
// screen as much as on the editor. `spa.ts` links `admin-ink.css` where `Screen.pen` says to.
//
// ⚠️ THROUGH THE MINIFIER, LIKE THE OTHER TWO. These two were appended to the already-minified
// pair, so their comments went to the browser: measured 2026-09-16, 18,203 raw bytes and 8,576
// compressed of commentary on every admin page, which is more compressed weight than all the
// JavaScript an admin screen loads. `web/css-min.ts` opens by saying its whole reason is that
// comments were being served; two of the four sheets were not being asked.
const { PROSE_CSS } = await import(`${ROOT}src/web/prose.css.ts`)
const { INK_CSS } = await import(`${ROOT}src/pen/ink.css.ts`)
await Bun.write(`${OUT}/admin.css`, minifyCss(`${styles}\n${PROSE_CSS}`))
await Bun.write(`${OUT}/admin-ink.css`, minifyCss(INK_CSS))

// The ENTRIES only, largest first: the chunks they share are counted in the total and would
// otherwise print twenty lines of four-kilobyte noise over the number that matters.
let total = 0
const named: [string, number][] = []
for (const output of island.outputs) {
  const size = output.size ?? 0
  total += size
  const name = output.path.split(/[\\/]/).pop() ?? ''
  if (!name.startsWith('island-')) named.push([name, size])
}
for (const [name, size] of named.sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name}  ${(size / 1024).toFixed(0)} KB`)
}
const sheet = Bun.file(`${OUT}/admin.css`).size
console.log(`  admin.css  ${(sheet / 1024).toFixed(0)} KB`)
console.log(`admin: ${(total / 1024).toFixed(0)} KB of JavaScript + ${(sheet / 1024).toFixed(0)} KB of CSS`)
