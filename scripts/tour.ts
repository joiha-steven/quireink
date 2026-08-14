// The tour: thirty-odd flows driven end to end in a real browser, with a verdict each.
//
// WHY IT EXISTS. `check:all` proves the code compiles and the seams hold; it cannot tell you a
// column collapsed to `reader@e…` or that a control the owner turned on has nothing behind it.
// Both shipped. The M3 gate asked for this and it was never written, so "every admin page has
// been opened in a real browser" has meant one person clicking once, and nothing re-checks it.
//
// HOW IT DIFFERS FROM `drive.ts`. That is a screenshot tool: one navigate, one expression, one
// PNG, then it kills Chrome. This keeps ONE browser for the whole run and asks each flow a
// question the page has to answer, so a broken flow is a line in a report rather than an image
// somebody has to interpret.
//
// EVERY ASSERTION RUNS IN THE PAGE and returns a string: `ok`, or why not. That keeps this file
// a runner rather than a second copy of the app's expectations, and it means a flow reads as the
// sentence it is checking.
//
// Usage — the whole thing, from nothing:
//
//   scripts/ops/tour.sh                 # seeds, serves, tours, tears down
//   bun scripts/tour.ts <base-url>      # against something already running
//
// Env: CHROME (binary), QUIRE_SESSION (owner cookie value), ONLY=<substring> to run a subset.

const CHROME = process.env.CHROME ?? process.env.CHROME_HEADLESS_SHELL
  ?? `${process.env.HOME}/chrome/chrome-headless-shell-linux64/chrome-headless-shell`

import { registerFlows } from './tour-flows'

const BASE = (process.argv[2] ?? 'http://127.0.0.1:3399').replace(/\/+$/, '')
const ONLY = process.env.ONLY ?? ''

// ---------------------------------------------------------------------------------------------
// The browser, over the DevTools protocol. Same approach as `drive.ts`, kept open.

const PORT = 9333
const chrome = Bun.spawn([
  CHROME, '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--force-color-profile=srgb', '--font-render-hinting=none',
  `--remote-debugging-port=${PORT}`, '--window-size=1440,900', 'about:blank',
], { stdout: 'ignore', stderr: 'ignore' })

async function endpoint(): Promise<string> {
  for (let i = 0; i < 100; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() as
        { type: string; webSocketDebuggerUrl: string }[]
      const tab = tabs.find((t) => t.type === 'page')
      if (tab) return tab.webSocketDebuggerUrl
    } catch { /* not up yet */ }
    await Bun.sleep(100)
  }
  throw new Error('chrome never opened its debugging port')
}

const socket = new WebSocket(await endpoint())
await new Promise((ok) => socket.addEventListener('open', ok, { once: true }))

let nextId = 1
const pending = new Map<number, (v: Record<string, unknown>) => void>()
socket.addEventListener('message', (e) => {
  const msg = JSON.parse(String(e.data)) as { id?: number; result?: Record<string, unknown> }
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
async function evaluate(expression: string): Promise<string> {
  const res = await send('Runtime.evaluate', {
    expression: `(async () => { try { return String(await (${expression})) } catch (e) { return 'threw: ' + e.message } })()`,
    awaitPromise: true,
    returnByValue: true,
  }) as { result?: { value?: unknown }; exceptionDetails?: { text?: string } }
  if (res.exceptionDetails) return `threw: ${res.exceptionDetails.text ?? 'unknown'}`
  return String(res.result?.value ?? '(no value)')
}

async function goto(path: string, settleMs = 700): Promise<void> {
  await send('Page.navigate', { url: `${BASE}${path}` })
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
    await send('Emulation.clearDeviceMetricsOverride')
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
for (const f of flows) {
  if (ONLY && !f.name.includes(ONLY)) continue
  const started = Date.now()
  let verdict: string
  try {
    verdict = await f.run()
  } catch (error) {
    verdict = `harness threw: ${(error as Error).message}`
  }
  results.push({ name: f.name, verdict, ms: Date.now() - started })
}

socket.close()
chrome.kill()

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
