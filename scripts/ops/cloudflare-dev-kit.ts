// What `cloudflare-dev.ts` needs besides the two blogs: a bucket to copy backups into, a reading of
// workerd's memory while it works, and the question restore-check asks of rows and uploads, put to
// a blog that went Bun → Cloudflare → Bun. Plain helpers; the script is the story.
import { Database } from 'bun:sqlite'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'

// ----- a bucket ------------------------------------------------------------------------------------

export type Landed = { size: number; parts: number; largestPart: number; sha256: string }

/**
 * An S3 bucket in a few lines: a PUT, and the multipart verbs, path-style. Parts go to disk under
 * `dir` and are hashed in order when the upload completes, so a 140 MB archive costs this process a
 * part at a time, and what landed can be compared byte for byte (by SHA-256) with the download.
 */
export function fakeBucket(port: number, dir: string): { landed: Map<string, Landed>; stop: () => void } {
  mkdirSync(dir, { recursive: true })
  const landed = new Map<string, Landed>()
  const uploads = new Map<string, { key: string; parts: Map<number, number> }>()
  const server = Bun.serve({
    port, hostname: '127.0.0.1', maxRequestBodySize: 128 * 1024 * 1024,
    async fetch(req) {
      const url = new URL(req.url)
      const q = url.searchParams
      const key = decodeURIComponent(url.pathname.replace(/^\/[^/]+\/?/, ''))
      if (!(req.headers.get('authorization') ?? '').startsWith('AWS4-HMAC-SHA256 ')) {
        await req.arrayBuffer()
        return new Response('<Error><Code>AccessDenied</Code></Error>', { status: 403 })
      }
      if (req.method === 'POST' && q.has('uploads')) {
        const id = crypto.randomUUID()
        uploads.set(id, { key, parts: new Map() })
        return new Response(`<InitiateMultipartUploadResult><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`)
      }
      const upload = uploads.get(q.get('uploadId') ?? '')
      if (upload && req.method === 'PUT') {
        const n = Number(q.get('partNumber'))
        upload.parts.set(n, await Bun.write(join(dir, `${q.get('uploadId')}.${n}`), req))
        return new Response('', { headers: { etag: `"${n}"` } })
      }
      if (upload && req.method === 'POST') {
        await req.arrayBuffer()
        const order = [...upload.parts.keys()].sort((a, b) => a - b)
        const hash = new Bun.CryptoHasher('sha256')
        for (const n of order) for await (const c of Bun.file(join(dir, `${q.get('uploadId')}.${n}`)).stream()) hash.update(c)
        const sizes = order.map((n) => upload.parts.get(n)!)
        landed.set(upload.key, { size: sizes.reduce((a, b) => a + b, 0), parts: sizes.length, largestPart: Math.max(...sizes), sha256: hash.digest('hex') })
        uploads.delete(q.get('uploadId')!)
        return new Response('<CompleteMultipartUploadResult/>')
      }
      if (upload && req.method === 'DELETE') { uploads.delete(q.get('uploadId')!); return new Response(null, { status: 204 }) }
      if (req.method === 'PUT') {
        const bytes = new Uint8Array(await req.arrayBuffer())
        landed.set(key, { size: bytes.length, parts: 1, largestPart: bytes.length, sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex') })
        return new Response('')
      }
      if (req.method === 'DELETE') { landed.delete(key); return new Response(null, { status: 204 }) }
      if (req.method === 'GET' && q.has('list-type')) {
        const keys = [...landed.keys()].filter((k) => k.startsWith(q.get('prefix') ?? ''))
        return new Response(`<ListBucketResult><IsTruncated>false</IsTruncated>${keys.map((k) => `<Contents><Key>${k}</Key></Contents>`).join('')}</ListBucketResult>`)
      }
      return new Response('unhandled', { status: 400 })
    },
  })
  return { landed, stop: () => { server.stop(true); rmSync(dir, { recursive: true, force: true }) } }
}

// ----- workerd's memory ------------------------------------------------------------------------------

/** Resident memory, in MB, of every `workerd` process under `root` (wrangler's own pid). */
export function workerdMb(root: number): number {
  const rows = spawnSync('ps', ['-A', '-o', 'pid=,ppid=,rss=,comm='], { encoding: 'utf8' }).stdout.trim().split('\n')
    .map((l) => l.trim().split(/\s+/)).map(([pid, ppid, rss, ...comm]) => ({ pid: Number(pid), ppid: Number(ppid), rss: Number(rss), comm: comm.join(' ') }))
  const under = new Set([root])
  for (let grew = true; grew;) {
    grew = false
    for (const r of rows) if (under.has(r.ppid) && !under.has(r.pid)) { under.add(r.pid); grew = true }
  }
  return rows.filter((r) => under.has(r.pid) && /workerd/.test(r.comm)).reduce((n, r) => n + r.rss, 0) / 1024
}

/**
 * The blog's isolate heap, asked over the DevTools protocol `wrangler dev --inspector-port` serves:
 * V8's own count of what the worker and its Durable Object hold (one isolate for both), which is
 * the number Cloudflare's 128 MB is measured against — unlike the process's resident memory, which
 * also carries R2's local simulator and whatever the allocator has not handed back. Null when the
 * inspector cannot be reached; the run goes on without it.
 */
export async function isolateHeap(inspectorPort: number): Promise<{ usedMb: () => Promise<number | null>; close: () => void } | null> {
  try {
    const targets = (await (await fetch(`http://127.0.0.1:${inspectorPort}/json`)).json()) as { webSocketDebuggerUrl?: string; title?: string }[]
    const url = targets.find((t) => t.webSocketDebuggerUrl)?.webSocketDebuggerUrl
    if (!url) return null
    const ws = new WebSocket(url)
    await new Promise<void>((ok, no) => { ws.onopen = () => ok(); ws.onerror = () => no(new Error('inspector')) })
    let id = 0
    const waiting = new Map<number, (result: Record<string, number> | null) => void>()
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as { id?: number; result?: Record<string, number> }
      if (m.id && waiting.has(m.id)) {
        waiting.get(m.id)!(m.result ?? null)
        waiting.delete(m.id)
      }
    }
    const ask = (method: string): Promise<Record<string, number> | null> => new Promise((ok) => {
      const n = ++id
      waiting.set(n, ok)
      ws.send(JSON.stringify({ id: n, method }))
      setTimeout(() => { if (waiting.delete(n)) ok(null) }, 5000)
    })
    return {
      // Collected first: what is LIVE, which is what an isolate with a 128 MB limit would keep after
      // its own collection. Without it a local workerd, which has no such limit, reports every
      // chunk it has not yet bothered to collect.
      usedMb: async () => {
        await ask('HeapProfiler.collectGarbage')
        const r = await ask('Runtime.getHeapUsage')
        return r?.usedSize === undefined ? null : (r.usedSize + (r.backingStorageSize ?? 0)) / 1024 / 1024
      },
      close: () => ws.close(),
    }
  } catch {
    return null
  }
}

export type Measured<T> = { value: T; seconds: number; beforeMb: number; peakMb: number; heapBeforeMb: number | null; heapPeakMb: number | null }

/**
 * `work()`, timed, with workerd's resident memory and (given `heap`) the isolate's heap sampled
 * every 100 ms. The resident peak over its baseline is a loose upper bound; the heap is the figure
 * that answers whether the isolate held the archive.
 */
export async function measured<T>(root: number, work: () => Promise<T>, heap?: Awaited<ReturnType<typeof isolateHeap>>): Promise<Measured<T>> {
  const beforeMb = workerdMb(root)
  const heapBeforeMb = heap ? await heap.usedMb() : null
  let peakMb = beforeMb
  let heapPeakMb = heapBeforeMb
  let busy = false
  const timer = setInterval(() => {
    peakMb = Math.max(peakMb, workerdMb(root))
    if (!heap || busy) return
    busy = true
    void heap.usedMb().then((mb) => { if (mb !== null) heapPeakMb = Math.max(heapPeakMb ?? 0, mb) }).finally(() => { busy = false })
  }, 100)
  const t0 = performance.now()
  try {
    const value = await work()
    return { value, seconds: (performance.now() - t0) / 1000, beforeMb, peakMb: Math.max(peakMb, workerdMb(root)), heapBeforeMb, heapPeakMb }
  } finally {
    clearInterval(timer)
  }
}

export const said = (m: Measured<unknown>): string =>
  `${m.seconds.toFixed(1)} s, workerd ${Math.round(m.beforeMb)} → peak ${Math.round(m.peakMb)} MB resident`
  + (m.heapPeakMb !== null && m.heapBeforeMb !== null ? `, isolate heap ${Math.round(m.heapBeforeMb)} → peak ${Math.round(m.heapPeakMb)} MB` : '')

// ----- the same blog, after the round trip -----------------------------------------------------------

/** Tables a minute of running changes by itself, or that a load replaces on purpose (`setup-restore-check.ts`). */
const SKIP = /^(sqlite_|.*_fts($|_))|^(render_cache|body_cache|sessions|update_check|mcp_used_codes|ap_queue|activity_log|analytics_events|analytics_scroll)$/

export function rowCounts(path: string): Record<string, number> {
  const db = new Database(path, { readonly: true })
  try {
    const names = (db.query(`select name from sqlite_master where type = 'table'`).all() as { name: string }[])
      .map((r) => r.name).filter((n) => !SKIP.test(n))
    // A name from this database's own schema, never a request's.
    return Object.fromEntries(names.map((n) => [n, (db.query(`select count(*) as n from "${n}"`).get() as { n: number }).n]))
  } finally {
    db.close()
  }
}

/** Every file under `root` with its SHA-256, by path relative to it. */
export function fileHashes(root: string): Map<string, string> {
  const out = new Map<string, string>()
  if (!existsSync(root)) return out
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile() && !/\.[0-9a-f]{12}\.part$/.test(e.name)) {
        out.set(relative(root, p), new Bun.CryptoHasher('sha256').update(readFileSync(p)).digest('hex'))
      }
    }
  }
  walk(root)
  return out
}

/**
 * What restore-check asks, of two blogs: no table with fewer rows than the original (the smoke and
 * the tour add rows on the way; nothing may be lost), and every original upload byte-identical.
 */
export function sameBlog(original: { data: string; uploads: string }, back: { data: string; uploads: string }): string[] {
  const faults: string[] = []
  const before = rowCounts(join(original.data, 'quire.db'))
  const after = rowCounts(join(back.data, 'quire.db'))
  for (const [t, n] of Object.entries(before)) if ((after[t] ?? 0) < n) faults.push(`rows: ${t} ${n} → ${after[t] ?? 0}`)
  const was = fileHashes(original.uploads)
  const now = fileHashes(back.uploads)
  for (const [p, h] of was) if (now.get(p) !== h) faults.push(`upload: ${p} ${now.has(p) ? 'differs' : 'missing'}`)
  return faults
}
