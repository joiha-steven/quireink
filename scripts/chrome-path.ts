// Where the headless browser is, on whichever machine this is.
//
// `tour.ts`, `drive.ts` and `shot.ts` each carried the same line:
//
//   process.env.CHROME ?? process.env.CHROME_HEADLESS_SHELL
//     ?? `${HOME}/chrome/chrome-headless-shell-linux64/chrome-headless-shell`
//
// One hardcoded LINUX path, three times. On a Mac none of the three can run, and what they
// print is `ENOENT ... chrome-headless-shell-linux64` — a path with the wrong platform in its
// name, offering no hint that the fix is one `@puppeteer/browsers install` away. The tour is
// this project's main verification tool (`CLAUDE.md`), so a developer on the wrong platform
// meets it as a stack trace on their first run.
//
// So: the same env vars first, then every layout the browser is actually installed in, and a
// real message naming the command when none of them is there.

import { existsSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const HOME = process.env.HOME ?? ''

/**
 * `@puppeteer/browsers` installs to `<root>/chrome-headless-shell/<platform>-<version>/…`, and
 * the version is in the directory name — so the path cannot be written down, only found. Newest
 * last after a sort, which is what a lexical sort of `mac_arm-152.0.7977.42` gives.
 */
function puppeteerInstall(root: string): string | null {
  const base = join(root, 'chrome-headless-shell')
  if (!existsSync(base)) return null
  const versions = readdirSync(base).sort()
  for (const v of versions.reverse()) {
    for (const leaf of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64',
      'chrome-headless-shell-linux64', 'chrome-headless-shell-win64']) {
      const exe = join(base, v, leaf, leaf.endsWith('win64') ? 'chrome-headless-shell.exe' : 'chrome-headless-shell')
      if (existsSync(exe)) return exe
    }
  }
  return null
}

const CANDIDATES = [
  // The manual unzip `shot.ts` documents, kept first so an existing machine is unaffected.
  `${HOME}/chrome/chrome-headless-shell-linux64/chrome-headless-shell`,
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  // Full Chrome is a usable last resort: slower to start and it draws a profile, but every
  // flow the tour runs works in it.
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]

/** The browser binary, or a thrown error that says how to get one. */
export function chromePath(): string {
  const named = process.env.CHROME ?? process.env.CHROME_HEADLESS_SHELL
  if (named) return named
  const found = puppeteerInstall(`${HOME}/chrome`) ?? CANDIDATES.find((p) => existsSync(p))
  if (found) return found
  throw new Error(
    'no headless browser found. Install one:\n'
    + '  bunx @puppeteer/browsers install chrome-headless-shell@stable --path "$HOME/chrome"\n'
    + 'or point CHROME at a binary you already have.',
  )
}
