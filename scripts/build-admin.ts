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
  naming: { entry: '[name].js', chunk: '[name]-[hash].js' },
  define: { 'process.env.NODE_ENV': '"production"' },
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

// Tailwind v4 scans the source tree named in `@source`, so the utilities that reach the
// stylesheet are exactly the ones the admin uses. The installed binary is invoked by path
// rather than through `bunx`: `bunx` is not on PATH inside a Bun script on Windows, and
// resolving it here also pins the build to the version in the lockfile.
const cli = `${ROOT}node_modules/.bin/tailwindcss${process.platform === 'win32' ? '.exe' : ''}`
const css = Bun.spawnSync([
  cli,
  '-i', `${ROOT}src/admin/admin.css`,
  '-o', `${OUT}/admin.css`,
  '--minify',
], { stdout: 'inherit', stderr: 'inherit' })

if (css.exitCode !== 0) {
  console.error('admin: the stylesheet failed to build')
  process.exit(1)
}

// The editor is a `.prose` surface, so it needs the article's own typography — the same
// rules, from the same constant the public sheet uses. Appended after Tailwind rather than
// imported into `admin.css`, because Tailwind cannot import a TypeScript module and a
// second copy of a type scale stays in step for about a month.
//
// The pen comes too, and ALL of it. The public side links each half of the ink only to the
// pages whose HTML contains its element (ADR 0027), but the editor cannot know which
// gestures a post will use before the owner writes them — a stroke you cannot see while
// writing is a stroke you cannot place.
const { PROSE_CSS } = await import(`${ROOT}src/web/prose.css.ts`)
const { INK_CSS } = await import(`${ROOT}src/web/ink.css.ts`)
const sheetText = await Bun.file(`${OUT}/admin.css`).text()
await Bun.write(`${OUT}/admin.css`, `${sheetText}\n${PROSE_CSS}\n${INK_CSS}`)

let total = 0
for (const output of result.outputs) {
  const size = output.size ?? 0
  total += size
  console.log(`  ${output.path.split(/[\\/]/).pop()}  ${(size / 1024).toFixed(0)} KB`)
}
const sheet = Bun.file(`${OUT}/admin.css`).size
console.log(`  admin.css  ${(sheet / 1024).toFixed(0)} KB`)
console.log(`admin: ${(total / 1024).toFixed(0)} KB of JavaScript + ${(sheet / 1024).toFixed(0)} KB of CSS`)
