// THE SEAL, WHERE IT ACTUALLY HAPPENS.
//
// `backup-crypt.test.ts` proves the envelope. This proves the PIPELINE puts the archive in one:
// a real `buildArchive` against a real database and a real uploads tree, opened again with the
// identity the route handed over, and untarred. The two are separate on purpose — a format that
// round-trips in isolation while the builder never calls it is the failure this file exists for.

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createPrivateKey } from 'node:crypto'
import { freshDatabase, dropDatabase } from '@/test/db'
import { saveSettings, getSettings } from '@/content/settings'
import { DEFAULT_BACKUPS } from '@/content/settings-defaults'
import { buildArchive, encryptReady, isSnapshotName, snapshotName } from '@/server/backup'
import { db } from '@/store/db'
import { sanitizeBackups } from '@/content/settings-sanitize'
import {
  MAGIC, decodeSecret, newIdentity, opener, passphraseIdentity, passphraseRecipient, unseal,
} from '@/server/backup-crypt'

const DIR = './.tmp/test-backup-sealed'
const UPLOADS = `${DIR}/uploads`
freshDatabase(`${DIR}/data`)
process.env.STORAGE_LOCAL_DIR = UPLOADS

afterAll(() => {
  delete process.env.STORAGE_LOCAL_DIR
  dropDatabase(`${DIR}/data`)
  try { rmSync(DIR, { recursive: true, force: true }) } catch { /* ignore */ }
})

const identityOf = (secret: string) => createPrivateKey({
  key: Buffer.concat([Buffer.from('302e020100300506032b656e04220420', 'hex'), decodeSecret(secret)]),
  format: 'der', type: 'pkcs8',
})

/** Open a whole sealed archive into one buffer. */
function open(archive: Buffer, identity: ReturnType<typeof identityOf>): Buffer {
  const { fileKey, start, header } = unseal(archive, identity)
  const read = opener(fileKey, header.chunk)
  const body = archive.subarray(start)
  const framed = header.chunk + 16
  const out: Buffer[] = []
  for (let at = 0, i = 0; ; i++) {
    const last = body.length - at <= framed
    const frame = body.subarray(at, last ? body.length : at + framed)
    out.push(read(Buffer.from(frame), last, i))
    at += frame.length
    if (last) break
  }
  return Buffer.concat(out)
}

const PASS = 'a passphrase somebody would actually type'
const A_KEY = newIdentity().publicKey

beforeEach(() => {
  mkdirSync(UPLOADS, { recursive: true })
  writeFileSync(join(UPLOADS, 'photo.jpg'), 'not really a jpeg')
})

async function turnOn(): Promise<{ secret: string }> {
  const identity = newIdentity()
  const pass = passphraseRecipient(PASS)
  await saveSettings({
    backups: {
      ...DEFAULT_BACKUPS,
      pubKey: identity.publicKey, passPub: pass.publicKey, passSalt: pass.salt,
    },
  })
  // A second save, because the sanitiser refuses `encrypt` until the keys are already stored —
  // which is the rule under test as much as it is a step here.
  await saveSettings({ backups: { ...(await getSettings()).backups, encrypt: true } })
  return identity
}

describe('an archive the owner asked to be sealed', () => {
  it('comes out as an envelope, and the name says so', async () => {
    const { secret } = await turnOn()
    expect(encryptReady(await getSettings())).toBe(true)
    expect(snapshotName(new Date(), true).endsWith('.tar.gz.enc')).toBe(true)
    expect(isSnapshotName(snapshotName(new Date(), true))).toBe(true)

    const dest = `${DIR}/sealed.tar.gz.enc`
    await buildArchive(dest)
    const archive = Buffer.from(await Bun.file(dest).arrayBuffer())
    expect(archive.subarray(0, 9).toString()).toBe(MAGIC)
    // ⚠️ AND IT IS NOT A GZIP, which is the assertion the magic line alone does not make:
    // a builder that wrote the header and then the plaintext would pass the line above.
    expect(archive.subarray(0, 2)).not.toEqual(Buffer.from([0x1f, 0x8b]))

    const plain = open(archive, identityOf(secret))
    expect(plain.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]))
    const back = `${DIR}/back.tar.gz`
    await Bun.write(back, plain)
    const listed = await Bun.$`tar -tzf ${back}`.quiet().text()
    expect(listed).toContain('quire.db')
    expect(listed).toContain('uploads/photo.jpg')
  })

  it('opens with the passphrase alone, which is the copy the owner did not have to keep', async () => {
    await turnOn()
    const dest = `${DIR}/sealed2.tar.gz.enc`
    await buildArchive(dest)
    const archive = Buffer.from(await Bun.file(dest).arrayBuffer())
    const salt = Buffer.from((await getSettings()).backups.passSalt, 'base64')
    const plain = open(archive, passphraseIdentity(PASS, salt))
    expect(plain.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]))
  })

  it('does not carry a stored credential that the same search finds in the plain archive', async () => {
    // ⚠️ THE COUNTER-TEST. "The secret is not in the sealed file" is also true of a search for
    // the wrong string, so the same needle is looked for in the UNSEALED archive first.
    const secret = 'sk-do-not-ship-this-anywhere-1234567890'
    await saveSettings({ backups: { ...DEFAULT_BACKUPS, encrypt: false } })
    db().run(`update settings set data = json_set(data, '$.title', ?) where id = 1`, [secret])
    const plainPath = `${DIR}/plain.tar.gz`
    await buildArchive(plainPath)
    const gz = Buffer.from(await Bun.file(plainPath).arrayBuffer())
    expect(await Bun.$`tar -xzOf ${plainPath} quire.db`.quiet().arrayBuffer()
      .then((b) => Buffer.from(b).includes(secret))).toBe(true)
    expect(gz.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]))

    await turnOn()
    const sealedPath = `${DIR}/sealed3.tar.gz.enc`
    await buildArchive(sealedPath)
    const sealed = Buffer.from(await Bun.file(sealedPath).arrayBuffer())
    expect(sealed.includes(secret)).toBe(false)
    // TWO WHOLE ARCHIVES and a seal, which is the test and cannot be made smaller. 433 ms for the
    // file alone; inside `check:all` on a busy machine it ran past the 5 s default twice on
    // 2026-09-23 and failed a green tree. The ceiling moves, the assertions do not.
  }, 20_000)
})

describe('the switch cannot be on over plaintext', () => {
  it('refuses to turn on before there is anything to seal to', () => {
    // Asked of the RULE rather than of a saved blog, and deliberately: the keys cannot be
    // erased through a save (that is the other half of the rule), so a blog that has ever had
    // them cannot be put back into this state — which is exactly the property worth having and
    // exactly what makes an integration test of it impossible to write honestly.
    const bare = { ...DEFAULT_BACKUPS, encrypt: true }
    expect(sanitizeBackups(bare, DEFAULT_BACKUPS).encrypt).toBe(false)
  })

  it('answers no for a stored blob that says on and names no recipient', async () => {
    // ⚠️ A STATE THE SANITISER WILL NOT PRODUCE, asked of the predicate anyway. `settings.data`
    // is JSON in a table, and this pair is one hand-edit or one restored older row away; the
    // cost of checking is a string compare and the cost of not checking is an archive written
    // in the clear under a switch that says otherwise.
    const s = await getSettings()
    expect(encryptReady({ ...s, backups: { ...s.backups, encrypt: true, pubKey: '', passPub: '' } }))
      .toBe(false)
    expect(encryptReady({ ...s, backups: { ...s.backups, encrypt: true, pubKey: A_KEY, passPub: '' } }))
      .toBe(false)
    expect(encryptReady({ ...s, backups: { ...s.backups, encrypt: true, pubKey: A_KEY, passPub: A_KEY } }))
      .toBe(true)
  })

  it('will not let a half-built payload erase a recipient and un-seal every future archive', () => {
    const live = { ...DEFAULT_BACKUPS, pubKey: A_KEY, passPub: A_KEY, passSalt: 'c2FsdA==', encrypt: true }
    const wiped = sanitizeBackups({ ...live, pubKey: '', passPub: '', passSalt: '' }, live)
    expect(wiped.pubKey).toBe(A_KEY)
    expect(wiped.passPub).toBe(A_KEY)
    expect(wiped.passSalt).toBe('c2FsdA==')
    expect(wiped.encrypt).toBe(true)
    // And something that is not a key is not a key, however confidently it is sent.
    expect(sanitizeBackups({ ...live, pubKey: 'quire-backup-pub-1nope' }, live).pubKey).toBe(A_KEY)
  })

  it('leaves the archive a plain gzip while it is off, byte for byte as before', async () => {
    await saveSettings({ backups: { ...DEFAULT_BACKUPS, encrypt: false } })
    const dest = `${DIR}/off.tar.gz`
    await buildArchive(dest)
    const archive = Buffer.from(await Bun.file(dest).arrayBuffer())
    expect(archive.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]))
    expect(archive.subarray(0, 9).toString()).not.toBe(MAGIC)
    expect(snapshotName(new Date(), false).endsWith('.tar.gz')).toBe(true)
  })
})
