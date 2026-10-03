// Cloudflare: argon2id in plain JS (`@noble/hashes`, ADR 0069). The WASM builds reserve 65 MB up
// front in a 128 MB isolate; this allocates what `m` asks for and lets it go. Same PHC strings as
// `Bun.password`, both ways (measured 2026-10-03 at 19 and 64 MiB).
import { argon2id } from '@noble/hashes/argon2.js'
import type { PasswordPort } from '@/runtime/ports'

const enc = new TextEncoder()
const b64 = (u: Uint8Array): string => btoa(String.fromCharCode(...u)).replace(/=+$/, '')
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0))

export const hash: PasswordPort['hash'] = async (password, params) => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const tag = argon2id(enc.encode(password), salt, { t: params.timeCost, m: params.memoryCost, p: 1, dkLen: 32 })
  return `$argon2id$v=19$m=${params.memoryCost},t=${params.timeCost},p=1$${b64(salt)}$${b64(tag)}`
}

export const verify: PasswordPort['verify'] = async (password, stored) => {
  const m = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(stored)
  if (!m) return false
  try {
    const want = unb64(m[5]!)
    const tag = argon2id(enc.encode(password), unb64(m[4]!), { t: Number(m[2]), m: Number(m[1]), p: Number(m[3]), dkLen: want.length })
    let diff = tag.length ^ want.length
    for (let i = 0; i < want.length; i++) diff |= tag[i]! ^ want[i]!
    return diff === 0
  } catch {
    return false
  }
}
