// The `user` CLI, run for real against a throwaway data directory (FIXLIST 9.4).
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const dir = mkdtempSync(join(tmpdir(), 'quire-user-cli-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const PASSWORD = 'wandering violet cassette'
function run(...args: string[]): { code: number; out: string } {
  const p = Bun.spawnSync(['bun', 'scripts/user.ts', ...args], {
    env: { ...process.env, DATA_DIR: dir }, stdin: new TextEncoder().encode(`${PASSWORD}\n`),
  })
  return { code: p.exitCode ?? 1, out: p.stdout.toString() + p.stderr.toString() }
}

describe('bun run user', () => {
  it('never takes another flag as a value', () => {
    const r = run('create', '--username', '--email', 'me@example.com')
    expect(r.code).toBe(1)
    expect(r.out).toContain('--username is required')
  })

  it('refuses an address that is not one', () => {
    const r = run('create', '--username=me', '--email=notanemail')
    expect(r.code).toBe(1)
    expect(r.out).toContain('is not an email address')
  })

  it('understands --flag=value, and renames the one owner', () => {
    expect(run('create', '--username=me', '--email=me@example.com').code).toBe(0)
    const r = run('rename', '--username', 'me', '--to', 'steven')
    expect(r.code).toBe(0)
    expect(run('list').out).toContain('steven')
    expect(run('rename', '--username', 'steven', '--to', 'has space').code).toBe(1)
  })
})
