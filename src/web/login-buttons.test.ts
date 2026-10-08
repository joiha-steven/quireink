// The sign-in and setup screens style a submit button only through its class (`login.css.ts`):
// a bare `<button type="submit">` gets the browser's own, which on macOS Safari is a small bright
// blue lozenge glued to the field above it. The code-entry screen shipped exactly that until
// 2026-10-04, found on a real Deploy-to-Cloudflare install rather than by any check, because the
// screens around it all carried the class.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SCREENS = ['login-page.ts', 'setup-page.ts', 'setup-claim-page.ts', 'setup-restore.ts']

describe('every submit button on the sign-in and setup screens', () => {
  for (const file of SCREENS) {
    it(`${file}: names its class`, () => {
      const src = readFileSync(join(import.meta.dir, file), 'utf8')
      const bare = [...src.matchAll(/<button\b[^>]*type="submit"[^>]*>/g)].map((m) => m[0]).filter((tag) => !/\bclass="/.test(tag))
      expect(bare).toEqual([])
    })
  }
})
