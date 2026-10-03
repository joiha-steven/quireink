// `bun run test:cf` — the port contracts inside workerd, the runtime Cloudflare runs (ADR 0066).
//
// Builds `scripts/cf-test/worker.ts` with the Cloudflare side of the seam, starts it with
// `wrangler dev --local` on a free port, runs every case of every contract in a Durable Object of its
// own, and prints one line per case. Red if any case fails or the worker does not come up. The Bun
// side runs the same suites under `bun test`.
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import { rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const PORT = Number(process.env.CF_TEST_PORT || 8797)
const STATE = join(ROOT, '.tmp', 'cf-test-state')
const SMTP_PORT = Number(process.env.CF_TEST_SMTP_PORT || PORT + 1)

// A relay for the smtp case: greets, takes any AUTH, and answers DATA with 250 only once the line
// that is a lone `.` arrives — which is what makes a 250 mean the whole body crossed.
// The second one offers STARTTLS, says go ahead, and hangs up at the handshake it cannot finish.
const relayOn = (port: number, starttls: boolean) => net.createServer((socket) => {
  let inData = false
  socket.write('220 test relay\r\n')
  let pending = ''
  socket.on('data', (bytes) => {
    pending += bytes.toString()
    let at: number
    while ((at = pending.indexOf('\r\n')) >= 0) {
      const line = pending.slice(0, at)
      pending = pending.slice(at + 2)
      if (inData) {
        if (line === '.') { inData = false; socket.write('250 queued\r\n') }
        continue
      }
      const verb = line.slice(0, 4).toUpperCase()
      if (verb === 'EHLO') socket.write(starttls ? '250-test relay\r\n250 STARTTLS\r\n' : '250-test relay\r\n250 AUTH PLAIN\r\n')
      else if (verb === 'STAR') { socket.write('220 go ahead\r\n'); pending = ''; socket.once('data', () => socket.destroy()); return }
      else if (verb === 'AUTH') socket.write('235 ok\r\n')
      else if (verb === 'MAIL' || verb === 'RCPT') socket.write('250 ok\r\n')
      else if (verb === 'DATA') { inData = true; socket.write('354 go on\r\n') }
      else if (verb === 'QUIT') { socket.write('221 bye\r\n'); socket.end() }
      else socket.write('500 what\r\n')
    }
  })
}).listen(port, '127.0.0.1')
const relays = [relayOn(SMTP_PORT, false), relayOn(SMTP_PORT + 1, true)]

// A bucket for the off-site case: S3's multipart verbs and nothing else, path-style. It keeps only
// sizes, so a 40 MB upload costs this process nothing, and answers what it saw at `/__seen/<key>`.
const S3_PORT = Number(process.env.CF_TEST_S3_PORT || PORT + 3)
const s3Uploads = new Map<string, { key: string; sizes: Map<number, number> }>()
const s3Seen = new Map<string, { size: number; parts: number; largest: number }>()
const s3 = Bun.serve({
  port: S3_PORT, hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url)
    const q = url.searchParams
    if (url.pathname.startsWith('/__seen/')) return Response.json(s3Seen.get(decodeURIComponent(url.pathname.slice(8))) ?? null)
    const key = decodeURIComponent(url.pathname.replace(/^\/[^/]+\//, ''))
    const size = (await req.arrayBuffer()).byteLength
    if (!(req.headers.get('authorization') ?? '').startsWith('AWS4-HMAC-SHA256 ')) return new Response('unsigned', { status: 403 })
    if (req.method === 'POST' && q.has('uploads')) {
      const id = crypto.randomUUID()
      s3Uploads.set(id, { key, sizes: new Map() })
      return new Response(`<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`)
    }
    const upload = s3Uploads.get(q.get('uploadId') ?? '')
    if (upload && req.method === 'PUT') {
      upload.sizes.set(Number(q.get('partNumber')), size)
      return new Response('', { headers: { etag: `"${q.get('partNumber')}"` } })
    }
    if (upload && req.method === 'POST') {
      const sizes = [...upload.sizes.values()]
      s3Seen.set(upload.key, { size: sizes.reduce((a, b) => a + b, 0), parts: sizes.length, largest: Math.max(...sizes) })
      s3Uploads.delete(q.get('uploadId')!)
      return new Response('<CompleteMultipartUploadResult/>')
    }
    if (req.method === 'PUT') { s3Seen.set(key, { size, parts: 1, largest: size }); return new Response('') }
    return new Response('unhandled', { status: 400 })
  },
})

const built = spawnSync(process.execPath, ['scripts/build-worker.ts', '--entry', 'scripts/cf-test/worker.ts', '--out', 'dist/cf-test'], { cwd: ROOT, stdio: 'inherit' })
if (built.status !== 0) process.exit(1)

rmSync(STATE, { recursive: true, force: true })
const dev = spawn(join(ROOT, 'node_modules', '.bin', 'wrangler'), ['dev', '--local', '--port', String(PORT), '--persist-to', STATE, '--var', `CF_TEST_SMTP_PORT:${SMTP_PORT}`, '--var', `CF_TEST_S3_PORT:${S3_PORT}`, '--config', 'scripts/cf-test/wrangler.jsonc'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''
dev.stdout.on('data', (d) => { log += d })
dev.stderr.on('data', (d) => { log += d })
const stop = () => {
  try { dev.kill('SIGTERM') } catch { /* gone */ }
  for (const r of relays) r.close()
  s3.stop(true)
}
process.on('exit', stop)

const base = `http://127.0.0.1:${PORT}`
let cases: string[] | null = null
for (let i = 0; i < 90 && !cases; i++) {
  try {
    const res = await fetch(`${base}/cases`)
    if (res.ok) cases = (await res.json()) as string[]
  } catch { /* not up yet */ }
  if (!cases) await Bun.sleep(1000)
}
if (!cases) {
  console.error('✗ test:cf: the contract worker never came up\n' + log.slice(-2000))
  stop()
  process.exit(1)
}

let failed = 0
for (let i = 0; i < cases.length; i++) {
  const result = (await (await fetch(`${base}/run?case=${i}`)).json()) as { name: string; ok: boolean; error?: string }
  if (result.ok) console.log(`  ✓ ${result.name}`)
  else { failed++; console.log(`  ✗ ${result.name} — ${result.error}`) }
}

// HIGHLIGHTING, ASKED OF BOTH RUNTIMES AND COMPARED. Not a case inside the worker, because the answer
// it is held to is Bun's, and only this process has Bun: the same fences go to `highlightCode` here
// and in workerd, where the grammars come from Static Assets instead of modules (2026-10-03), and the
// HTML must be the same string. Ids, Shiki's aliases (`ts`, `sh`, `1c`), this product's (`terminal`),
// grammars that embed a dozen others (`markdown`, `vue`), and a name nobody has.
const CODE = 'const a: number = 1 // note\nfunction f(b) { return `${b}` + "s" }\n<div class="x">{a}</div>\n$ echo "$HOME"'
const SAMPLES = ['typescript', 'ts', 'sh', 'bash', 'python', 'rust', 'html', 'markdown', 'vue', 'php', '1c', 'terminal', 'postgres', 'notalanguage']
  .map((lang) => ({ code: CODE, lang }))
const { highlightCode } = await import('../src/render/highlight')
const fromWorkerd = await fetch(`${base}/highlight`, { method: 'POST', body: JSON.stringify(SAMPLES) })
  .then((r) => r.json() as Promise<(string | null)[]>, () => [] as (string | null)[])
const differ: string[] = []
for (const [i, { code, lang }] of SAMPLES.entries()) {
  const bun = await highlightCode(code, lang)
  if (bun === null || fromWorkerd[i] !== bun) differ.push(lang)
}
if (differ.length) { failed++; console.log(`  ✗ highlight: workerd and Bun disagree on ${differ.join(', ')}`) }
else console.log(`  ✓ highlight: ${SAMPLES.length} fences give the same HTML in workerd as in Bun, byte for byte`)
const total = cases.length + 1

stop()
console.log(failed ? `✗ test:cf: ${failed} of ${total} failed in workerd` : `✓ test:cf: ${total} case(s) pass in workerd`)
process.exit(failed ? 1 : 0)
