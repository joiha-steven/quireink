// The backup archive, opened: sealed or not, either format, as a stream of tar entries (ADR 0067).
//
// Shared by every reader there is — `scripts/restore.ts` on a stopped service, `restore-check`
// after every tour, and the first setup screen loading a backup into an empty blog — so all three
// walk the same path the bytes take, and none of them proves that a DIFFERENT file opens.
//
// Plain JS and streaming, like the writer: the seal (ADR 0060, unchanged) is opened a frame at a
// time, the gzip by `server/gzip.ts`, the tar by `server/tar.ts`. Nothing holds the archive.
import { costFrom, identityFromSecret, MAGIC, opener, passphraseIdentity, unseal } from '@/server/backup-crypt'
import { ByteReader, streamOf, tarEntries, type TarItem } from '@/server/tar'
import { ARCHIVE_FORMAT, type Manifest } from '@/server/archive'
import { gunzipStage } from '@/server/gzip'

/** What may open a sealed archive. Either one; neither is needed for a plain one. */
export type ArchiveKeys = { identity?: string; passphrase?: string }

/**
 * Why an archive would not open, named so a screen can say it in the reader's language:
 * `not-an-archive`, `needs-key`, `bad-identity`, `bad-kdf`, and the envelope's own
 * (`no-matching-key`, `header-tampered`, `bad-header`, `wrong-version`, a failed frame).
 */
export class ArchiveFault extends Error {}

const TAG = 16
const GZIP = [0x1f, 0x8b]

/** The envelope's plaintext, frame by frame, after the header has been checked (ADR 0060). */
async function* unsealed(reader: ByteReader, keys: ArchiveKeys): AsyncGenerator<Uint8Array> {
  // The header is three lines; read until all three are in hand, and no further than 64 KiB.
  const lines = (): number => Buffer.from(reader.buffered).toString('latin1').split('\n').length - 1
  while (lines() < 3 && reader.buffered.length < 65_536 && await reader.more()) { /* pulling */ }
  const head = Buffer.from(reader.buffered)
  let identity
  if (keys.identity?.trim()) {
    try {
      identity = identityFromSecret(keys.identity)
    } catch {
      throw new ArchiveFault('bad-identity')
    }
  } else if (keys.passphrase) {
    // The salt and the cost come out of the archive's own header, bounded by `costFrom`, because
    // nothing has authenticated the header yet (ADR 0060).
    let kdf: { salt: string }
    try {
      kdf = (JSON.parse(head.toString('latin1').split('\n')[1] ?? '') as { kdf: { salt: string } }).kdf
    } catch {
      throw new ArchiveFault('bad-header')
    }
    let cost
    try { cost = costFrom(kdf) } catch { throw new ArchiveFault('bad-kdf') }
    identity = passphraseIdentity(keys.passphrase, Buffer.from(kdf.salt, 'base64'), cost)
  } else {
    throw new ArchiveFault('needs-key')
  }
  let opened
  try {
    opened = unseal(head, identity)
  } catch (error) {
    throw new ArchiveFault((error as Error).message)
  }
  const open = opener(opened.fileKey, opened.header.chunk)
  const framed = opened.header.chunk + TAG
  reader.consume(opened.start)
  for (let i = 0; ; i++) {
    // A frame is the LAST one only when the source is exhausted and this is all that is left;
    // `<=` because one whole frame in hand may be the last (see `backup-decrypt.ts`).
    let ended = false
    while (reader.buffered.length <= framed && !ended) ended = !(await reader.more())
    const last = ended && reader.buffered.length <= framed
    const frame = reader.consume(last ? reader.buffered.length : framed)
    try {
      yield open(Buffer.from(frame), last, i)
    } catch {
      throw new ArchiveFault('damaged')
    }
    if (last) return
  }
}

async function* rest(reader: ByteReader): AsyncGenerator<Uint8Array> {
  if (reader.buffered.length) yield reader.consume(reader.buffered.length).slice()
  while (await reader.more()) yield reader.consume(reader.buffered.length).slice()
}

/**
 * Open an archive from its bytes. Sealed or plain is decided by the first bytes, never by a name:
 * the file in somebody's Downloads folder may have been renamed, and the envelope opens with a
 * word for exactly this reason.
 */
export async function openArchive(
  source: AsyncIterable<Uint8Array>, keys: ArchiveKeys = {},
): Promise<{ sealed: boolean; items: AsyncGenerator<TarItem> }> {
  const reader = new ByteReader(source)
  while (reader.buffered.length < MAGIC.length && await reader.more()) { /* pulling */ }
  const first = reader.buffered
  const sealed = Buffer.from(first.subarray(0, MAGIC.length)).toString('latin1') === MAGIC
  if (!sealed && !(first[0] === GZIP[0] && first[1] === GZIP[1])) throw new ArchiveFault('not-an-archive')
  const gz = sealed ? unsealed(reader, keys) : rest(reader)
  if (sealed) {
    // Fail on a wrong key HERE, before the caller starts reading entries: pull the first frame
    // now and hand it back in front of the rest.
    const head = await gz.next()
    const replay = (async function* () { if (!head.done) yield head.value; yield* gz })()
    return { sealed, items: entriesOf(replay) }
  }
  return { sealed, items: entriesOf(gz) }
}

function entriesOf(gz: AsyncGenerator<Uint8Array>): AsyncGenerator<TarItem> {
  return tarEntries(streamOf(gz).pipeThrough(gunzipStage()))
}

/** A whole small entry, as text. The manifest and a schema are kilobytes; nothing else is read so. */
export async function textOf(item: TarItem, limit = 16 * 1024 * 1024): Promise<string> {
  if (item.size > limit) throw new ArchiveFault(`${item.name} is larger than a ${item.name.split('/').pop()} can be`)
  const parts: Uint8Array[] = []
  for await (const piece of item.body()) parts.push(piece)
  return Buffer.concat(parts).toString('utf8')
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

/** The manifest, checked into its shape: a JSON boundary, so nothing is trusted until it is. */
export function parseManifest(text: string): Manifest {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new ArchiveFault('bad-manifest') }
  if (!isRecord(raw) || raw.format !== ARCHIVE_FORMAT) throw new ArchiveFault('unknown-format')
  if (typeof raw.version !== 'string' || typeof raw.createdAt !== 'string' || !isRecord(raw.databases)) {
    throw new ArchiveFault('bad-manifest')
  }
  for (const kind of ['content', 'analytics']) {
    const section = raw.databases[kind]
    if (!isRecord(section) || !strings(section.ledger) || !Array.isArray(section.tables)) throw new ArchiveFault('bad-manifest')
    for (const t of section.tables) {
      if (!isRecord(t) || typeof t.name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(t.name)
        || !strings(t.columns) || typeof t.rows !== 'number' || typeof t.sha256 !== 'string') {
        throw new ArchiveFault('bad-manifest')
      }
    }
  }
  return raw as Manifest
}

/**
 * What the archive is, from its first entry: `rows` (this format) with its manifest, or `files`
 * (every archive before ADR 0067: `quire.db`, `analytics.db`, then `uploads/`), handing the
 * first entry back unread.
 */
export async function classify(items: AsyncGenerator<TarItem>): Promise<
  | { format: 'rows'; manifest: Manifest }
  | { format: 'files'; first: TarItem }
> {
  const next = await items.next()
  if (next.done) throw new ArchiveFault('empty')
  const name = next.value.name.replace(/^\.\//, '')
  if (name === 'manifest.json') return { format: 'rows', manifest: parseManifest(await textOf(next.value)) }
  if (name === 'quire.db' || name === 'analytics.db') return { format: 'files', first: next.value }
  throw new ArchiveFault('unknown-format')
}
