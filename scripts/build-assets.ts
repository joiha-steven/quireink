// Bundle the browser code in `src/assets/js/` into `src/assets/dist/`.
//
// A separate step rather than a runtime `Bun.build` call, because `bun build --compile`
// produces a single binary with no source tree beside it: the server has to import the
// finished bundle as TEXT so the compiler can embed it. Running the bundler on the first
// request would work in development and fail in production, which is the worst order to
// discover it in.

import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// `fileURLToPath`, not `URL.pathname`: on Windows the latter yields "/C:/dev/..." and
// every filesystem call against it fails with EFAULT.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = `${ROOT}src/assets/dist`

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

const result = await Bun.build({
  entrypoints: [
    `${ROOT}src/assets/js/core.ts`,
    `${ROOT}src/assets/js/post.ts`,
    `${ROOT}src/assets/js/login.ts`,
  ],
  outdir: OUT,
  target: 'browser',
  // IIFE, not ESM, and this is load-bearing. The bundles are injected as plain
  // `<script src defer>` (see src/web/assets.ts), which is a CLASSIC script: every
  // top-level declaration lands on the global scope. Three self-contained ESM bundles have
  // no import or export left to make that a syntax error, so they loaded happily and then
  // stamped on each other — post.js declares `h` (its scroll-watch helper) and so does
  // core.js (`drawIcon`), the minifier gave both the same letter, post.js loaded second and
  // won, and clicking Dark called the button as if it were a function. Dark mode did
  // nothing until the reader reloaded. An IIFE has no top-level scope to collide in.
  format: 'iife',
  minify: true,
  // The oldest engines that still get updates. Anything older does not run the frozen
  // tree either, so this narrows nothing that was previously supported.
  //
  // A syntax error in one bundle must not silently ship an empty file, so failures below
  // are fatal.
  naming: '[name].js',
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

/**
 * A budget, in bytes, per bundle. Set just above what each currently costs, so adding a
 * feature is a deliberate act: either it fits, or the number moves in a diff someone reads.
 * A JavaScript budget nobody defends is not a budget, and the frozen tree's 143 KB of
 * framework is what that looks like after two years.
 */
const BUDGET: Record<string, number> = {
  // Every public page: the beacon, the header's overlays and controls, the grid toggle.
  //
  // Every raise is a DECISION with its cost written down, not a number nudged mid-fix. The
  // headroom is deliberately a few hundred bytes rather than twenty: twenty is not a budget,
  // it is a tripwire, and one accessibility pass went 59 over in a single commit.
  // What the current ceiling bought, most recently: the reader's palette switcher (564 bytes,
  // after the theme and palette menus became one `dropdown()` instead of two), the beacon's
  // engaged-time meter (~240 — wall-clock dwell measured furniture, one tab left open for a
  // day moved the whole site's average by minutes), and the owner's default light/dark (48,
  // read off <body> or the island overrules the paint the stylesheet just made).
  'core.js': 10_000,
  // /{slug}: back to top, code copy, lightbox, subscribe, comments, the ToC highlight and
  // book mode. Same rule as above — each raise is named and priced.
  //
  // The four worth knowing, because each buys something a reader can feel:
  //   book mode's A-/A+ and phone gestures — the type size could not be changed at all, and
  //     both server-rendered doorways hide under 768px, so phones had a book they could not open
  //   the quote gesture (1,302 raw, ~600 gzipped) — a sentence plus a `#:~:text=` fragment,
  //     which needs no account, no third party, and no change in the renderer `golden/` pins
  //   the comment stamp, ADR 0032 (761 bytes) — the best value in this file: the alternative
  //     was Turnstile, an account and ~60 KB from challenges.cloudflare.com on every page with
  //     a form, on a site whose whole claim is zero third-party requests
  //   the reading position (~1.1 KB) — a forty-minute read is never one sitting
  'post.js': 17_000,
  // /login only, and NOT loaded with core.js: the sign-in page carries no beacon, no
  // search overlay and no listing controls, so it pays for the reveal toggle, the caps-lock
  // warning and the one-time-code paste, and nothing else.
  'login.js': 1_500,
}

let over = false
for (const output of result.outputs) {
  const name = output.path.split(/[\\/]/).pop() ?? ''
  const size = (await output.text()).length
  const budget = BUDGET[name]
  console.log(`${output.path.slice(ROOT.length)}  ${size} b${budget ? ` / ${budget} b` : ''}`)
  if (budget && size > budget) {
    console.error(`  over budget by ${size - budget} b. Make it smaller, or move the number.`)
    over = true
  }
}
if (over) process.exit(1)
