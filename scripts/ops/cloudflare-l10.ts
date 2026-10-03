// L10 (ADR 0066): install this release on Cloudflare for real, upgrade it in place, smoke-test it
// both times, and delete everything it made. Run before a tag, from the release manager's machine:
// the token belongs to a real account and does not go into the public repository's CI.
//
//   bun run build && bun run build:worker && bun scripts/pack-worker.ts
//   QUIREINK_CF_KEYFILE=~/path/to/keyfile bun scripts/ops/cloudflare-l10.ts
//
// The key file holds `account_id: …` and `api_token: …` lines (or set CLOUDFLARE_ACCOUNT_ID and
// CLOUDFLARE_API_TOKEN). CF_CONFIRMED_PAID=1 for a token without Billing · Read on an account the
// operator knows is on Workers Paid. Only `quireink-l10-*` names are created and deleted.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { APP_VERSION } from '../../src/version'
import { readTar } from '../../src/install/cloudflare/tar'
import { installOnCloudflare, uninstallFromCloudflare, type Manifest } from '../../src/install/cloudflare/install'

const ROOT = resolve(import.meta.dir, '..', '..')
function credentials(): { token: string; accountId: string } {
  const file = process.env.QUIREINK_CF_KEYFILE
  if (file) {
    const kv = Object.fromEntries(readFileSync(file, 'utf8').split('\n')
      .map((l) => /^([\w-]+)\s*[:=]\s*(.+)$/.exec(l.trim())).filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1]!, m[2]!.trim()]))
    return { token: kv.api_token ?? '', accountId: kv.account_id ?? '' }
  }
  return { token: process.env.CLOUDFLARE_API_TOKEN ?? '', accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '' }
}

const { token, accountId } = credentials()
if (!token || !accountId) {
  console.error('L10: no Cloudflare credentials (QUIREINK_CF_KEYFILE, or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)')
  process.exit(2)
}

const files = await readTar(new Uint8Array(readFileSync(join(ROOT, 'dist', `quireink-cf-${APP_VERSION}.tar`))))
const manifest = JSON.parse(new TextDecoder().decode(files.get('manifest.json')!)) as Manifest
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const scriptName = `quireink-l10-${stamp}`
const bucket = scriptName
const code = `l10-setup-code-${stamp}`
const base = { token, accountId, scriptName, bucket, manifest, files, confirmedPaid: process.env.CF_CONFIRMED_PAID === '1' }
const step = (s: string, d?: string) => console.log(`  · ${s}${d ? `: ${d}` : ''}`)

function smoke(url: string): boolean {
  const r = spawnSync(process.execPath, ['scripts/smoke.ts', url], {
    cwd: ROOT, stdio: 'inherit',
    env: { ...process.env, EXPECT_VERSION: manifest.version, EXPECT_PACKAGE: 'cloudflare', SETUP_CODE: code },
  })
  return r.status === 0
}

let ok = false
try {
  console.log(`L10: installing ${manifest.version} as ${scriptName}`)
  const first = await installOnCloudflare({ ...base, secrets: { SETUP_CODE: code }, onStep: step })
  if (!first.firstInstall) throw new Error('expected a first install')
  console.log(`L10: ${first.url}`)
  if (!smoke(first.url)) throw new Error('smoke failed after the install')
  console.log('L10: upgrading in place (secrets kept)')
  const again = await installOnCloudflare({ ...base, onStep: step })
  if (again.firstInstall) throw new Error('the upgrade was taken for a first install')
  if (!smoke(again.url)) throw new Error('smoke failed after the upgrade')
  ok = true
} catch (error) {
  console.error(`L10: ${(error as Error).message}`)
} finally {
  console.log(`L10: deleting ${scriptName}`)
  await uninstallFromCloudflare({ token, accountId, scriptName, bucket }).catch((e: unknown) => console.error(`L10: cleanup: ${(e as Error).message}`))
}
if (ok) {
  // The report a release is checked against: this commit, this version, passed.
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim()
  mkdirSync(join(ROOT, '.tmp', 'l10'), { recursive: true })
  writeFileSync(join(ROOT, '.tmp', 'l10', `${sha}.json`), JSON.stringify({ sha, version: manifest.version, at: new Date().toISOString() }) + '\n')
}
console.log(ok ? `✓ L10: ${manifest.version} installs, upgrades and serves on Cloudflare` : '✗ L10 failed')
process.exit(ok ? 0 : 1)
