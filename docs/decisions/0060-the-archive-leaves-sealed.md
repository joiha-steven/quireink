# 0060 — The archive leaves sealed, to a key this server does not hold

Date: 2026-09-20
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## The problem

There is no encryption at rest anywhere in Quire Ink, and for the database that is the right
answer: the key would have to live on the same disk for the process to boot unattended, so it
would protect against a stolen disk and against nothing else. The images are public content
anyone can fetch with `curl`.

The archive is different, and it is different in one specific way: **it is the only thing here
that leaves the machine.** `runBackup` writes it to disk, [ADR 0035](0035-the-snapshot-leaves-the-machine.md)
PUTs it into somebody else's bucket, and the owner downloads it onto a laptop and from there
into a cloud drive or a USB stick.

What travels with it is not only the writing. The archive is a `VACUUM INTO` of both databases,
so it carries `smtp_pass`, the AI key, the Cloudflare token, the S3 pair, `users.totp_secret`,
the fediverse actor's private key and every subscriber's email address. `docs/backups.md` said
where the file goes and when, and never said what was in it.

There was an inconsistency to go with it. The Markdown export deliberately carries no
credential, and `export-md.test.ts` plants three secrets and looks for them. The full archive
carries every one of them and nothing said so.

## The decision

**An owner may ask for every archive to be sealed, and it is sealed to keys this server cannot
open.** Off at install and off on upgrade.

Both recipients are X25519 **public** halves. The server can lock an archive and cannot unlock
one, so a box somebody else is now root on does not hand over its own backups. That property is
the whole feature; a passphrase stored on the machine so that cron can run would have removed it
while leaving the switch looking the same.

There are **two** recipients because there are two ways to lose one:

1. an **identity**, generated in the admin and shown once, never stored — the bargain
   `mcp/tokens.ts` already makes;
2. a **passphrase**, typed once at setup. A keypair is derived from it with scrypt; the public
   half and the salt are kept, the words are not.

Either opens the archive. One recipient would have introduced the failure this feature exists to
prevent: an archive nobody can read.

## The format

Written out here so it can be rebuilt from this document alone. ADR 0035 says a restore is a
shell act on a stopped service, so on the day it is needed there may be no Quire Ink running and
no `scripts/backup-decrypt.ts` either.

```
QUIREBAK1\n
{"v":1,"recipients":[{"t":"x25519","eph":"<b64>","key":"<b64>","tag":"<b64>"}, …],
 "kdf":{"n":65536,"r":8,"p":1,"salt":"<b64>"},"chunk":65536}\n
<header MAC, base64>\n
<frame 0> <frame 1> … <final frame>
```

* One random 32-byte **file key** per archive. Each stanza wraps it with AES-256-GCM under
  `HKDF-SHA256(X25519(ephemeral, recipient), salt = ephemeral ‖ recipient, "quire-backup-v1 wrap")`,
  nonce all-zero — safe because the wrap key is used once, for one 32-byte message.
* The **header MAC** is HMAC-SHA256 over `QUIREBAK1\n<json>\n` under
  `HKDF(fileKey, "quire-backup-v1 header")`. Checked before a byte of payload is read.
* A **frame** is up to 65536 bytes of ciphertext plus a 16-byte tag. Nonce is a 12-byte buffer
  with the frame number big-endian at offset 7 and **byte 11 set to 1 on the final frame only**.
  That last byte is what stops a truncated archive opening as a whole one, which is the failure
  a full disk or a killed upload actually produces.
* The passphrase recipient's private half is `scrypt(passphrase, salt, N=65536, r=8, p=1)` read
  as a 32-byte X25519 seed. The salt is in the header because recovery may have nothing else.

## Why not age, and why no dependency

`age` would have been the better file format: a decade of tooling already reads it. It is not
available here. **Bun ships no ChaCha20-Poly1305**, in `node:crypto` or in WebCrypto — measured
2026-09-20 — so an age-compatible payload would need a hand-written stream cipher running over
the owner's entire blob store. That is exactly the surface
[ADR 0053](0053-a-dependency-is-a-decision.md) keeps `sharp` for, and the opposite of what its
`sharp` clause permits.

AES-256-GCM is in the floor and is fast enough to be free: **5.5 GB/s in 64 KiB chunks**, against
87 ms of gzip over the same 256 MB. The cipher disappears into the tar that has to happen anyway.

## Consequences

* **The server cannot read its own backups.** Nothing in the application decrypts, and there is
  no code path to a private half, because it holds none.
* **Losing both recipients loses every sealed archive.** This is the cost, it is stated on the
  card in a warning that survives the explanations being switched off, and the switch refuses to
  turn on before both keys exist.
* **`isSnapshotName` had to widen in the same breath as the filename.** It is three things at
  once: the path-traversal allowlist for the download and delete routes, and the filter that
  prunes the remote bucket. A mismatch there would have matched nothing, for ever, with no error
  — `replicateSnapshot` swallows its failures by design.
* **The keys can be replaced and cannot be erased.** An empty string arriving from a half-built
  settings payload would otherwise un-seal every future archive silently.
* **The Markdown export stays in the clear.** It carries no credential and it is the path for "I
  just want my writing", which must not need a key.
* **No rotation, and no re-encryption of what already exists.** Turning the switch on seals what
  is written from then on. Old plaintext snapshots stay until retention removes them.
