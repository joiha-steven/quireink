// The tour: sixty-odd flows driven end to end in a real browser, with a verdict each.
//
// WHY IT EXISTS. `check:all` proves the code compiles and the seams hold; it cannot tell you a
// column collapsed to `reader@e…` or that a control the owner turned on has nothing behind it.
// Both shipped. The M3 gate asked for this and it was never written, so "every admin page has
// been opened in a real browser" meant one person clicking once, with nothing re-checking it.
//
// HOW IT DIFFERS FROM `drive.ts`: that is a screenshot tool — one navigate, one expression, one
// PNG, then it kills Chrome. This keeps ONE browser for the whole run and asks each flow a
// question the page has to answer, so a broken flow is a line in a report rather than an image
// somebody has to interpret.
//
// EVERY ASSERTION RUNS IN THE PAGE and returns a string: `ok`, or why not. That keeps this a
// runner rather than a second copy of the app's expectations.
//
//   scripts/ops/tour.sh                 # seeds, serves, tours, tears down
//   bun scripts/tour.ts <base-url>      # against something already running
//
// Env: CHROME (binary), QUIRE_SESSION (owner cookie value), ONLY=<substring> for a subset.

import { mkdirSync, openSync, readFileSync, rmSync, mkdtempSync } from 'node:fs'
import { chromePath } from './chrome-path'
import { sweepAbandonedProfiles } from './chrome-scratch'
import { registerFlows } from './tour-flows'

const CHROME = chromePath()

const BASE = (process.argv[2] ?? 'http://127.0.0.1:3399').replace(/\/+$/, '')
const ONLY = process.env.ONLY ?? ''

// ---------------------------------------------------------------------------------------------
// The browser, over the DevTools protocol. Same approach as `drive.ts`, kept open.

// `--user-data-dir` is LOAD-BEARING for full Chrome, not tidiness: since Chrome 136 the
// remote-debugging switches are silently IGNORED on the default profile (a data-theft
// mitigation), so without a private dir the port never opens and the error below reads
// like a startup hang. chrome-headless-shell does not care — which is exactly why this
// passed on every dev machine and died on the first CI runner, where the fallback binary
// is full google-chrome. Found on the tour job's first run, 2026-08-29.
//
// Unique per run rather than named after the pid: a pid comes round again, and a run that
// died before its cleanup leaves its directory behind for the next one to open.
//
// `.tmp` FIRST: `mkdtempSync` does not make the parent, so on a fresh clone — where nothing
// has written under `.tmp` yet — this line was the first thing the tour did and it threw
// ENOENT before the tour had printed a word.
mkdirSync('.tmp', { recursive: true })

// PROFILES FROM RUNS THAT DIED, SWEPT ON THE WAY IN. A browser killed with SIGTERM keeps
// writing into its profile for a beat after the signal, so the tidy-up at the end waits for
// the process to be gone — and a run that is itself killed cannot wait for anything.
// `chrome-scratch.ts` holds the rule and the measurement.
const swept = sweepAbandonedProfiles('tour-chrome-profile-')
if (swept) console.log(`  swept ${swept} abandoned chrome profile(s) from earlier runs`)

const PROFILE = mkdtempSync('.tmp/tour-chrome-profile-')
// CHROME'S STDERR IS KEPT, not discarded. When the port does not open, the process is
// usually still running and has already said why on stderr — a profile it could not lock, a
// sandbox it could not build, a library it could not load. With the stream thrown away the
// only evidence left is the timeout below, and that names no cause: the CI tour job died
// here on 2026-09-01 (run 33522127129), passed on a rerun of the same commit, and left
// nothing anybody could read to tell the two apart.
const CHROME_LOG = `.tmp/tour-chrome-${process.pid}.log`

/**
 * THE DEBUGGING PORT IS CHOSEN BY CHROME AND READ BACK OUT OF THIS RUN'S OWN PROFILE.
 *
 * It used to be the constant 9333, and a constant is a place two browsers can meet. A port
 * answers whoever is on it, so with another headless Chrome already there — one of this
 * repository's own screenshot scripts, or a tour that was killed without taking its browser
 * with it — the tour spawned a browser, ignored it, and drove the OLD one, which has a
 * different profile and therefore a different HTTP cache.
 *
 * It cost an afternoon on 2026-09-07. A stale browser was serving a post page cached from a
 * server that no longer existed, so the comment flow solved a proof-of-work challenge whose
 * signature belonged to a dead instance's secret and read `a solved comment was refused:
 * 400` against a build with nothing wrong with it. Every other flow passed, because nothing
 * else in the tour cares which copy of a page it looks at. The answer then was a guard that
 * REFUSED to start when the port was taken — which turned a leaked browser from the previous
 * run into a red run of its own, seen again on 2026-09-14.
 *
 * Port 0 ends both. Chrome takes a free port and writes it into `DevToolsActivePort` in the
 * profile directory, and that directory is one this process made a minute ago: the port
 * cannot belong to anybody else, two tours cannot collide, and an orphan holds a number
 * nothing will ever ask for.
 */
const PORT_FILE = `${PROFILE}/DevToolsActivePort`

const chromeLog = openSync(CHROME_LOG, 'w')
const chrome = Bun.spawn([
  CHROME, '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--force-color-profile=srgb', '--font-render-hinting=none',
  `--user-data-dir=${PROFILE}`,
  '--remote-debugging-port=0', '--window-size=1440,900', 'about:blank',
], { stdout: 'ignore', stderr: chromeLog })

/**
 * TAKE THE BROWSER WITH US, WHATEVER ENDS THIS PROCESS.
 *
 * The kill used to sit on the happy path only, so every other way a run can end — a Ctrl-C, a
 * `kill` from the shell that started it, a throw before the flows, a CI job that timed out —
 * left a headless Chrome and a profile directory behind. Seen on 2026-09-14: one leaked
 * browser from an interrupted run, and the next run refused to start at all.
 *
 * Idempotent, because the normal path calls it and then exits, which calls it again. SIGKILL
 * is the one signal that cannot be answered; the ephemeral port above is what keeps even that
 * from costing the next run anything.
 */
let closed = false
function closeBrowser(): void {
  if (closed) return
  closed = true
  try { chrome.kill() } catch { /* already gone */ }
  try { rmSync(PROFILE, { recursive: true, force: true }) } catch { /* scratch under .tmp */ }
  try { rmSync(CHROME_LOG, { force: true }) } catch { /* scratch under .tmp */ }
}

/**
 * The same, for the paths that can wait — which is every path but a signal.
 *
 * ⚠️ THE WAIT IS WHAT MAKES THE PROFILE GO AWAY. `kill()` returns the moment the signal is
 * sent, and Chrome writes into `Default/` for a beat after it: removing the directory in that
 * beat leaves the browser to recreate it, which is how twenty-eight profiles accumulated
 * under `.tmp` while every run reported a clean exit.
 */
async function partWithBrowser(): Promise<void> {
  try { chrome.kill(); await chrome.exited } catch { /* already gone */ }
  closeBrowser()
}

process.on('exit', closeBrowser)
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  // 128 + the signal number, the shell's own convention for "ended by this signal".
  process.on(signal, () => { closeBrowser(); process.exit(signal === 'SIGINT' ? 130 : 143) })
}

async function endpoint(): Promise<string> {
  // 30s, not 10: full Chrome's first start on a cold CI runner unpacks crashpad and
  // friends, and a timeout that only ever fires there is a flake, not a signal.
  let port = ''
  let answered = false
  let types = 'none'
  for (let i = 0; i < 300; i++) {
    // A dead browser will not open a port. Polling one for the full thirty seconds turns a
    // crash into a timeout and hides the exit code that says what happened.
    if (chrome.exitCode !== null) break
    // The port file is written as the LAST step of startup, so its absence is simply "not
    // yet" for as long as the process is alive.
    if (!port) {
      try { port = readFileSync(PORT_FILE, 'utf8').split('\n')[0]?.trim() ?? '' } catch { /* not yet */ }
    }
    if (port) {
      try {
        const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as
          { type: string; webSocketDebuggerUrl: string }[]
        answered = true
        types = tabs.map((t) => t.type).join(', ') || 'none'
        const tab = tabs.find((t) => t.type === 'page')
        if (tab) return tab.webSocketDebuggerUrl
      } catch { /* not up yet */ }
    }
    await Bun.sleep(100)
  }

  // FOUR FAILURES WEAR THE SAME FACE and the old message covered them with one sentence: the
  // process died on startup, it never said which port it took, the port never answered, or it
  // answered with no page in it. They are fixed in different places, so the wait records which
  // one it is on the way out.
  const why = chrome.exitCode !== null
    ? `chrome exited with code ${chrome.exitCode}`
    : !port
      ? 'chrome never wrote a debugging port into its profile'
      : answered
        ? `the port answered but served no page tab (tabs: ${types})`
        : `port ${port} never answered`
  let said = ''
  try {
    said = readFileSync(CHROME_LOG, 'utf8').trimEnd().split('\n').slice(-8).join('\n')
  } catch { /* nothing was written */ }
  // The log is read BEFORE this, because closing takes it with it.
  await partWithBrowser()
  throw new Error(
    `chrome never opened its debugging port — ${why}\n`
    + `  binary:  ${CHROME}\n`
    + `  profile: ${PROFILE}\n`
    + (said ? `  chrome said:\n${said.replace(/^/gm, '    ')}` : '  chrome said nothing on stderr'),
  )
}

const socket = new WebSocket(await endpoint())
await new Promise((ok) => socket.addEventListener('open', ok, { once: true }))

let nextId = 1
const pending = new Map<number, (v: Record<string, unknown>) => void>()
socket.addEventListener('message', (e) => {
  const msg = JSON.parse(String(e.data)) as { id?: number; method?: string; result?: Record<string, unknown> }
  /**
   * ⚠️ A DIALOG IS ANSWERED, NOT WAITED ON, and without this the tour can stop dead.
   *
   * A screen with unsaved work registers `beforeunload` (`admin/island/lib/settings-save.ts`
   * for the settings form, `admin/island/lib/sheet-safety.ts` for the writing sheet), and the
   * browser then raises a confirm panel on any REAL navigation away from it. `Page.navigate`
   * does not reply until that panel is answered, and nothing was answering it, so the run hung
   * on the page it was leaving, with no output, looking exactly like a tour still working. Cost
   * forty minutes on 2026-09-14, when ADR 0054 was turning in-app routes into real navigations
   * a screen at a time. Every admin route is a real navigation now, so this is permanent.
   *
   * ACCEPT, which for `beforeunload` means "leave the page". The tour is not testing that the
   * browser's own warning appears: nothing running inside the page can see that dialog at all,
   * and the half that IS assertable, the product's own three-way question, is covered by
   * `tour-flows-guard.ts`. This is testing what is on the next page, and a tour that cannot
   * leave a dirty form cannot reach it.
   */
  if (msg.method === 'Page.javascriptDialogOpening') {
    socket.send(JSON.stringify({ id: nextId++, method: 'Page.handleJavaScriptDialog', params: { accept: true } }))
    return
  }
  if (msg.id === undefined) return
  const resolve = pending.get(msg.id)
  if (typeof resolve === 'function') resolve(msg.result ?? {})
})

const send = (method: string, params: Record<string, unknown> = {}) =>
  new Promise<Record<string, unknown>>((resolve) => {
    const id = nextId++
    pending.set(id, resolve)
    socket.send(JSON.stringify({ id, method, params }))
  })

await send('Page.enable')
await send('Runtime.enable')
// THE VIEWPORT IS SET OVER THE PROTOCOL, the way drive.ts sets it. `--window-size=1440,900`
// alone gives a page 900 tall in chrome-headless-shell (CI) and 757 tall in full Chrome's
// headless mode (a laptop), which takes the window's own frame out of the same number. A
// flow that measures against the viewport (the 60vh floor on a settings tab) then passes on
// one machine and not the other with nothing in the product changed.
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }
await send('Emulation.setDeviceMetricsOverride', DESKTOP)
await send('Network.enable')

// `url`, not `domain`: the `__Host-` prefix requires no Domain attribute, and setting one makes
// Chrome drop the cookie silently — every admin flow would then be touring the sign-in page.
if (process.env.QUIRE_SESSION) {
  await send('Network.setCookie', {
    name: '__Host-quire_session', value: process.env.QUIRE_SESSION,
    url: BASE, path: '/', httpOnly: true, secure: true, sameSite: 'Lax',
  })
}

/** Evaluate in the page and hand back whatever it returned, as a string. */
/**
 * How long one flow's script may run before the tour gives up on it.
 *
 * ⚠️ A CEILING, NOT A BUDGET. Nothing here should take thirty seconds; the number exists
 * because a script that NAVIGATES THE PAGE IT IS RUNNING IN destroys its own execution
 * context, so `Runtime.evaluate` never replies and the whole run stops with no output on the
 * page it was leaving. That happened twice on 2026-09-14, forty minutes each, and it will keep
 * happening: every screen ADR 0054 converts turns another in-app route into a real navigation,
 * so a flow that used to click a link and stay put now leaves.
 *
 * The verdict says so in as many words, because the cause is not guessable from a timeout.
 */
const FLOW_MS = 30_000

async function evaluate(expression: string): Promise<string> {
  const answered = send('Runtime.evaluate', {
    expression: `(async () => { try { return String(await (${expression})) } catch (e) { return 'threw: ' + e.message } })()`,
    awaitPromise: true,
    returnByValue: true,
  }) as Promise<{ result?: { value?: unknown }; exceptionDetails?: { text?: string } }>
  const res = await Promise.race([
    answered,
    Bun.sleep(FLOW_MS).then(() => null),
  ])
  if (res === null) {
    return `never answered in ${FLOW_MS / 1000}s — a script that navigates the page it runs in`
      + ' destroys its own context; hand the href back and open it with a second expect()'
  }
  if (res.exceptionDetails) return `threw: ${res.exceptionDetails.text ?? 'unknown'}`
  return String(res.result?.value ?? '(no value)')
}

/**
 * Open a path and let it settle.
 *
 * ⚠️ THE SAME CEILING AS `evaluate`, and it is here because the run hung for forty-five minutes
 * without it. A flow that leaves the page it is on — the editor's Move to Trash does, now that
 * the sheet is a page — hands back its verdict and the browser goes on navigating; the NEXT
 * flow's `Page.navigate` then lands mid-navigation and Chrome never answers it. `evaluate`
 * already refused to wait forever for exactly this reason. A harness that can stop with no
 * output is worse than one that reports a slow step: the flow after this one still runs.
 */
async function goto(path: string, settleMs = 700): Promise<void> {
  await Promise.race([send('Page.navigate', { url: `${BASE}${path}` }), Bun.sleep(FLOW_MS)])
  await Bun.sleep(settleMs)
}

// ---------------------------------------------------------------------------------------------
// The runner. A flow that throws is a failure, never the end of the run: the point of a tour is
// the whole list, and stopping at the first red hides the other twenty-nine.

type Flow = { name: string; run: () => Promise<string> }
const flows: Flow[] = []
const flow = (name: string, run: () => Promise<string>) => flows.push({ name, run })

/** Assertion sugar: the page returns `ok` or a reason, and anything else is the reason. */
const expect = async (path: string, expr: string, settleMs?: number): Promise<string> => {
  await goto(path, settleMs)
  return evaluate(expr)
}

/**
 * The same, at a PHONE width.
 *
 * The tour ran every flow at 1440 and therefore could not see a whole class of bug the repo has
 * already been bitten by twice — the analytics table that ran to 426px inside a 390px screen,
 * and the Overview's widget band, which at 375px sized its grid track to 406px and left 47px of
 * the page reachable only by dragging it sideways.
 *
 * ⚠️ It has to be the VIEWPORT, not the element. The first attempt at that second flow squeezed
 * the grid's own width instead, and passed against a build with the bug still in it: the
 * one-column layout is a `lg:` media query, so a narrow BOX still lays out as two columns and
 * the track never has to hold a whole card. Nothing but a narrow viewport reproduces it.
 *
 * `mobile: true` so `@media (hover: none)` matches too, and the override is always cleared —
 * a flow that leaves the window 375px wide changes every flow after it.
 */
const atWidth = async (width: number, path: string, expr: string, settleMs?: number): Promise<string> => {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: true })
  try {
    return await expect(path, expr, settleMs)
  } finally {
    // Back to the desktop viewport set at startup, not to no override at all.
    await send('Emulation.setDeviceMetricsOverride', DESKTOP)
  }
}

/** What a flow file is handed. The verbs, and nothing about the protocol. */
export type Tour = {
  flow: (name: string, run: () => Promise<string>) => void
  expect: (path: string, expr: string, settleMs?: number) => Promise<string>
  atWidth: (width: number, path: string, expr: string, settleMs?: number) => Promise<string>
}

registerFlows({ flow, expect, atWidth })

// ---------------------------------------------------------------------------------------------
// Run them, in order, and report.

const results: { name: string; verdict: string; ms: number }[] = []
const picked = flows.filter((f) => !ONLY || f.name.includes(ONLY))
for (const [i, f] of picked.entries()) {
  // ⚠️ THE NAME GOES OUT BEFORE THE FLOW RUNS, on stderr, and this is a diagnostic that paid
  // for itself the day it was written. The verdicts below print only when the whole tour is
  // over, so a flow that never returns — a script that navigates the page it is running in,
  // say, which destroys its own execution context — looks exactly like a tour that is still
  // working. Twice that cost forty minutes of waiting on a run that was already dead.
  //
  // `\r` and no newline: a finished flow's line is overwritten by the next one, so a passing
  // run still ends with the clean summary below and only a STALL leaves a name on the screen.
  process.stderr.write(`\r  [${i + 1}/${picked.length}] ${f.name.slice(0, 78).padEnd(78)}`)
  const started = Date.now()
  let verdict: string
  try {
    verdict = await f.run()
  } catch (error) {
    verdict = `harness threw: ${(error as Error).message}`
  }
  results.push({ name: f.name, verdict, ms: Date.now() - started })
}
process.stderr.write(`\r${' '.repeat(92)}\r`)

socket.close()
await partWithBrowser()

const skipped = results.filter((r) => r.verdict.startsWith('skip:'))
const failed = results.filter((r) => r.verdict !== 'ok' && !r.verdict.startsWith('ok ') && !r.verdict.startsWith('skip:'))

for (const r of results) {
  const mark = r.verdict === 'ok' || r.verdict.startsWith('ok ') ? '✓'
    : r.verdict.startsWith('skip:') ? '–' : '✗'
  const detail = r.verdict === 'ok' ? '' : `  ${r.verdict}`
  console.log(`${mark} ${r.name} (${r.ms}ms)${detail}`)
}

console.log('')
console.log(`${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped, of ${results.length} flows against ${BASE}`)
process.exit(failed.length === 0 ? 0 : 1)
