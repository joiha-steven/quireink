// One headless browser, driven over the DevTools protocol, for the theme matrix.
// Same launch recipe as `tour.ts` (private profile, ephemeral debugging port read back from it).
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { chromePath } from './chrome-path'

type Params = Record<string, unknown>

/** A date the page's own clock reads, so any "N days ago" printed by a script is the same every run. */
const freezeClock = (iso: string): string => `(() => {
  const fixed = Date.parse(${JSON.stringify(iso)});
  const Real = Date;
  class Frozen extends Real {
    constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
    static now() { return fixed; }
  }
  globalThis.Date = Frozen;
})()`

/** Runs in the page after load: everything that can still move a pixel is made to finish. */
const SETTLE = `(async () => {
  const style = document.createElement('style');
  style.textContent = '*{caret-color:transparent!important;scroll-behavior:auto!important}';
  document.head.appendChild(style);
  // Lazy images below the fold would otherwise be absent from a full-page capture.
  for (const img of document.querySelectorAll('img')) { img.loading = 'eager'; }
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.complete ? null : new Promise((ok) => {
    img.addEventListener('load', ok, { once: true }); img.addEventListener('error', ok, { once: true });
  })));
  await Promise.all([...document.images].map((img) => img.decode().catch(() => null)));
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  return { look: document.documentElement.dataset.look ?? 'plain', broken: [...document.images].filter((i) => i.naturalWidth === 0).map((i) => i.currentSrc || i.src) };
})()`

export type Shot = { png: Buffer; status: number; broken: string[]; height: number; look: string }

/** A protocol command that gets no answer in this long is a hung browser, not a slow page. */
const COMMAND_TIMEOUT_MS = 30000

export class Browser {
  private socket!: WebSocket
  private nextId = 1
  private pending = new Map<number, { resolve: (v: Params) => void; reject: (e: Error) => void }>()
  private waiters: { method: string; resolve: () => void }[] = []
  private chrome!: ReturnType<typeof Bun.spawn>
  private profile = ''
  private statuses = new Map<string, number>()

  static async open(clockIso: string): Promise<Browser> {
    const b = new Browser()
    mkdirSync('.tmp', { recursive: true })
    b.profile = mkdtempSync('.tmp/theme-matrix-profile-')
    b.chrome = Bun.spawn([
      chromePath(), '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--force-color-profile=srgb', '--font-render-hinting=none',
      `--user-data-dir=${b.profile}`, '--remote-debugging-port=0', '--window-size=1440,900', 'about:blank',
    ], { stdout: 'ignore', stderr: 'ignore' })
    try {
      b.socket = new WebSocket(await b.endpoint())
      await new Promise((ok) => b.socket.addEventListener('open', ok, { once: true }))
      b.socket.addEventListener('message', (e) => b.onMessage(String(e.data)))
      b.socket.addEventListener('close', () => b.failAll(new Error('the browser closed its debugging connection')))
      await b.send('Page.enable')
      await b.send('Network.enable')
      await b.send('Page.addScriptToEvaluateOnNewDocument', { source: freezeClock(clockIso) })
    } catch (error) {
      await b.close()
      throw error
    }
    return b
  }

  private async endpoint(): Promise<string> {
    const portFile = `${this.profile}/DevToolsActivePort`
    for (let i = 0; i < 300; i++) {
      if (this.chrome.exitCode !== null) break
      try {
        const port = readFileSync(portFile, 'utf8').split('\n')[0]?.trim()
        if (port) {
          const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as { type: string; webSocketDebuggerUrl: string }[]
          const tab = tabs.find((t) => t.type === 'page')
          if (tab) return tab.webSocketDebuggerUrl
        }
      } catch { /* not up yet */ }
      await Bun.sleep(100)
    }
    await this.close()
    throw new Error('theme-matrix: the browser never opened its debugging port')
  }

  private onMessage(raw: string): void {
    const msg = JSON.parse(raw) as {
      id?: number; method?: string; result?: Params; params?: Params; error?: { code: number; message: string }
    }
    if (msg.method === 'Network.responseReceived' && msg.params) {
      const r = msg.params as { type?: string; response?: { url: string; status: number } }
      if (r.type === 'Document' && r.response) this.statuses.set(r.response.url, r.response.status)
    }
    if (msg.method) {
      this.waiters = this.waiters.filter((w) => {
        if (w.method !== msg.method) return true
        w.resolve()
        return false
      })
      return
    }
    if (msg.id === undefined) return
    const waiting = this.pending.get(msg.id)
    this.pending.delete(msg.id)
    if (!waiting) return
    if (msg.error) waiting.reject(new Error(`${msg.error.message} (code ${msg.error.code})`))
    else waiting.resolve(msg.result ?? {})
  }

  private failAll(error: Error): void {
    for (const waiting of this.pending.values()) waiting.reject(error)
    this.pending.clear()
  }

  send(method: string, params: Params = {}): Promise<Params> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${method} got no answer in ${COMMAND_TIMEOUT_MS / 1000}s`))
      }, COMMAND_TIMEOUT_MS)
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v) },
        reject: (e) => { clearTimeout(timer); reject(e) },
      })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  private event(method: string, ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), ms)
      this.waiters.push({ method, resolve: () => { clearTimeout(t); resolve() } })
    })
  }

  /** The browser as a reader's: width, light or dark through the real `prefers-color-scheme`, motion reduced. */
  async setup(width: number, scheme: 'light' | 'dark'): Promise<void> {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    await this.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: scheme },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ],
    })
  }

  async shoot(url: string): Promise<Shot> {
    const loaded = this.event('Page.loadEventFired', 30000)
    this.statuses.delete(url)
    await this.send('Page.navigate', { url })
    await loaded
    const settled = await this.send('Runtime.evaluate', { expression: SETTLE, awaitPromise: true, returnByValue: true })
    if (settled.exceptionDetails) {
      throw new Error(`the page script failed on ${url}: ${JSON.stringify(settled.exceptionDetails).slice(0, 300)}`)
    }
    const value = (settled.result as { value?: { broken: string[]; look: string } } | undefined)?.value
    // A beat for island scripts that run after load.
    await Bun.sleep(250)
    const metrics = await this.send('Page.getLayoutMetrics') as { cssContentSize: { width: number; height: number } }
    const width = Math.ceil(metrics.cssContentSize.width)
    const height = Math.ceil(metrics.cssContentSize.height)
    const shot = await this.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 },
    }) as { data: string }
    return { png: Buffer.from(shot.data, 'base64'), status: this.statuses.get(url) ?? 0, broken: value?.broken ?? [], height, look: value?.look ?? '' }
  }

  async close(): Promise<void> {
    try { this.chrome.kill(); await this.chrome.exited } catch { /* already gone */ }
    try { rmSync(this.profile, { recursive: true, force: true }) } catch { /* scratch under .tmp */ }
  }
}
