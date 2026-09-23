// Open an encrypted backup archive, with Quire Ink not running.
//
// ⚠️ THE NAME LEANS TOWARDS THE VERB THAT MATTERS. ADR 0035 says a restore is a shell act on a
// stopped service, so the day this file is needed there is no admin to open, no island to
// click, and possibly no blog left at all. Decrypting is therefore the DEFAULT and needs no
// flag; `--encrypt` exists further down for the ops script's pipe and is the secondary job.
//
//   bun scripts/backup-decrypt.ts quire-2026-09-20T1200.tar.gz.enc --identity key.txt
//   bun scripts/backup-decrypt.ts quire-2026-09-20T1200.tar.gz.enc --passphrase
//   cat plain.tar.gz | bun scripts/backup-decrypt.ts --encrypt --to <pub> [--to <pub>] > out.enc
//
// It writes `<archive minus .enc>` unless `-o` says otherwise, and it streams: the archive is
// the owner's whole blob store and this has to run on the small box that was already full
// enough to need a restore.
//
// The format is written out in ADR 0060. If this file is gone too, that document is enough to
// rebuild it — which is the point of having written it down rather than pointing at the code.

import { createInterface } from 'node:readline'
import { createPrivateKey } from 'node:crypto'
import {
  CHUNK, costFrom, decodeSecret, opener, passphraseIdentity, sealer, unseal, type Cost,
} from '@/server/backup-crypt'

const PKCS8 = Buffer.from('302e020100300506032b656e04220420', 'hex')
const TAG = 16

const argv = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name)
  return i === -1 ? undefined : argv[i + 1]
}
const has = (name: string): boolean => argv.includes(name)
const all = (name: string): string[] =>
  argv.flatMap((a, i) => (a === name && argv[i + 1] ? [argv[i + 1]!] : []))

const die = (message: string): never => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

/** Read a passphrase without echoing it and without leaving it in the shell's history. */
async function askPassphrase(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true })
  // `_writeToOutput` is how a Node readline is silenced; there is no public option for it.
  ;(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {}
  process.stderr.write('Passphrase: ')
  const answer = await new Promise<string>((done) => rl.question('', done))
  rl.close()
  process.stderr.write('\n')
  return answer
}

// ---------------------------------------------------------------------------------------------
// Decrypt

/**
 * Open `src` into `dest`.
 *
 * Exported because `scripts/restore-check.ts` uses it: the harness that proves a backup restores
 * has to walk the same path the owner would, or it proves that a DIFFERENT file restores.
 */
export async function decryptFile(
  src: string, dest: string, identity: Parameters<typeof unseal>[1],
): Promise<number> {
  const file = Bun.file(src)
  const reader = file.stream().getReader()
  let held = Buffer.alloc(0)
  let done = false
  const pull = async (): Promise<boolean> => {
    const next = await reader.read()
    if (next.done) { done = true; return false }
    held = Buffer.concat([held, Buffer.from(next.value)])
    return true
  }

  // The header is three lines and small, so it is read by pulling until they are all there
  // rather than by guessing a size. A file with no third newline is not one of ours.
  while (held.toString('latin1').split('\n').length < 4 && !done) {
    if (!(await pull())) break
  }
  const { fileKey, start, header } = unseal(held, identity)
  const open = opener(fileKey, header.chunk)
  const framed = header.chunk + TAG
  held = held.subarray(start)

  const writer = Bun.file(dest).writer()
  let i = 0
  let written = 0
  try {
    for (;;) {
      // A frame is only the LAST one when the source is exhausted and this is all that is
      // left. Anything else and a slow read would look like the end of the archive.
      // `<=` and not `<`: exactly one whole frame in hand may BE the last one — the sealer
      // flags a full final frame when the archive is a multiple of 64 KiB — and only a read
      // past it can tell. With `<` those archives opened their last frame as a middle one and
      // failed authentication: one archive in 65,536, found in the release review of 2026-09-23.
      while (held.length <= framed && !done) await pull()
      const last = done && held.length <= framed
      const frame = held.subarray(0, last ? held.length : framed)
      const plain = open(Buffer.from(frame), last, i++)
      await writer.write(plain)
      written += plain.length
      held = held.subarray(frame.length)
      if (last) break
    }
  } finally {
    reader.releaseLock()
    await writer.end()
  }
  return written
}

/** The first bare word that is not the value of a flag. */
function archiveArg(): string {
  const takesValue = new Set(['-o', '--identity', '--to', '--salt'])
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a.startsWith('-')) { if (takesValue.has(a)) i++; continue }
    return a
  }
  return die('name the archive: bun scripts/backup-decrypt.ts <archive> --identity <file>')
}

async function decrypt(): Promise<void> {
  const src = archiveArg()
  if (!(await Bun.file(src).exists())) die(`no such file: ${src}`)
  const out = flag('-o') ?? (src.endsWith('.enc') ? src.slice(0, -4) : `${src}.tar.gz`)

  let identity: ReturnType<typeof createPrivateKey>
  const keyFile = flag('--identity')
  if (keyFile) {
    const text = (await Bun.file(keyFile).text()).trim()
    try {
      identity = createPrivateKey({
        key: Buffer.concat([PKCS8, decodeSecret(text)]), format: 'der', type: 'pkcs8',
      })
    } catch {
      return die(`${keyFile} does not hold a Quire Ink backup identity (it starts quire-backup-key-1)`)
    }
  } else if (has('--passphrase')) {
    // The salt is in the archive's own header, so the passphrase alone is enough. Read the
    // header with a throwaway key first: `unseal` needs an identity to get past the recipients,
    // so the salt is taken out of the JSON by hand here.
    const head = Buffer.from(await Bun.file(src).slice(0, 8192).arrayBuffer())
    const line = head.toString('latin1').split('\n')[1] ?? ''
    let salt: Buffer
    let cost: Cost
    try {
      const kdf = (JSON.parse(line) as { kdf: { salt: string } }).kdf
      salt = Buffer.from(kdf.salt, 'base64')
      // ⚠️ THE COST COMES OUT OF THE ARCHIVE, not out of this build. The header has always
      // carried `n`, `r` and `p` and this line took only the salt, so an archive written by a
      // version with different numbers would fail with `no-matching-key` — which reads as
      // "wrong passphrase" to somebody who typed the right one. `costFrom` bounds them,
      // because nothing here has authenticated the header yet.
      cost = costFrom(kdf)
    } catch (error) {
      return die((error as Error).message === 'bad-kdf'
        ? `${src} asks for a key-stretching cost this tool will not spend`
        : `${src} is not a Quire Ink encrypted archive`)
    }
    identity = passphraseIdentity(await askPassphrase(), salt, cost)
  } else {
    return die('pass --identity <file> or --passphrase')
  }

  try {
    const size = await decryptFile(src, out, identity)
    console.log(`✓ ${out}  ${(size / 1048576).toFixed(1)} MB`)
    console.log('  tar -xzf ' + out)
  } catch (error) {
    const why = (error as Error).message
    if (why === 'no-matching-key') {
      die('that key does not open this archive. A different identity, or a different passphrase.')
    }
    if (why === 'header-tampered') die('the archive header does not match its contents.')
    if (why === 'not-an-archive') die(`${src} is not a Quire Ink encrypted archive.`)
    die(why)
  }
}

// ---------------------------------------------------------------------------------------------
// Encrypt, for `scripts/ops/quire-backup.sh`

async function encrypt(): Promise<void> {
  const recipients = all('--to')
  if (recipients.length === 0) die('--encrypt needs at least one --to <public key>')
  const salt = flag('--salt') ?? ''
  const s = sealer(recipients, salt)
  const out = Bun.stdout.writer()
  await out.write(s.header())
  for await (const chunk of Bun.stdin.stream()) await out.write(s.push(chunk))
  await out.write(s.end())
  await out.end()
}

// ⚠️ `import.meta.main`, AND IT IS NOT DEFENSIVE TIDINESS. `restore-check.ts` imports
// `decryptFile` from this file, and without this guard that import RUNS the command line below
// against the restore check's own argv — whose first bare word is the base URL, so the harness
// would try to decrypt `http://127.0.0.1:3399` and exit 1 before checking anything.
if (!import.meta.main) {
  // Imported for `decryptFile`. Nothing else here runs.
} else if (has('--help') || argv.length === 0) {
  console.log(`Open an encrypted Quire Ink backup.

  bun scripts/backup-decrypt.ts <archive.tar.gz.enc> --identity <key file>
  bun scripts/backup-decrypt.ts <archive.tar.gz.enc> --passphrase
  bun scripts/backup-decrypt.ts <archive.tar.gz.enc> --identity k.txt -o out.tar.gz

The format is ADR 0060. Chunk size ${CHUNK}.`)
} else if (has('--encrypt')) {
  await encrypt()
} else {
  await decrypt()
}
