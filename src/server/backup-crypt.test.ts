// THE ENVELOPE, BROKEN ONE THING AT A TIME.
//
// There is no far end to talk to here, so the honest test is the round trip and then a
// deliberate break per case — the shape `ap/signature.test.ts` settled on. Every refusal below
// is one somebody would otherwise meet on the day their disk died, which is exactly why they
// are asserted here rather than discovered then.
//
// ⚠️ EVERY REFUSAL IS A NAMED REASON, never a bare false. An opener that answers "no" to a
// wrong passphrase and to a corrupt archive with the same word sends the owner looking in the
// wrong place, and they are looking while something is already on fire.

import { describe, expect, it } from 'bun:test'
import {
  CHUNK, COST, MAGIC, costFrom, decodePublic, decodeSecret, encodePublic, newIdentity, opener,
  passphraseIdentity, passphraseRecipient, sealer, unseal,
} from '@/server/backup-crypt'
import { createPrivateKey, createPublicKey, randomBytes, type KeyObject } from 'node:crypto'

/**
 * The raw 32 bytes of a key's public half, which the module keeps to itself. Written out here
 * rather than exported, because the only caller is a test building an archive BY HAND — and a
 * door opened for a test is a door.
 *
 * ⚠️ `createPublicKey` ON AN ALREADY-PUBLIC KeyObject THROWS IN BUN (`ERR_CRYPTO_INVALID_KEY_
 * OBJECT_TYPE`) where Node allows it. This is only ever handed a private key.
 */
const rawPublicOf = (key: KeyObject): Buffer =>
  Buffer.from(createPublicKey(key).export({ type: 'spki', format: 'der' })).subarray(12)

const PKCS8 = Buffer.from('302e020100300506032b656e04220420', 'hex')
const identityOf = (secret: string) =>
  createPrivateKey({ key: Buffer.concat([PKCS8, decodeSecret(secret)]), format: 'der', type: 'pkcs8' })

/** Seal a whole buffer the way `buildArchive` does: header, pushes, then end. */
function seal(plain: Buffer, recipients: string[], salt: string, pushes = 1): Buffer {
  const s = sealer(recipients, salt)
  const out = [s.header()]
  const step = Math.ceil(plain.length / pushes) || 1
  for (let i = 0; i < plain.length; i += step) out.push(s.push(plain.subarray(i, i + step)))
  out.push(s.end())
  return Buffer.concat(out)
}

/** Open a whole buffer, frame by frame, the way the decrypt script does. */
function unsealAll(archive: Buffer, identity: ReturnType<typeof identityOf>): Buffer {
  const { fileKey, start, header } = unseal(archive, identity)
  const open = opener(fileKey, header.chunk)
  const body = archive.subarray(start)
  const framed = header.chunk + 16
  const out: Buffer[] = []
  let at = 0
  for (let i = 0; ; i++) {
    const last = body.length - at <= framed
    const frame = body.subarray(at, last ? body.length : at + framed)
    out.push(open(frame, last, i))
    at += frame.length
    if (last) break
  }
  return Buffer.concat(out)
}

const SALT = Buffer.from(randomBytes(16)).toString('base64')
const SMALL = Buffer.from('two databases and somebody\'s photographs')

describe('the cost comes out of the archive, not out of this build', () => {
  /**
   * ⚠️ THE HEADER CARRIED `n`, `r` AND `p` FROM THE START AND THE READER USED ITS OWN. The salt
   * was read out of the archive and the other three came from a module constant, so the format
   * described itself on paper and was pinned to one build in fact. Raising `N` — the ordinary
   * answer as hardware gets faster — would have orphaned every archive already written, and the
   * failure is `no-matching-key`, which reads as "wrong passphrase" to somebody who typed the
   * right one, on the worst day, about the one file that was supposed to survive it.
   *
   * 2^14 is used here because it is CHEAP, and cheap is what makes this test a test: it is not
   * the default, so an opener that reaches for the default cannot open what it writes.
   */
  const LOW = { n: 1 << 14, r: 8, p: 1 }

  it('opens an archive written at a cost this build does not use', () => {
    const salt = randomBytes(16)
    const words = 'nam chu va mot dau cham'
    // Derived at the low cost, and the header is told so — which is the whole contract.
    const low = passphraseIdentity(words, salt, LOW)
    const archive = seal(SMALL, [encodePublic(rawPublicOf(low))], Buffer.from(salt).toString('base64'))

    expect(unsealAll(archive, passphraseIdentity(words, salt, LOW))).toEqual(SMALL)
    // The same passphrase and salt at the DEFAULT cost is a different key, which is exactly
    // why the reader has to be told: this is what every old archive would have become.
    expect(() => unsealAll(archive, passphraseIdentity(words, salt))).toThrow('no-matching-key')
  })

  it('refuses a cost a header asks for and no honest archive would', () => {
    // Read before the MAC can be checked, so a hostile header is asking the person restoring to
    // allocate whatever it names. 2^30 at r=8 is a terabyte and scrypt would try.
    expect(() => costFrom({ n: 2 ** 30, r: 8, p: 1 })).toThrow('bad-kdf')
    expect(() => costFrom({ n: 65_536, r: 4096, p: 1 })).toThrow('bad-kdf')
    expect(() => costFrom({ n: 100_000, r: 8, p: 1 })).toThrow('bad-kdf') // not a power of two
    expect(() => costFrom({ r: 8, p: 1 })).toThrow('bad-kdf')
    expect(costFrom({ n: 65_536, r: 8, p: 1 })).toEqual({ n: 65_536, r: 8, p: 1 })
  })

  it('writes the cost it actually spent into the header', () => {
    const pass = passphraseRecipient('sau chu va mot con so 7')
    const archive = seal(SMALL, [pass.publicKey], pass.salt)
    const header = JSON.parse(archive.toString('latin1').split('\n')[1]!) as { kdf: Record<string, number> }
    expect(costFrom(header.kdf)).toEqual(COST)
  })
})

describe('the archive opens for either recipient', () => {
  it('round-trips through the identity, byte for byte', () => {
    const me = newIdentity()
    expect(unsealAll(seal(SMALL, [me.publicKey], SALT), identityOf(me.secret))).toEqual(SMALL)
  })

  it('round-trips through the passphrase alone, with no file kept anywhere', () => {
    // The point of the second recipient: months later, nothing survives but the words.
    const salt = randomBytes(16)
    const pass = passphraseRecipient('sau chu va mot con so 7', salt)
    const archive = seal(SMALL, [pass.publicKey], pass.salt)
    expect(unsealAll(archive, passphraseIdentity('sau chu va mot con so 7', salt))).toEqual(SMALL)
  })

  it('opens with EITHER when both were sealed in, which is the whole reason there are two', () => {
    const me = newIdentity()
    const salt = randomBytes(16)
    const pass = passphraseRecipient('sau chu va mot con so 7', salt)
    const archive = seal(SMALL, [me.publicKey, pass.publicKey], pass.salt)
    expect(unsealAll(archive, identityOf(me.secret))).toEqual(SMALL)
    expect(unsealAll(archive, passphraseIdentity('sau chu va mot con so 7', salt))).toEqual(SMALL)
  })

  it('carries the salt in the header, because recovery may have nothing but the file', () => {
    const salt = randomBytes(16)
    const pass = passphraseRecipient('sau chu va mot con so 7', salt)
    const archive = seal(SMALL, [pass.publicKey], pass.salt)
    const header = JSON.parse(archive.toString('latin1').split('\n')[1]!) as { kdf: { salt: string } }
    expect(Buffer.from(header.kdf.salt, 'base64')).toEqual(Buffer.from(salt))
  })
})

describe('what it refuses, and by what name', () => {
  const me = newIdentity()
  const archive = () => seal(SMALL, [me.publicKey], SALT)

  it('refuses a stranger, and does not say the archive is broken', () => {
    expect(() => unsealAll(archive(), identityOf(newIdentity().secret))).toThrow('no-matching-key')
  })

  it('refuses the wrong passphrase by the same name, not by opening onto rubbish', () => {
    const salt = randomBytes(16)
    const pass = passphraseRecipient('the right words', salt)
    const a = seal(SMALL, [pass.publicKey], pass.salt)
    expect(() => unsealAll(a, passphraseIdentity('the wrong words', salt))).toThrow('no-matching-key')
  })

  it('refuses a header somebody edited, before it reads a byte of payload', () => {
    const a = archive()
    const text = a.toString('latin1')
    const two = text.indexOf('\n', text.indexOf('\n') + 1)
    // Swap the MAC for one of the right length. The recipients still unwrap; the header lies.
    const forged = Buffer.concat([
      Buffer.from(text.slice(0, two + 1)),
      Buffer.from(Buffer.from(randomBytes(32)).toString('base64') + '\n'),
      a.subarray(text.indexOf('\n', two + 1) + 1),
    ])
    expect(() => unsealAll(forged, identityOf(me.secret))).toThrow('header-tampered')
  })

  it('refuses something that is not an archive at all', () => {
    expect(() => unsealAll(Buffer.from('a\nb\nc\n'), identityOf(me.secret))).toThrow('not-an-archive')
  })

  it('refuses a version it does not know, rather than guessing at the layout', () => {
    const a = archive()
    expect(() => unsealAll(Buffer.from(a.toString('latin1').replace('"v":1', '"v":9'), 'latin1'),
      identityOf(me.secret))).toThrow('wrong-version')
  })

  it('refuses a payload with one byte changed in it', () => {
    const a = archive()
    a[a.length - 30] ^= 1
    expect(() => unsealAll(a, identityOf(me.secret))).toThrow()
  })

  it('refuses an archive whose tail was cut off ON A FRAME BOUNDARY', () => {
    // ⚠️ THE ONE THAT MATTERS MOST AND LOOKS LEAST LIKE A SECURITY TEST. A truncated backup is
    // what a full disk or a killed upload produces, and without the final-chunk flag the short
    // file opens perfectly and is missing the end of somebody's blog.
    //
    // ⚠️ AND THE CUT HAS TO LAND EXACTLY ON A BOUNDARY. The first version of this test lopped
    // off an arbitrary tail, which leaves a half frame that fails its GCM tag for a reason that
    // has nothing to do with the flag — it passed with the flag REMOVED, which is a test
    // agreeing with itself. Two whole frames, the last one taken away cleanly, so what is left
    // is a valid frame and only the flag can tell it is not the end.
    const a = seal(Buffer.from(randomBytes(CHUNK * 2)), [me.publicKey], SALT)
    const cut = a.subarray(0, a.length - (CHUNK + 16))
    expect(() => unsealAll(cut, identityOf(me.secret))).toThrow()
  })

  it('refuses a stanza lifted out of another archive', () => {
    // The wrap key is bound to both public keys, so a moved stanza derives a different key.
    // ⚠️ SAID OUT LOUD: this test would also pass without that binding, because the header MAC
    // catches the same move one step later. The binding is a second barrier nothing here can
    // observe on its own, and it is kept for the cost of concatenating two buffers.
    const mine = seal(SMALL, [me.publicKey], SALT)
    const theirs = seal(Buffer.from('somebody else\'s blog'), [me.publicKey], SALT)
    const line = (b: Buffer) => b.toString('latin1').split('\n')
    const swapped = Buffer.from([line(mine)[0], line(theirs)[1], line(mine)[2]].join('\n') + '\n', 'latin1')
    const body = mine.subarray(mine.toString('latin1').indexOf('\n', mine.toString('latin1').indexOf('\n', mine.toString('latin1').indexOf('\n') + 1) + 1) + 1)
    expect(() => unsealAll(Buffer.concat([swapped, body]), identityOf(me.secret))).toThrow('header-tampered')
  })
})

describe('the frames line up however tar hands the bytes over', () => {
  const me = newIdentity()
  const check = (size: number, pushes: number) => {
    const plain = Buffer.from(randomBytes(size))
    expect(unsealAll(seal(plain, [me.publicKey], SALT, pushes), identityOf(me.secret))).toEqual(plain)
  }

  it('an archive smaller than one chunk', () => check(10, 1))
  it('an archive of exactly one chunk', () => check(CHUNK, 1))
  it('an archive of exactly two chunks', () => check(CHUNK * 2, 1))
  it('an archive that is not a multiple of the chunk', () => check(CHUNK * 2 + 7, 1))
  it('the same bytes arriving in many small pushes', () => check(CHUNK * 2 + 7, 40))
  it('an empty archive, which is a tar of nothing rather than an error', () => check(0, 1))
})

describe('what a sealed archive gives away', () => {
  it('does not carry a secret that the same search finds in the plaintext', () => {
    // ⚠️ THE COUNTER-TEST IS THE LOAD-BEARING HALF. "The key is not in the file" is also true
    // of an empty file and of a search that was looking for the wrong string, so the same
    // needle is looked for in the plaintext first and has to be found.
    const secret = 'sk-do-not-ship-this-anywhere-1234567890'
    const plain = Buffer.from(`smtp_pass=${secret}\n`.repeat(50))
    expect(plain.toString('latin1')).toContain(secret)
    const me = newIdentity()
    expect(seal(plain, [me.publicKey], SALT).toString('latin1')).not.toContain(secret)
  })

  it('does not carry the passphrase, only a public key derived from it', () => {
    const salt = randomBytes(16)
    const pass = passphraseRecipient('mot cum mat khau that dai', salt)
    const a = seal(SMALL, [pass.publicKey], pass.salt).toString('latin1')
    expect(a).not.toContain('mot cum mat khau')
    expect(a).not.toContain(pass.publicKey)
  })

  it('says what it is in its first line, so a stranger can look the format up', () => {
    const me = newIdentity()
    expect(seal(SMALL, [me.publicKey], SALT).toString('latin1').split('\n')[0]).toBe(MAGIC)
  })

  it('names the same key the same way every time it is written down', () => {
    const me = newIdentity()
    expect(encodePublic(decodePublic(me.publicKey))).toBe(me.publicKey)
    expect(() => decodePublic('quire-backup-pub-1nonsense')).toThrow('not-a-public-key')
    expect(() => decodeSecret(me.publicKey)).toThrow('not-an-identity')
  })
})
