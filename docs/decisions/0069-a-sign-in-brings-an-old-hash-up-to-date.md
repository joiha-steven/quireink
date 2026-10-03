# 0069 — A sign-in brings an old password hash up to today's parameters

Date: 2026-10-03
Status: accepted; amends [0068](0068-new-password-hashes-use-19-mib.md) ("nothing is rehashed on sign-in")
In force: see the [index](README.md). The index is maintained; this file is not.

## The problem

[0068](0068-new-password-hashes-use-19-mib.md) lowered NEW hashes to 19 MiB and left old ones as they
were, on the reasoning that both runtimes verify a 64 MiB hash. Building the Cloudflare side
showed that reasoning holds for time and not for memory:

- The WASM argon2id builds reserve their memory up front: `argon2id` 1.0.1 declares a minimum of
  1,040 pages (65 MB) in its module, so it costs 65 MB whatever `m` is asked for, and the memory is
  never handed back. Measured 2026-10-03: instantiating it with less fails ("provided a size that
  is smaller than the module's declared initial").
- argon2id in plain JS (`@noble/hashes`) allocates what `m` asks for and lets it go: 140 ms for a
  19 MiB hash, and it verifies Bun's hashes and Bun verifies its own, both ways, at 19 and at 64 MiB.
  But verifying a 64 MiB hash allocates 64 MiB, beside a 40–46 MB heap, in a 128 MB isolate.

So a blog moved from Bun to Cloudflare with its owner's password still hashed at 64 MiB would put
the sign-in, of all requests, at the edge of the memory limit.

## The decision

1. **A successful sign-in stores the same password again at today's parameters** when the stored
   hash was made with others (`needsRehash`). It is the one moment the password is in hand; it costs
   one extra hash, once per account, and `updated_at` does not move because nothing about the
   account changed.
2. **The Cloudflare runtime hashes with `@noble/hashes`**, not a WASM build, for the memory reason
   above.

## What it costs

- An owner who never signs in on Bun after upgrading keeps the old hash, and would sign in on
  Cloudflare at the edge of the limit. The move to Cloudflare (G5) will check the owner's hash and ask
  for one sign-in on the old blog first if it is still old.
- Recovery codes are only ever compared, never re-entered as a whole set, so their hashes keep the
  parameters they were made with until new codes are generated. The move will offer to generate new
  ones for the same reason.
