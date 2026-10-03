# 0068 — New password hashes use 19 MiB, not 64

Date: 2026-10-03
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## The problem

`Bun.password.hash` defaults to argon2id with m = 65536 KiB (64 MiB), t = 2, p = 1. Measured on
2026-10-03 inside workerd with an argon2id WASM build: one hash or verify allocates about 65 MB of
WASM memory that the library does not hand back, on top of a 40–46 MB heap that the bundle occupies
before the first request. On Cloudflare's 128 MB isolate ([0066](0066-cloudflare-is-a-second-runtime.md))
a sign-in can be the request that crosses the limit.

## The decision

**New hashes use argon2id with m = 19456 KiB (19 MiB), t = 2, p = 1 — the minimum OWASP recommends
for argon2id — on both runtimes**, so a password hashed on one verifies on the other and behaves the
same everywhere.

Existing hashes keep working unchanged: the PHC string carries its own parameters, and both runtimes
verify a 64 MiB hash. Nothing is rehashed on sign-in; an owner who changes their password gets the
new parameters.

## What it costs

A hash at 19 MiB is cheaper to attack than one at 64 MiB. It stays at the floor a current reference
recommends for this algorithm, and the alternative — a sign-in that can kill the process it runs in —
is a worse failure for the person this protects.
