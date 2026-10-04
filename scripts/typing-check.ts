// TYPING, MEASURED IN A REAL BROWSER: Vietnamese input methods, the key sounds, and how long a
// keystroke takes to reach the screen on a short post and on a 15,000-word one.
//
// The tour opens pages and saves them; it never types the way a person does, so none of what
// this measures was visible to it. Three things are driven over the DevTools protocol:
//
//  - **A backspace-based input method** (EVKey, OpenKey, Unikey — what most Vietnamese writers
//    use): every accent is Backspace events and the rewritten letters, inside a few
//    milliseconds. Sent twice: once as `Input.insertText` behind the Backspaces, and once as
//    EVKey actually posts it on a Mac — every character a key event, stamped 1 ms apart.
//  - **A composing input method** (the Mac's and Windows' own Telex): `Input.imeSetComposition`
//    per step, committed with `Input.insertText`.
//  - **Plain typing at 80 ms a key**, to time key-to-paint and count long tasks.
//
// For each it reads back the text that landed and counts the sounds by wrapping
// `AudioBufferSourceNode.start` — headless Chrome has no speakers, so a sound is a scheduled
// source, and what it sounds like is a question for a person with ears.
//
// Usage (an instance with an owner session, as `drive.ts` takes it; `scripts/ops/tour.sh` shows
// how to seed one):
//   QUIRE_SESSION=… bun scripts/typing-check.ts http://127.0.0.1:3399
// Env: THROTTLE=4 slows the CPU fourfold, which is roughly a modest laptop doing other things.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { chromePath } from './chrome-path'
import { sweepAbandonedProfiles } from './chrome-scratch'
import { TELEX_SENTENCE, TELEX_STEPS } from '../src/admin/components/key-feedback.fixture'

const BASE = (process.argv[2] ?? 'http://127.0.0.1:3399').replace(/\/+$/, '')
const SESSION = process.env.QUIRE_SESSION ?? ''
const THROTTLE = Number(process.env.THROTTLE ?? 1)
if (!SESSION) { console.error('QUIRE_SESSION is required: the editor is behind the sign-in'); process.exit(1) }

mkdirSync('.tmp', { recursive: true })
sweepAbandonedProfiles('typing-chrome-profile-')
const PROFILE = mkdtempSync('.tmp/typing-chrome-profile-')
// The autoplay switch so the sound is counted from the first key of every page; the first-key
// path under the REAL policy is its own case below, in a browser without it.
const browser = (autoplay: boolean) => Bun.spawn([
  chromePath(), '--headless', '--no-sandbox', '--hide-scrollbars', `--user-data-dir=${PROFILE}${autoplay ? '' : '-strict'}`,
  '--remote-debugging-port=0', '--window-size=1440,900', ...(autoplay ? ['--autoplay-policy=no-user-gesture-required'] : []), 'about:blank',
], { stdout: 'ignore', stderr: 'ignore' })

type Send = (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>
type Page = { send: Send; js: <T>(expr: string) => Promise<T>; close: () => void }

async function open(autoplay: boolean): Promise<Page> {
  const proc = browser(autoplay)
  const dir = `${PROFILE}${autoplay ? '' : '-strict'}`
  let ws = ''
  for (let i = 0; i < 100 && !ws; i++) {
    try {
      const port = readFileSync(`${dir}/DevToolsActivePort`, 'utf8').split('\n')[0]!.trim()
      const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as { type: string; webSocketDebuggerUrl: string }[]
      ws = tabs.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? ''
    } catch { /* not up yet */ }
    if (!ws) await Bun.sleep(100)
  }
  if (!ws) throw new Error(`chrome never opened its debugging port (${chromePath()})`)
  const socket = new WebSocket(ws)
  await new Promise((ok) => socket.addEventListener('open', ok, { once: true }))
  let id = 1
  const pending = new Map<number, (v: Record<string, unknown>) => void>()
  socket.addEventListener('message', (e) => {
    const msg = JSON.parse(String(e.data)) as { id?: number; method?: string; result?: Record<string, unknown> }
    // A dirty sheet asks before it is left; the answer is always "leave".
    if (msg.method === 'Page.javascriptDialogOpening') socket.send(JSON.stringify({ id: id++, method: 'Page.handleJavaScriptDialog', params: { accept: true } }))
    if (msg.id !== undefined) pending.get(msg.id)?.(msg.result ?? {})
  })
  const send: Send = (method, params = {}) => new Promise((resolve) => {
    const n = id++
    pending.set(n, resolve)
    socket.send(JSON.stringify({ id: n, method, params }))
  })
  const js = async <T>(expression: string): Promise<T> => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }) as { result?: { value?: T } }
    return r.result?.value as T
  }
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  if (THROTTLE > 1) await send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  await send('Network.setCookie', { name: '__Host-quire_session', value: SESSION, url: BASE, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: WATCH })
  return { send, js, close: () => { try { socket.close() } catch { /* gone */ } proc.kill(); rmSync(dir, { recursive: true, force: true }) } }
}

/** What every page carries before its own scripts: sounds, caret twitches, long tasks, latency. */
const WATCH = `(() => {
  const q = window.__typing = { sounds: 0, twitches: 0, long: [], paint: [] }
  const start = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (...a) { q.sounds++; return start.apply(this, a) }
  const animate = Element.prototype.animate
  Element.prototype.animate = function (...a) { if (this.classList?.contains('typewriter-caret')) q.twitches++; return animate.apply(this, a) }
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) q.long.push(e.duration) }).observe({ type: 'longtask' }) } catch {}
  document.addEventListener('beforeinput', () => {
    const t0 = performance.now()
    requestAnimationFrame(() => setTimeout(() => q.paint.push(performance.now() - t0), 0))
  }, true)
})()`

const pct = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b)
  return Math.round((s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? NaN) * 10) / 10
}

async function key(page: Page, text: string, stamp?: number): Promise<void> {
  const at = stamp ? { timestamp: stamp } : {}
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', text, unmodifiedText: text, key: text, ...at })
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: text, ...at })
}
async function backspace(page: Page, stamp?: number): Promise<void> {
  const k = { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, ...(stamp ? { timestamp: stamp } : {}) }
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...k })
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k })
}

/** Open the sheet and click into the paper, as a writer does: the click is the gesture. */
async function sheet(page: Page, path: string, where: 'first' | 'middle'): Promise<void> {
  // A new piece reopens from this device's snapshot of the last one, so each run starts clean —
  // cleared from a page that is not a sheet, because leaving a sheet writes a fresh snapshot.
  await page.send('Page.navigate', { url: `${BASE}/admin` })
  await Bun.sleep(800)
  await page.js('(() => { try { localStorage.clear() } catch {} return 1 })()')
  await page.send('Page.navigate', { url: BASE + path })
  await Bun.sleep(2500)
  const at = await page.js<{ x: number; y: number }>(`(() => {
    const ps = [...document.querySelectorAll('.ProseMirror > p')].filter((p) => ${where === 'first' ? 'true' : 'p.textContent.length > 20'})
    const p = ps[${where === 'first' ? '0' : 'Math.floor(ps.length / 2)'}]
    p.scrollIntoView({ block: 'center' })
    const r = document.createRange(); r.selectNodeContents(p)
    const box = [...r.getClientRects()].at(-1) ?? p.getBoundingClientRect()
    return { x: box.right - 1, y: box.top + box.height / 2 }
  })()`)
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 })
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 })
  await Bun.sleep(800)
  await page.js('(__typing.sounds = 0, __typing.twitches = 0, __typing.long = [], __typing.paint = [], 1)')
}

/** The sentence, typed one way. Human keys 90 ms apart; a rewrite's events back to back. */
async function vietnamese(page: Page, how: 'inject' | 'oskeys' | 'compose'): Promise<string> {
  await sheet(page, '/admin/editor', 'first')
  for (const [w, steps] of TELEX_STEPS.entries()) {
    if (w > 0) { await key(page, ' '); await Bun.sleep(90) }
    let shown = ''
    for (const next of steps) {
      if (how === 'compose') {
        await page.send('Input.imeSetComposition', { text: next, selectionStart: next.length, selectionEnd: next.length })
      } else {
        let same = 0
        while (same < shown.length && shown[same] === next[same]) same++
        const drop = shown.length - same
        const add = next.slice(same)
        if (drop === 0 && add.length === 1) await key(page, add)
        else if (how === 'inject') {
          for (let i = 0; i < drop; i++) await backspace(page)
          await page.send('Input.insertText', { text: add })
        } else {
          let stamp = Date.now() / 1000
          for (let i = 0; i < drop; i++, stamp += 0.001) await backspace(page, stamp)
          for (const ch of add) { await key(page, ch, stamp); stamp += 0.001 }
        }
      }
      shown = next
      await Bun.sleep(90)
    }
    if (how === 'compose') { await page.send('Input.insertText', { text: shown }); await Bun.sleep(90) }
  }
  await Bun.sleep(400)
  const keys = TELEX_STEPS.reduce((n, s) => n + s.length, 0) + TELEX_STEPS.length - 1
  const got = await page.js<{ text: string; sounds: number; twitches: number }>(
    `({ text: document.querySelector('.ProseMirror').innerText.trim(), sounds: __typing.sounds, twitches: __typing.twitches })`)
  const ok = got.text === TELEX_SENTENCE && got.sounds === keys
  return `${ok ? 'ok' : 'FAIL'} ${keys} keys, ${got.sounds} sounds, ${got.twitches} caret twitches, text ${got.text === TELEX_SENTENCE ? 'exact' : JSON.stringify(got.text)}`
}

/** Plain typing at 80 ms a key: key-to-paint, and the long tasks among it. */
async function latency(page: Page, slug: string, n = 150): Promise<string> {
  await sheet(page, `/admin/editor/${slug}`, 'middle')
  const text = 'the quick brown fox jumps over the lazy dog '
  for (let i = 0; i < n; i++) { await key(page, text[i % text.length]!); await Bun.sleep(80) }
  await Bun.sleep(500)
  const got = await page.js<{ paint: number[]; long: number[]; sounds: number }>('__typing')
  return `p50 ${pct(got.paint, 50)} ms, p95 ${pct(got.paint, 95)} ms, ${got.long.length} long task(s)`
    + `${got.long.length ? ` (longest ${Math.round(Math.max(...got.long))} ms)` : ''}, ${got.sounds} sounds for ${n} keys`
}

/** Held keys: one press and 30 auto-repeats. A held key does not click again. */
async function held(page: Page): Promise<string> {
  await sheet(page, '/admin/editor', 'first')
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', text: 'b', key: 'b' })
  for (let i = 0; i < 30; i++) { await page.send('Input.dispatchKeyEvent', { type: 'keyDown', text: 'b', key: 'b', autoRepeat: true }); await Bun.sleep(33) }
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'b' })
  await Bun.sleep(300)
  const sounds = await page.js<number>('__typing.sounds')
  return `${sounds === 1 ? 'ok' : 'FAIL'} ${sounds} sound(s) for one press and 30 repeats`
}

/** The first key on a fresh tab, under the browser's real autoplay policy. */
async function firstKey(): Promise<string> {
  const page = await open(false)
  try {
    await sheet(page, '/admin/editor', 'first')
    const t0 = await page.js<number>('performance.now()')
    await key(page, 'a')
    await Bun.sleep(400)
    const got = await page.js<{ sounds: number; paint: number[] }>('__typing')
    return `${got.sounds === 1 ? 'ok' : 'FAIL'} ${got.sounds} sound, letter on screen ${Math.round(got.paint[0] ?? NaN)} ms after the key`
      + ` (${Math.round((await page.js<number>('performance.now()')) - t0)} ms window)`
  } finally { page.close() }
}

/** A long piece: headings, pictures, code and a pen mark on every third word. */
function longBody(): string {
  const words = 'ink paper light the reed pen draws a line that holds its weight across the page and every stroke keeps the hand that made it'.split(' ')
  const parts: string[] = []
  let n = 0
  for (let part = 1; n < 15000; part++) {
    parts.push(`## Part ${part}`)
    if (part % 2 === 0) parts.push(`![Figure ${part}](/uploads/figure-${part}.jpg)`)
    for (let p = 0; p < 4; p++) {
      const line: string[] = []
      for (let i = 0; i < 90; i++, n++) {
        const w = words[(n * 7 + i) % words.length]!
        line.push(i % 3 === 2 ? ['==', '++', '@@'][n % 3] + w + ['==', '++', '@@'][n % 3] : w)
      }
      parts.push(line.join(' ') + '.')
    }
    if (part % 3 === 0) parts.push('```ts\nconst stroke = (hand: number) => hand * 2\n```')
  }
  return parts.join('\n\n')
}

const page = await open(true)
const made: string[] = []
const results: [string, string][] = []
try {
  await page.send('Page.navigate', { url: `${BASE}/admin` })
  await Bun.sleep(1500)
  for (const [slug, content] of [['typing-check-short', 'A short post to type into.\n\nIt has two paragraphs and a ==mark== or two.'], ['typing-check-long', longBody()]] as const) {
    const body = { title: slug, slug, status: 'draft', categories: [], tags: [], content, date: new Date().toISOString() }
    const said = await page.js<string>(`fetch('/api/posts', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: ${JSON.stringify(JSON.stringify(body))} }).then((r) => r.json()).then((j) => j.data?.slug ?? '')`)
    if (!said) throw new Error(`could not make ${slug}: is QUIRE_SESSION an owner session on ${BASE}?`)
    made.push(said)
  }
  results.push(['backspace-based (insertText)', await vietnamese(page, 'inject')])
  results.push(['backspace-based (OS-stamped keys)', await vietnamese(page, 'oskeys')])
  results.push(['composing (Telex)', await vietnamese(page, 'compose')])
  results.push(['held key', await held(page)])
  results.push(['first key, fresh tab', await firstKey()])
  results.push(['latency, short post', await latency(page, made[0]!)])
  results.push(['latency, 15,000 words', await latency(page, made[1]!)])
} finally {
  for (const slug of made) {
    await page.js(`fetch('/api/posts/${slug}', { method: 'DELETE' }).then(() => fetch('/api/trash', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'posts', action: 'purge', ids: ['${slug}'] }) }))`)
  }
  page.close()
  rmSync(PROFILE, { recursive: true, force: true })
}

console.log(`typing against ${BASE}${THROTTLE > 1 ? `, CPU throttled ${THROTTLE}x` : ''}`)
for (const [name, verdict] of results) console.log(`${verdict.startsWith('FAIL') ? '✗' : '✓'} ${name}: ${verdict.replace(/^ok /, '')}`)
process.exit(results.some(([, v]) => v.startsWith('FAIL')) ? 1 : 0)
