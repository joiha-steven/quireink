// Scratch harness for the 2026-09-14 looks audit. Not product.
// One Chrome, many shots: navigate, force the reader-side attributes, capture.
import { chromePath } from './chrome-path'

const CHROME = chromePath()
const PORT = 9333
const specFile = process.argv[2]
if (!specFile) { console.error('usage: bun scripts/audit-shots.ts <spec.json>'); process.exit(1) }
type Spec = {
  url: string; out: string; palette?: string; scheme?: string; list?: string
  width?: number; height?: number; js?: string; settle?: number; full?: boolean
  dsf?: number; scrollY?: number; maxH?: number
}
const specs: Spec[] = JSON.parse(await Bun.file(specFile).text())

const proc = Bun.spawn([
  CHROME, '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--force-color-profile=srgb', '--font-render-hinting=none',
  `--user-data-dir=.tmp/audit-chrome-${process.pid}`,
  `--remote-debugging-port=${PORT}`, '--window-size=1440,1000', 'about:blank',
], { stdout: 'ignore', stderr: 'ignore' })

async function endpoint(): Promise<string> {
  for (let i = 0; i < 200; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const tabs = (await r.json()) as any[]
      const tab = tabs.find((t) => t.type === 'page')
      if (tab) return tab.webSocketDebuggerUrl
    } catch {}
    await Bun.sleep(100)
  }
  throw new Error('chrome debugging port never opened')
}

const ws = new WebSocket(await endpoint())
await new Promise<void>((res) => { ws.onopen = () => res() })
let id = 0
const pending = new Map<number, (v: any) => void>()
const events: Array<(m: any) => void> = []
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data))
  if (m.id && pending.has(m.id)) { pending.get(m.id)!(m.result ?? {}); pending.delete(m.id) }
  else for (const h of events) h(m)
}
function send(method: string, params: any = {}): Promise<any> {
  const n = ++id
  return new Promise((res) => { pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })) })
}

await send('Page.enable'); await send('Runtime.enable')

async function waitLoad(timeout = 15000) {
  return new Promise<void>((res) => {
    const t = setTimeout(() => { done() ; res() }, timeout)
    const h = (m: any) => { if (m.method === 'Page.loadEventFired') { clearTimeout(t); done(); res() } }
    const done = () => { const i = events.indexOf(h); if (i >= 0) events.splice(i, 1) }
    events.push(h)
  })
}

for (const s of specs) {
  const w = s.width ?? 1440, h = s.height ?? 1000
  await send('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: s.dsf ?? 2, mobile: (s.width ?? 1440) < 700,
  })
  const load = waitLoad()
  await send('Page.navigate', { url: s.url })
  await load
  // The reader-side attributes travel as ARGUMENTS to one fixed function, never spliced into
  // source: a value written into an expression is code the page runs (CodeQL
  // js/bad-code-sanitization). An absent value is null and the function leaves that one alone.
  const page = await send('Runtime.evaluate', { expression: 'globalThis' })
  await send('Runtime.callFunctionOn', {
    objectId: page.result.objectId,
    functionDeclaration: `function (palette, scheme, list) {
      const d = document.documentElement
      if (palette) { d.dataset.palette = palette; localStorage.setItem('palette', palette) }
      if (scheme) {
        d.dataset.scheme = scheme; d.classList.toggle('dark', scheme === 'dark')
        localStorage.setItem('theme', scheme)
      }
      if (list) { d.dataset.list = list; localStorage.setItem('list', list) }
    }`,
    arguments: [{ value: s.palette ?? null }, { value: s.scheme ?? null }, { value: s.list ?? null }],
  })
  if (s.js) await send('Runtime.evaluate', { expression: s.js, awaitPromise: true })
  if (s.scrollY !== undefined) {
    await send('Runtime.callFunctionOn', {
      objectId: page.result.objectId, functionDeclaration: 'function (y) { window.scrollTo(0, y) }',
      arguments: [{ value: Number(s.scrollY) }],
    })
  }
  await Bun.sleep(s.settle ?? 450)
  let clip: any = undefined
  if (s.full) {
    const lm = await send('Page.getLayoutMetrics')
    const hh = lm?.cssContentSize?.height ?? lm?.contentSize?.height ?? h
    clip = { x: 0, y: 0, width: w, height: Math.min(Math.ceil(hh), s.maxH ?? 9000), scale: 1 }
  }
  const shot = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: !!s.full, ...(clip ? { clip } : {}),
  })
  if (!shot?.data) { console.error(`  FAIL ${s.out}: ${JSON.stringify(shot).slice(0, 300)}`); continue }
  await Bun.write(s.out, Buffer.from(shot.data, 'base64'))
  console.log(`  ${s.out}`)
}
ws.close(); proc.kill()
