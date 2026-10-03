// Bun: its own argon2id, native, so no dependency. Cloudflare's side is a WASM argon2id loaded
// from a static module (measured 2026-10-03: it verifies Bun's hashes and Bun verifies its own).
import type { PasswordPort } from '@/runtime/ports'

export const hash: PasswordPort['hash'] = (password, params) =>
  Bun.password.hash(password, { algorithm: 'argon2id', memoryCost: params.memoryCost, timeCost: params.timeCost })

// `verify` throws on a malformed hash rather than returning false. A row whose hash was corrupted
// should fail the sign-in, not 500 it.
export const verify: PasswordPort['verify'] = (password, stored) =>
  Bun.password.verify(password, stored).catch(() => false)
