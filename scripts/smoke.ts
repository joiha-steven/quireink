// Is this install serving the release it should, the way it should? (ADR 0065)
//
//   bun scripts/smoke.ts <url>
//
// The same check for every package and every place, so an install test is one command whatever
// put the blog there:
//
//   1. `/api/health` answers `ok`, with the version and the package expected of it;
//   2. a blog nobody has claimed yet: `/setup` answers, and when `SETUP_CODE` is set it takes that
//      code and refuses another — the claim itself is left alone, because it is a one-way door;
//   3. a blog with an owner (`QUIRE_SESSION`): the twelve smoke flows of the tour, then
//      `restore-check` on a backup taken from it.
//
// Env: EXPECT_VERSION, EXPECT_PACKAGE, SETUP_CODE, QUIRE_SESSION, and DATA_DIR / STORAGE_LOCAL_DIR
// as the instance was started with (restore-check compares against its files).
import { spawnSync } from 'node:child_process'

const BASE = (process.argv[2] ?? '').replace(/\/+$/, '')
if (!BASE) {
  console.error('usage: bun scripts/smoke.ts <url>')
  process.exit(2)
}
const failures: string[] = []
const ok = (text: string) => console.log(`  ✓ ${text}`)
const bad = (text: string) => { console.log(`  ✗ ${text}`); failures.push(text) }

async function health(): Promise<{ status?: string; version?: string; package?: string } | null> {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) return (await res.json()) as { status?: string; version?: string; package?: string }
    } catch {
      // Still booting.
    }
    await Bun.sleep(1000)
  }
  return null
}

console.log(`smoke: ${BASE}`)
const h = await health()
if (!h) bad('/api/health never answered 200 within 90 s')
else {
  if (h.status === 'ok') ok('/api/health ok')
  else bad(`/api/health status ${h.status}`)
  const wantV = process.env.EXPECT_VERSION
  if (wantV) (h.version === wantV ? ok : bad)(`version ${h.version}${h.version === wantV ? '' : `, expected ${wantV}`}`)
  const wantP = process.env.EXPECT_PACKAGE
  if (wantP) (h.package === wantP ? ok : bad)(`package ${h.package}${h.package === wantP ? '' : `, expected ${wantP}`}`)
}

const session = process.env.QUIRE_SESSION ?? ''
if (h && !session) {
  const status = async (path: string) => (await fetch(`${BASE}${path}`, { redirect: 'manual' })).status
  const open = await status('/setup')
  ;(open === 200 ? ok : bad)(`/setup answers ${open} on an unclaimed blog`)
  const code = process.env.SETUP_CODE ?? ''
  if (code) {
    const right = await status(`/setup?token=${encodeURIComponent(code)}`)
    ;(right === 200 ? ok : bad)(`/setup takes the SETUP_CODE (${right})`)
    const wrong = await status(`/setup?token=${encodeURIComponent(`${code}-not-it`)}`)
    ;(wrong === 403 ? ok : bad)(`/setup refuses another code (${wrong})`)
  }
}

if (h && session) {
  const run = (args: string[], env: Record<string, string> = {}) =>
    spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...env } }).status === 0
  ;(run(['scripts/tour.ts', BASE], { SMOKE: '1' }) ? ok : bad)('the twelve smoke flows')
  ;(run(['scripts/restore-check.ts', BASE]) ? ok : bad)('restore-check on a backup taken from it')
}

if (failures.length) {
  console.log(`\nsmoke: ${failures.length} failed`)
  process.exit(1)
}
console.log('\nsmoke: ok')
