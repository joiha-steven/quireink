// The Cloudflare installer's two refusals that must never be skipped, and the tar reader it trusts
// (G5.3). The whole install against a real account is L10: `scripts/ops/cloudflare-l10.ts`.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readTar } from './tar'
import { installOnCloudflare, type Manifest } from './install'

let dir = ''
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'quire-cf-install-')) })
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('readTar', () => {
  it('reads what tar wrote, a long path included', () => {
    const long = `${'deep/'.repeat(30)}file.txt`
    mkdirSync(join(dir, 'src', long, '..'), { recursive: true })
    writeFileSync(join(dir, 'src', 'a.txt'), 'alpha')
    writeFileSync(join(dir, 'src', long), 'omega')
    const r = spawnSync('tar', ['--format', 'pax', '-cf', join(dir, 'x.tar'), 'a.txt', long], { cwd: join(dir, 'src') })
    expect(r.status).toBe(0)
    const files = readTar(new Uint8Array(readFileSync(join(dir, 'x.tar'))))
    expect(new TextDecoder().decode(files.get('a.txt'))).toBe('alpha')
    expect(new TextDecoder().decode(files.get(long))).toBe('omega')
  })
})

// A fake Cloudflare: answers the token check, and the plan as `plan` says.
function fakeApi(plan: string): { url: string; stop: () => void } {
  const server = Bun.serve({
    port: 0,
    fetch: (req) => {
      const path = new URL(req.url).pathname
      if (path.endsWith('/tokens/verify')) return Response.json({ success: true, result: { status: 'active' } })
      if (path.endsWith('/subscriptions')) return Response.json({ success: true, result: [{ rate_plan: { id: plan } }] })
      return Response.json({ success: false, errors: [{ code: 1, message: `unexpected ${path}` }] }, { status: 404 })
    },
  })
  return { url: `http://127.0.0.1:${server.port}`, stop: () => server.stop(true) }
}

const manifest: Manifest = {
  format: 'quireink-cf/1', version: '9.9.9', main: 'worker/worker.js', compatibilityDate: '2026-09-30',
  compatibilityFlags: ['nodejs_compat'], durableObjects: [{ binding: 'BLOG', className: 'Blog' }],
  bindings: { r2: 'BLOBS', assets: 'ASSETS', images: 'IMAGES' },
  files: [{ path: 'worker/worker.js', bytes: 2, sha256: '0'.repeat(64) }],
}
const base = { token: 't', accountId: 'a', scriptName: 'quireink-test', bucket: 'b', manifest }

describe('installOnCloudflare', () => {
  it('refuses a Workers Free account, even when told it is paid', async () => {
    const api = fakeApi('free')
    try {
      await expect(installOnCloudflare({ ...base, files: new Map(), confirmedPaid: true, apiBase: api.url })).rejects.toThrow('Workers Free')
    } finally { api.stop() }
  })

  it('refuses a package whose file does not match its manifest, before changing anything', async () => {
    const api = fakeApi('workers_paid')
    try {
      const files = new Map([['worker/worker.js', new TextEncoder().encode('{}')]])
      await expect(installOnCloudflare({ ...base, files, apiBase: api.url })).rejects.toThrow('does not match the manifest')
    } finally { api.stop() }
  })
})
