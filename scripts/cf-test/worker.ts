// The port contracts, and the platform features shared code leans on, run INSIDE workerd (ADR 0066, rule 3). `bun run test:cf` builds this with
// `scripts/build-worker.ts`, serves it with `wrangler dev --local`, and asks it to run each suite.
// Every case gets a Durable Object of its own, so each one starts from an empty database exactly as
// the Bun side's cases each start from a new file.
import { DurableObject } from 'cloudflare:workers'
import { bind, type CfEnv } from '@/runtime/cf/bindings'
import { open } from '@/runtime/cf/db'
import { dbContract } from '@/runtime/db.contract'
import { hash as cfHash, verify as cfVerify } from '@/runtime/cf/password'
import { regexEngine } from '@/runtime/cf/shiki-engine'
import { generateKeyPairSync } from 'node:crypto'
import { signRequest, verifySignature } from '@/ap/signature'
import { SmtpSession } from '@/news/smtp'
import { openDatabases, db } from '@/store/db'
import { beginLiveLoad } from '@/store/archive-load'
import { put as blobPut, read as blobRead, statSize as blobStatSize } from '@/runtime/cf/blob'
import { gunzipStage, gzipStage } from '@/server/gzip'
import { clientCountry, clientIp } from '@/server/rate-limit'
import { identityFromSecret, newIdentity, opener, passphraseRecipient, sealer, unseal } from '@/server/backup-crypt'
import { dropHeld, heldIds, heldParts, holdPart, openKept, readHeld, removeKept, writeKept } from '@/runtime/cf/archive'
import { PART as OFFSITE_PART, s3Client } from '@/runtime/cf/offsite'
import { outboxResumes } from './newsletter'

type Case = { name: string; body: () => void | Promise<void> }

/** The cases a suite registers, collected rather than run, so one object runs exactly one. */
function collect(): Case[] {
  const cases: Case[] = []
  dbContract((name, body) => cases.push({ name: `db: ${name}`, body }), () => open('contract.db', 'NORMAL'))
  cases.push({ name: 'ap: an RSA-2048 key is made, signs a delivery, and the signature verifies', body: apRoundTrip })
  cases.push({ name: 'smtp: one connection authenticates and hands over two messages, then quits', body: smtpTwoMessages })
  cases.push({ name: 'blob: `private/` is refused before the bucket is asked, so /uploads cannot serve a backup', body: blobPrivateRefused })
  cases.push({ name: 'ip: with no socket to ask, the reader is the edge\'s CF-Connecting-IP and CF-IPCountry', body: edgeAddress })
  cases.push({ name: 'restore: a child table that arrives before its parent still loads (recovery_codes before users)', body: childFirst })
  cases.push({ name: 'blob: an exclusive put of a name that exists says EEXIST with the code callers retry on', body: exclusivePut })
  cases.push({ name: 'archive: the node:zlib gzip stage round-trips a stream', body: gzipRoundTrip })
  cases.push({ name: 'archive: an X25519 seal (ADR 0060) opens with its identity and not with another', body: sealRoundTrip })
  cases.push({ name: 'archive: a passphrase recipient derives (scrypt, N=65536 r=8: 64 MB)', body: () => { passphraseRecipient('correct horse battery staple') } })
  cases.push({ name: 'smtp: STARTTLS lets go of the plain streams and reaches the TLS handshake', body: smtpReachesHandshake })
  cases.push({ name: 'archive: a kept archive past the old 64 MB ceiling is handed out as its size and a stream (G4)', body: keptAsStream })
  cases.push({ name: 'archive: the parts of an incoming archive are held in R2 under private/, read back in order, and dropped', body: incomingParts })
  cases.push({ name: 'newsletter: a send cut off by a restart is settled from the log and resumed, nobody mailed twice', body: () => outboxResumes(smtpPort) })
  cases.push({ name: 'offsite: a 40 MB kept archive leaves for S3 as a multipart upload, 16 MiB at a time', body: offsiteMultipart })
  return cases
}

/**
 * G3.4: fediverse delivery needs `node:crypto` to make the blog's RSA key (`ap/keys.ts`), sign each
 * delivery and verify each inbox POST (`ap/signature.ts`). Measured on 2026-10-03: the key in 26 ms
 * under `wrangler dev`. The rest of delivery is `safeFetch`, whose `node:dns` lookup workerd answers
 * over DNS-over-HTTPS; that needs the network, so it was probed by hand and is not a case here.
 */
function apRoundTrip(): void {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  const body = '{"type":"Create"}'
  const signed = signRequest({ method: 'POST', url: 'https://example.social/inbox', body, keyId: 'https://blog.test/ap/actor#main-key', privateKeyPem: privateKey })
  const headers = Object.fromEntries(Object.entries(signed.headers).map(([k, v]) => [k.toLowerCase(), v]))
  const good = verifySignature({ method: 'POST', path: '/inbox', headers, body, publicKeyPem: publicKey })
  if (good !== null) throw new Error(`a signature made here did not verify here: ${good}`)
  const tampered = verifySignature({ method: 'POST', path: '/inbox', headers, body: body + ' ', publicKeyPem: publicKey })
  if (tampered !== 'bad-digest') throw new Error(`a changed body was not refused (got ${tampered})`)
}

/** The fake relay `scripts/test-cf.ts` listens with, on loopback (so a password may go in the clear). */
let smtpPort = 0

/**
 * G3.3: mail goes out through `cloudflare:sockets` (`runtime/cf/socket.ts`), read only while a reply
 * is awaited. A relay only answers 250 to DATA once the closing `.` has arrived, so two 250s mean
 * both bodies crossed whole. STARTTLS needs a certificate this test cannot have; it was checked by
 * hand against smtp.gmail.com:587 on 2026-10-03 (encrypted, 1.6 s) after the pull-based port fixed
 * "Cannot call releaseLock() on a reader with outstanding read promises".
 */
async function smtpTwoMessages(): Promise<void> {
  if (!smtpPort) throw new Error('no fake relay port (CF_TEST_SMTP_PORT)')
  const session = await SmtpSession.open({ host: '127.0.0.1', port: smtpPort, secure: false, auth: { user: 'u', pass: 'p' }, timeoutMs: 5000 })
  await session.send({ from: 'blog@blog.test', to: 'a@reader.test', body: 'Subject: one\r\n\r\nfirst\r\n.a line that starts with a dot\r\n' })
  await session.send({ from: 'blog@blog.test', to: 'b@reader.test', body: 'Subject: two\r\n\r\nsecond\r\n' })
  await session.close()
}

/**
 * The regression this port change fixed, pinned without a certificate: the relay accepts STARTTLS
 * and hangs up at the handshake, so the open must fail THERE — not before it, at the streams.
 */
async function smtpReachesHandshake(): Promise<void> {
  if (!smtpPort) throw new Error('no fake relay port (CF_TEST_SMTP_PORT)')
  try {
    await SmtpSession.open({ host: '127.0.0.1', port: smtpPort + 1, secure: false, timeoutMs: 5000 })
  } catch (error) {
    const message = String((error as Error).message)
    if (/releaseLock|locked/i.test(message)) throw new Error(`the upgrade never started: ${message}`)
    // And not a failure BEFORE the upgrade, which would pass this case without reaching STARTTLS.
    if (/could not reach|refused|did not answer|was refused/i.test(message)) throw new Error(`failed before STARTTLS: ${message}`)
    return
  }
  throw new Error('a handshake with a relay that hung up succeeded')
}

/** `runtime/blob-reserved.ts`: the bucket holding the uploads also holds the backups. */
async function blobPrivateRefused(): Promise<void> {
  for (const attempt of [() => blobRead('private/backups/quire-x.tar.gz'), () => blobStatSize('private/aside/settings.json')]) {
    try {
      await attempt()
    } catch (error) {
      if (String((error as Error).message).startsWith('Invalid blob path')) continue
      throw error
    }
    throw new Error('a private key was read through the blob port')
  }
}

/** `Capabilities.clientAddress = 'edge'`: two readers are two buckets, not one called `unknown`. */
function edgeAddress(): void {
  const ctx = (h: Record<string, string>) => ({ env: {}, req: { header: (n: string) => h[n.toLowerCase()], raw: new Request('https://blog.test/') } }) as never
  const a = clientIp(ctx({ 'cf-connecting-ip': '203.0.113.7', 'cf-ipcountry': 'vn' }))
  const b = clientIp(ctx({ 'cf-connecting-ip': '198.51.100.9' }))
  if (a !== '203.0.113.7' || b !== '198.51.100.9') throw new Error(`readers came out as ${a} and ${b}`)
  const country = clientCountry(ctx({ 'cf-connecting-ip': '203.0.113.7', 'cf-ipcountry': 'vn' }))
  if (country !== 'VN') throw new Error(`country came out as ${JSON.stringify(country)}`)
}

/**
 * `store/archive-load.ts`: an archive lists tables in name order, children before parents, and a
 * Durable Object ignores `pragma foreign_keys = OFF` (2026-10-03) — so the load stages any table with
 * foreign keys and moves it in once its parents are there. The real load, in a real object.
 */
async function childFirst(): Promise<void> {
  openDatabases('./data')
  const lines = async function* (rows: unknown[][]): AsyncGenerator<Uint8Array> {
    yield new TextEncoder().encode(rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  }
  const load = beginLiveLoad()
  await load.table('content', 'recovery_codes', ['user_id', 'code_hash', 'used_at'], lines([[1, 'h1', null], [1, 'h2', null]]))
  await load.table('content', 'users', ['id', 'username', 'email', 'password_hash', 'totp_secret', 'totp_last_step', 'created_at', 'updated_at'],
    lines([[1, 'owner', 'o@blog.test', 'hash', null, null, 1, 1]]))
  load.finish()
  const n = db().one<{ n: number }>('select count(*) as n from recovery_codes')?.n
  if (n !== 2) throw new Error(`${n} recovery code(s) arrived, expected 2`)
  const left = db().one<{ n: number }>(`select count(*) as n from sqlite_master where name like '__load%'`)?.n
  if (left !== 0) throw new Error('a staging table was left behind')
}

/** `files.ts`, `media.ts` and the backup load take the next free name on `code === 'EEXIST'`. */
async function exclusivePut(): Promise<void> {
  const name = `files/exclusive-${crypto.randomUUID()}.txt`
  await blobPut(name, Buffer.from('first'), { exclusive: true })
  try {
    await blobPut(name, Buffer.from('second'), { exclusive: true })
  } catch (error) {
    if ((error as { code?: string }).code !== 'EEXIST') throw new Error(`refused without the code: ${(error as Error).message}`)
    if ((await blobRead(name)).toString() !== 'first') throw new Error('the refused put overwrote the file')
    return
  }
  throw new Error('a second exclusive put of the same name was accepted')
}

/** ADR 0067's archive gzips through `node:zlib`, which workerd provides behind `nodejs_compat`. */
async function gzipRoundTrip(): Promise<void> {
  const text = 'quire-rows/1 '.repeat(50_000)
  const back = await new Response(new Blob([text]).stream().pipeThrough(gzipStage()).pipeThrough(gunzipStage())).text()
  if (back !== text) throw new Error(`gzip round trip changed ${text.length} chars into ${back.length}`)
}

function sealRoundTrip(): void {
  const owner = newIdentity()
  const s = sealer([owner.publicKey], '')
  const plain = new Uint8Array(200_000).map((_, i) => i % 251)
  const parts = [s.header(), s.push(plain), s.end()]
  const sealed = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { sealed.set(p, at); at += p.length }
  const { fileKey, start, header } = unseal(Buffer.from(sealed), identityFromSecret(owner.secret))
  const open = opener(fileKey, header.chunk)
  const frame = header.chunk + 16
  const body = Buffer.from(sealed.subarray(start))
  const out: Buffer[] = []
  for (let i = 0, off = 0; off < body.length; i++, off += frame) out.push(open(body.subarray(off, off + frame), off + frame >= body.length, i))
  if (!Buffer.concat(out).equals(Buffer.from(plain))) throw new Error('the sealed payload did not open to what went in')
  try {
    unseal(Buffer.from(sealed), identityFromSecret(newIdentity().secret))
  } catch (error) {
    if ((error as Error).message === 'no-matching-key') return
    throw error
  }
  throw new Error('a stranger\'s identity opened the archive')
}

/** `size` bytes of `i % 251`, made as they are read: a stream no test holds whole. */
function counting(size: number): ReadableStream<Uint8Array> {
  const block = new Uint8Array(1024 * 1024).map((_, i) => i % 251)
  let at = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (at >= size) { controller.close(); return }
      const n = Math.min(block.length, size - at)
      // Every block starts where the last one left off in the cycle of 251.
      const offset = at % 251
      controller.enqueue(n === block.length && offset === 0 ? block.slice() : new Uint8Array(n).map((_, i) => (at + i) % 251))
      at += n
    },
  })
}

/** Read `stream` through, checking every byte is the `counting` pattern; the count. */
async function verified(stream: ReadableStream<Uint8Array>): Promise<number> {
  let at = 0
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return at
    for (let i = 0; i < value.length; i += 4093) if (value[i] !== (at + i) % 251) throw new Error(`byte ${at + i} is ${value[i]}`)
    at += value.length
  }
}

/**
 * G4: `openKept` answered `object.blob()` — the archive in the isolate — and refused past 64 MB.
 * Now a head and a lazy get: 72 MB written, handed out by size, streamed back byte-checked.
 */
async function keptAsStream(): Promise<void> {
  const size = 72 * 1024 * 1024
  const name = 'quire-2026-10-03T120000.tar.gz'
  if (await writeKept(name, counting(size)) !== size) throw new Error('writeKept miscounted')
  const kept = await openKept(name)
  if (!kept || kept.size !== size) throw new Error(`openKept said ${kept?.size}`)
  // Twice, because a caller that retries opens it again.
  for (let i = 0; i < 2; i++) if (await verified(kept.stream()) !== size) throw new Error('the stream ended short')
  await removeKept(name)
  if (await openKept(name)) throw new Error('removed, and still there')
}

/** G4: `/setup/restore/parts` stores here. One object per part, all or nothing each. */
async function incomingParts(): Promise<void> {
  const id = 'lkf0xs-1000-0123456789abcdef0123456789abcdef'
  const sizes = [300_000, 300_000, 123_457]
  const total = sizes.reduce((a, b) => a + b, 0)
  const whole = await new Response(counting(total)).arrayBuffer()
  const starts = [0, sizes[0]!, sizes[0]! + sizes[1]!]
  // Part 2 first and part 1 sent twice, the way a resumed upload can: a part replaces itself.
  for (const part of [2, 1, 3, 1]) {
    const bytes = new Uint8Array(whole, starts[part - 1], sizes[part - 1])
    await holdPart(id, part, new Blob([bytes]).stream(), bytes.length)
  }
  const held = await heldParts(id)
  if (held.map((h) => `${h.part}:${h.size}`).join(',') !== '1:300000,2:300000,3:123457') throw new Error(`held ${JSON.stringify(held)}`)
  // A part shorter than it said is not kept.
  try {
    await holdPart(id, 4, new Blob([new Uint8Array(10)]).stream(), 20)
    throw new Error('a short part was kept')
  } catch (error) {
    if (!String((error as Error).message).startsWith('incoming:')) throw error
  }
  if ((await heldParts(id)).length !== 3) throw new Error('the short part left something behind')
  const back = new Uint8Array(await new Response(readHeld(id, 3)).arrayBuffer())
  const want = new Uint8Array(whole)
  if (back.length !== total || back.some((b, i) => b !== want[i])) throw new Error('the parts did not read back as the archive')
  try {
    await blobRead(`private/incoming/${id}/00001`)
    throw new Error('a part was readable through the blob port')
  } catch (error) {
    if (!String((error as Error).message).startsWith('Invalid blob path')) throw error
  }
  if (!(await heldIds()).includes(id)) throw new Error('heldIds missed it')
  await dropHeld(id)
  if ((await heldParts(id)).length !== 0 || (await heldIds()).includes(id)) throw new Error('dropped, and still held')
}

/** G4: the off-site copy of a big archive, from the stream `openKept` gives, never the archive in memory. */
async function offsiteMultipart(): Promise<void> {
  if (!s3Port) throw new Error('no fake bucket port (CF_TEST_S3_PORT)')
  const size = 40 * 1024 * 1024
  const name = 'quire-2026-10-03T130000.tar.gz'
  await writeKept(name, counting(size))
  const kept = await openKept(name)
  if (!kept) throw new Error('no kept archive')
  const client = s3Client({ accessKeyId: 'AKID', secretAccessKey: 'secret', bucket: 'b', region: 'auto', endpoint: `http://127.0.0.1:${s3Port}` })
  if (await client.write(`blog/${name}`, kept) !== size) throw new Error('write miscounted')
  const seen = (await (await fetch(`http://127.0.0.1:${s3Port}/__seen/${encodeURIComponent(`blog/${name}`)}`)).json()) as { size: number; parts: number; largest: number } | null
  if (!seen || seen.size !== size || seen.parts !== Math.ceil(size / OFFSITE_PART) || seen.largest > OFFSITE_PART) {
    throw new Error(`the bucket saw ${JSON.stringify(seen)}`)
  }
  await removeKept(name)
}

/** The fake bucket `scripts/test-cf.ts` serves on loopback. */
let s3Port = 0

export class Probe extends DurableObject<CfEnv> {
  constructor(ctx: DurableObjectState, env: CfEnv) {
    super(ctx, env)
    bind(env, ctx)
  }

  override async fetch(request: Request): Promise<Response> {
    smtpPort = Number((this.env as unknown as { CF_TEST_SMTP_PORT?: string }).CF_TEST_SMTP_PORT ?? 0)
    s3Port = Number((this.env as unknown as { CF_TEST_S3_PORT?: string }).CF_TEST_S3_PORT ?? 0)
    const index = Number(new URL(request.url).searchParams.get('case'))
    const c = collect()[index]
    if (!c) return Response.json({ error: `no case ${index}` }, { status: 404 })
    try {
      await c.body()
      return Response.json({ name: c.name, ok: true })
    } catch (error) {
      return Response.json({ name: c.name, ok: false, error: String((error as Error).message ?? error) })
    }
  }
}

export default {
  async fetch(request: Request, env: CfEnv & { PROBE: DurableObjectNamespace }): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/cases') return Response.json(collect().map((c) => c.name))
    // G2.5: the two workloads that threaten 128 MB. `test:cf --memory` reads the isolate's heap around them.
    if (url.pathname === '/load/argon') {
      const h = await cfHash('a long enough passphrase', { memoryCost: 19456, timeCost: 2 })
      const old = '$argon2id$v=19$m=65536,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$' + 'A'.repeat(43)
      await cfVerify('a long enough passphrase', old)
      return Response.json({ ok: await cfVerify('a long enough passphrase', h) })
    }
    if (url.pathname === '/load/shiki') {
      const n = Number(url.searchParams.get('n') ?? 40)
      const shiki = await import('shiki')
      const h = await shiki.createHighlighter({ themes: ['vitesse-light'], langs: [], engine: regexEngine() })
      const langs = Object.keys(shiki.bundledLanguages).slice(0, n)
      for (const lang of langs) {
        await h.loadLanguage(lang as Parameters<typeof h.loadLanguage>[0])
        h.codeToHtml('x = 1', { lang, theme: 'vitesse-light' })
      }
      return Response.json({ loaded: langs.length })
    }
    const index = url.searchParams.get('case') ?? ''
    return env.PROBE.get(env.PROBE.idFromName(`case-${index}-${Date.now()}`)).fetch(request)
  },
}
