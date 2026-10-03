// `install.sh` follows releases, never moves an install backwards, and labels its package
// (ADR 0065). The script is shell, so the test drives it as shell: a throwaway git repository
// with tags plays the remote, and a stub `bun` on PATH answers the version check and swallows the
// install and the two builds. What is under test is which commit ends up checked out.
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, chmodSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SCRIPT = resolve(import.meta.dir, '../../install.sh')
let root = ''
let remote = ''
let bin = ''

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
  return r.stdout.trim()
}

function commit(version: string, note: string, tag?: string): void {
  writeFileSync(join(remote, 'package.json'), `{\n  "name": "quireink",\n  "version": "${version}"\n}\n`)
  writeFileSync(join(remote, 'NOTE'), note)
  git(remote, 'add', '-A')
  git(remote, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', note)
  if (tag) git(remote, 'tag', tag)
}

function install(dir: string, env: Record<string, string> = {}): { status: number | null; out: string } {
  const r = spawnSync('bash', [SCRIPT, dir], {
    encoding: 'utf8',
    env: { PATH: `${bin}:${process.env.PATH}`, HOME: root, QUIREINK_SOURCE: remote, NO_RUN: '1', GIT_CONFIG_GLOBAL: '/dev/null', ...env },
  })
  return { status: r.status, out: `${r.stdout}${r.stderr}` }
}

const note = (dir: string) => readFileSync(join(dir, 'NOTE'), 'utf8')

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'quire-install-'))
  remote = join(root, 'remote')
  bin = join(root, 'bin')
  mkdirSync(remote)
  mkdirSync(bin)
  // The stub: `bun --version` says 1.3.14, anything else succeeds and does nothing.
  writeFileSync(join(bin, 'bun'), '#!/bin/sh\n[ "$1" = "--version" ] && echo 1.3.14\nexit 0\n')
  chmodSync(join(bin, 'bun'), 0o755)
  git(remote, 'init', '-q', '-b', 'main')
  commit('2.2.14', 'release 2.2.14', 'v2.2.14')
  commit('2.2.14', 'unreleased after 2.2.14')
  commit('2.2.15', 'release 2.2.15', 'v2.2.15')
  commit('2.2.15', 'unreleased after 2.2.15')
  commit('2.3.0-beta.1', 'a beta', 'v2.3.0-beta.1')
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('install.sh', () => {
  it('installs the newest release, not main and not a pre-release', () => {
    const dir = join(root, 'fresh')
    const r = install(dir)
    expect(r.status).toBe(0)
    expect(note(dir)).toBe('release 2.2.15')
  })

  it('installs the release it is asked for', () => {
    const dir = join(root, 'pinned')
    expect(install(dir, { QUIREINK_VERSION: '2.2.14' }).status).toBe(0)
    expect(note(dir)).toBe('release 2.2.14')
  })

  it('moves an older release forward when run again', () => {
    const dir = join(root, 'forward')
    install(dir, { QUIREINK_VERSION: '2.2.14' })
    const r = install(dir)
    expect(r.status).toBe(0)
    expect(note(dir)).toBe('release 2.2.15')
  })

  it('refuses to take an install back to an older release', () => {
    const dir = join(root, 'back')
    install(dir)
    const r = install(dir, { QUIREINK_VERSION: '2.2.14' })
    expect(r.status).not.toBe(0)
    expect(r.out).toContain('never goes back')
    expect(note(dir)).toBe('release 2.2.15')
  })

  it('leaves a checkout of main that is past the newest release where it is', () => {
    const dir = join(root, 'main-ahead')
    git(root, 'clone', '-q', remote, dir)
    git(dir, 'reset', '-q', '--hard', 'v2.2.15')
    git(dir, 'merge', '-q', '--ff-only', 'origin/main') // main now ends at the beta commit
    git(dir, 'reset', '-q', '--hard', 'HEAD~1') // "unreleased after 2.2.15", version 2.2.15
    const r = install(dir)
    expect(r.status).toBe(0)
    expect(note(dir)).toBe('unreleased after 2.2.15')
    expect(r.out).toContain('stays where it is')
  })

  it('moves a checkout of main that is behind the newest release onto it', () => {
    const dir = join(root, 'main-behind')
    git(root, 'clone', '-q', remote, dir)
    git(dir, 'reset', '-q', '--hard', 'v2.2.14')
    git(dir, 'reset', '-q', '--hard', 'HEAD') // on branch main, holding 2.2.14
    expect(install(dir).status).toBe(0)
    expect(note(dir)).toBe('release 2.2.15')
  })

  it('follows main only when asked to', () => {
    const dir = join(root, 'channel-main')
    expect(install(dir, { QUIREINK_CHANNEL: 'main' }).status).toBe(0)
    expect(note(dir)).toBe('a beta')
  })

  it('says it is the source package, once, and leaves the rest of .env alone', () => {
    const dir = join(root, 'env')
    install(dir)
    writeFileSync(join(dir, '.env'), `${readFileSync(join(dir, '.env'), 'utf8')}SITE_URL=https://example.org\n`)
    install(dir)
    const env = readFileSync(join(dir, '.env'), 'utf8')
    expect(env.match(/^QUIREINK_PACKAGE=source$/gm)?.length).toBe(1)
    expect(env).toContain('SITE_URL=https://example.org')
  })

  it('names a release that does not exist instead of failing somewhere later', () => {
    const r = install(join(root, 'missing'), { QUIREINK_VERSION: '9.9.9' })
    expect(r.status).not.toBe(0)
    expect(r.out).toContain('no release 9.9.9')
    expect(existsSync(join(root, 'missing', 'NOTE'))).toBe(false)
  })
})
