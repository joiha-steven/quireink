// `bun run upgrade` moves a source install forward, and puts it back when the new release does not
// come up (ADR 0065). Driven end to end against a throwaway remote: a stub `bun` stands in for the
// install and the builds (and fails the build of a release that carries BREAK_BUILD), the restart
// is a shell command that writes the version the "blog" now serves, and a small server answers
// /api/health with whatever was written last. A release carrying FAIL_BOOT never comes up.
import { describe, it, expect, beforeAll, afterAll, setDefaultTimeout } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { newer, newestRelease } from '../../scripts/upgrade'

// The two going-back cases wait out a health timeout on the way forward and a restart on the way
// back; five seconds is not enough for either.
setDefaultTimeout(30_000)

const SCRIPT = resolve(import.meta.dir, '../../scripts/upgrade.ts')
const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
let root = ''
let remote = ''
let stub = ''
let served = ''
let server: ReturnType<typeof Bun.serve> | null = null

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...GIT_ENV } })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
  return r.stdout.trim()
}

function release(version: string, extra: Record<string, string> = {}): void {
  rmSync(join(remote, 'BREAK_BUILD'), { force: true })
  rmSync(join(remote, 'FAIL_BOOT'), { force: true })
  writeFileSync(join(remote, 'package.json'), `{\n  "name": "quireink",\n  "version": "${version}"\n}\n`)
  for (const [name, body] of Object.entries(extra)) writeFileSync(join(remote, name), body)
  git(remote, 'add', '-A')
  git(remote, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', `release ${version}`)
  git(remote, 'tag', `v${version}`)
}

function installAt(name: string, version: string): string {
  const dir = join(root, name)
  git(root, 'clone', '-q', remote, dir)
  git(dir, 'checkout', '-q', '--detach', `v${version}`)
  writeFileSync(served, version)
  return dir
}

// The restart: a booting release writes its version, unless it is one that never comes up. It
// also leaves a pre-migration copy behind, the way a real boot would before it died.
const RESTART = [
  'v=$(sed -n \'s/.*"version": "\\(.*\\)".*/\\1/p\' package.json)',
  'if [ -f FAIL_BOOT ]; then mkdir -p data/backups && : > data/backups/pre-0099-test-quire.db && echo dead > "$SERVED"; else echo "$v" > "$SERVED"; fi',
].join('; ')

// ASYNC, not spawnSync: the fake /api/health lives in this process, and a synchronous spawn would
// hold its event loop for as long as the script runs, so it could never answer.
async function upgrade(dir: string, args: string[] = [], env: Record<string, string> = {}): Promise<{ status: number | null; out: string }> {
  const proc = Bun.spawn([process.execPath, SCRIPT, ...args], {
    cwd: dir,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env, ...GIT_ENV,
      QUIREINK_BUN: stub,
      QUIREINK_RESTART: RESTART,
      QUIREINK_HEALTH_URL: `http://127.0.0.1:${server!.port}/api/health`,
      QUIREINK_HEALTH_TIMEOUT: '4',
      QUIREINK_PACKAGE: 'source',
      SERVED: served,
      ...env,
    },
  })
  const [out, err, status] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  return { status, out: `${out}${err}` }
}

const at = (dir: string) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version as string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'quire-upgrade-'))
  remote = join(root, 'remote')
  served = join(root, 'served')
  stub = join(root, 'bun-stub')
  mkdirSync(remote)
  writeFileSync(stub, '#!/bin/sh\n[ "$1 $2" = "run build:admin" ] && [ -f BREAK_BUILD ] && exit 1\nexit 0\n')
  chmodSync(stub, 0o755)
  git(remote, 'init', '-q', '-b', 'main')
  release('2.2.14')
  release('2.2.15')
  release('2.2.16', { FAIL_BOOT: '' })
  release('2.2.17', { BREAK_BUILD: '' })
  server = Bun.serve({
    port: 0,
    fetch: () => {
      const version = readFileSync(served, 'utf8').trim()
      return version === 'dead' ? new Response('down', { status: 502 }) : Response.json({ status: 'ok', version })
    },
  })
})

afterAll(() => {
  server?.stop(true)
  rmSync(root, { recursive: true, force: true })
})

describe('choosing a release', () => {
  it('compares versions as numbers, not as text', () => {
    expect(newer('2.10.0', '2.9.9')).toBe(true)
    expect(newer('2.2.16', '2.2.16')).toBe(false)
    expect(newer('2.2.15', '2.2.16')).toBe(false)
  })

  it('takes the newest release and never a pre-release', () => {
    const tags = ['v2.2.9', 'v2.2.16', 'v2.3.0-beta.1', 'v2.2.10'].map((t) => `abc\trefs/tags/${t}`).join('\n')
    expect(newestRelease(tags)).toBe('2.2.16')
    expect(newestRelease('')).toBeNull()
  })
})

describe('bun run upgrade', () => {
  it('moves to the release asked for and waits until it answers with that version', async () => {
    const dir = installAt('forward', '2.2.14')
    const r = await upgrade(dir, ['2.2.15'])
    expect(r.status).toBe(0)
    expect(at(dir)).toBe('2.2.15')
    expect(readFileSync(served, 'utf8').trim()).toBe('2.2.15')
  })

  it('goes back, rebuilt and restarted, when the build of the new release fails', async () => {
    const dir = installAt('broken-build', '2.2.15')
    const r = await upgrade(dir) // the newest release is 2.2.17, whose build fails
    expect(r.status).not.toBe(0)
    expect(r.out).toContain('The build failed')
    expect(at(dir)).toBe('2.2.15')
    expect(readFileSync(served, 'utf8').trim()).toBe('2.2.15')
  })

  it('goes back when the new release never reports itself, and names the copy it took first', async () => {
    const dir = installAt('never-up', '2.2.15')
    const r = await upgrade(dir, ['2.2.16'])
    expect(r.status).not.toBe(0)
    expect(r.out).toContain('did not report 2.2.16 within 4 s')
    expect(r.out).toContain('pre-0099-test-quire.db')
    expect(r.out).toContain('2.2.15 is running again')
    expect(at(dir)).toBe('2.2.15')
  })

  it('never goes back to an older release', async () => {
    const dir = installAt('older', '2.2.15')
    const r = await upgrade(dir, ['2.2.14'])
    expect(r.status).not.toBe(0)
    expect(r.out).toContain('never goes back')
    expect(at(dir)).toBe('2.2.15')
  })

  it('will not overwrite files that came with Quire Ink and were edited', async () => {
    const dir = installAt('edited', '2.2.14')
    writeFileSync(join(dir, 'package.json'), `${readFileSync(join(dir, 'package.json'), 'utf8')}\n`)
    const r = await upgrade(dir, ['2.2.15'])
    expect(r.status).not.toBe(0)
    expect(r.out).toContain('have been edited')
  })

  it('points an image install at the image instead', async () => {
    const dir = installAt('docker', '2.2.14')
    const r = await upgrade(dir, ['2.2.15'], { QUIREINK_PACKAGE: 'docker' })
    expect(r.status).not.toBe(0)
    expect(r.out).toContain('docker compose pull')
    expect(at(dir)).toBe('2.2.14')
  })
})
