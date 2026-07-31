// Screenshot a page AFTER doing something to it.
//
// `shot.ts` photographs a URL as the server sent it, which cannot see anything a reader has
// to click: book mode, the dark theme, the search overlay, the mobile drawer. Those are
// exactly the surfaces that shipped unlooked-at, so this drives the page over the DevTools
// protocol first — navigate, run one expression, wait, capture.
//
// Usage:
//   bun run drive <url> <out.png> <js> [width] [height] [settleMs]
//   bun run drive http://127.0.0.1:3100/a book.png "document.querySelector('[data-book-open]').click()"

const CHROME = process.env.CHROME_HEADLESS_SHELL
  ?? `${process.env.HOME}/chrome/chrome-headless-shell-linux64/chrome-headless-shell`

const [url, out, script, width = '1600', height = '1000', settle = '600', scale = '1'] =
  process.argv.slice(2)
if (!url || !out || script === undefined) {
  console.error('usage: bun run drive <url> <out.png> <js> [width] [height] [settleMs] [scale]')
  process.exit(1)
}

const PORT = 9222
const proc = Bun.spawn([
  CHROME, '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--window-size=${width},${height}`,
  // A capture at 2x for a print-quality plate, WITHOUT lying about the viewport. Shooting a
  // phone plate by asking for a 780px window instead just laid the desktop out at 780 and
  // called it a phone; the CSS width has to stay 390 and only the pixels double.
  `--force-device-scale-factor=${scale}`, 'about:blank',
], { stdout: 'ignore', stderr: 'ignore' })

/** The debugging port is not open the instant the process is. Poll rather than sleep. */
async function endpoint(): Promise<string> {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const tabs = await res.json() as { type: string; webSocketDebuggerUrl: string }[]
      const tab = tabs.find((t) => t.type === 'page')
      if (tab) return tab.webSocketDebuggerUrl
    } catch {
      /* not up yet */
    }
    await Bun.sleep(100)
  }
  throw new Error('chrome never opened its debugging port')
}

const socket = new WebSocket(await endpoint())
await new Promise((ok) => socket.addEventListener('open', ok, { once: true }))

let nextId = 1
const pending = new Map<number, (value: Record<string, unknown>) => void>()
socket.addEventListener('message', (e) => {
  const msg = JSON.parse(String(e.data)) as { id?: number; result?: Record<string, unknown> }
  if (msg.id === undefined) return
  // `id` comes off the wire, so resolve it to a value and check what came back before
  // calling it. A Map lookup cannot hand back an inherited method the way a plain object
  // can, but that is a fact about Map rather than something visible at the call site.
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

// An owner-only page needs a session, and the session cookie is HttpOnly — so it cannot be
// set from the page's own JavaScript and has to go in over the protocol. `QUIRE_SESSION` is
// the cookie VALUE; nothing is read back out, and it never touches the repository.
if (process.env.QUIRE_SESSION) {
  const { hostname } = new URL(url)
  await send('Network.enable')
  await send('Network.setCookie', {
    name: '__Host-quire_session',
    value: process.env.QUIRE_SESSION,
    domain: hostname,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  })
}

await send('Page.navigate', { url })
// Waiting on the load event would be tighter, but a fixed settle also covers the fonts and
// the island bundle, and this is a screenshot tool rather than a timing harness.
await Bun.sleep(Number(settle))
if (script) await send('Runtime.evaluate', { expression: script, awaitPromise: true })
await Bun.sleep(Number(settle))

const shot = await send('Page.captureScreenshot', { format: 'png' })
await Bun.write(out, Buffer.from(String(shot.data), 'base64'))
socket.close()
proc.kill()

console.log(`${out}  ${width}x${height}  ${(Bun.file(out).size / 1024).toFixed(0)} KB  <- ${url}`)
