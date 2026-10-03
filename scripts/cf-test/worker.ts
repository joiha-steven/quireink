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
import { put as blobPut, read as blobRead, statSize as blobStatSize } from '@/runtime/cf/blob'
import { gunzipStage, gzipStage } from '@/server/gzip'
import { clientCountry, clientIp } from '@/server/rate-limit'
import { identityFromSecret, newIdentity, opener, passphraseRecipient, sealer, unseal } from '@/server/backup-crypt'

type Case = { name: string; body: () => void | Promise<void> }

/** The cases a suite registers, collected rather than run, so one object runs exactly one. */
function collect(): Case[] {
  const cases: Case[] = []
  dbContract((name, body) => cases.push({ name: `db: ${name}`, body }), () => open('contract.db', 'NORMAL'))
  cases.push({ name: 'ap: an RSA-2048 key is made, signs a delivery, and the signature verifies', body: apRoundTrip })
  cases.push({ name: 'smtp: one connection authenticates and hands over two messages, then quits', body: smtpTwoMessages })
  cases.push({ name: 'blob: `private/` is refused before the bucket is asked, so /uploads cannot serve a backup', body: blobPrivateRefused })
  cases.push({ name: 'ip: with no socket to ask, the reader is the edge\'s CF-Connecting-IP and CF-IPCountry', body: edgeAddress })
  cases.push({ name: 'blob: an exclusive put of a name that exists says EEXIST with the code callers retry on', body: exclusivePut })
  cases.push({ name: 'archive: the node:zlib gzip stage round-trips a stream', body: gzipRoundTrip })
  cases.push({ name: 'archive: an X25519 seal (ADR 0060) opens with its identity and not with another', body: sealRoundTrip })
  cases.push({ name: 'archive: a passphrase recipient derives (scrypt, N=65536 r=8: 64 MB)', body: () => { passphraseRecipient('correct horse battery staple') } })
  cases.push({ name: 'smtp: STARTTLS lets go of the plain streams and reaches the TLS handshake', body: smtpReachesHandshake })
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

export class Probe extends DurableObject<CfEnv> {
  constructor(ctx: DurableObjectState, env: CfEnv) {
    super(ctx, env)
    bind(env, ctx)
  }

  override async fetch(request: Request): Promise<Response> {
    smtpPort = Number((this.env as unknown as { CF_TEST_SMTP_PORT?: string }).CF_TEST_SMTP_PORT ?? 0)
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
