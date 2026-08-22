// The update check has four rules that are invisible when broken, and every one of them
// turns into a wrong number rather than into an error anybody sees:
//
//   1. one call a day, however many readers arrive in the same millisecond;
//   2. a call that did not arrive gives the day back, and says nothing in the log;
//   3. `new=1` is spent the moment the request lands, not when the answer parses;
//   4. nothing runs at all outside production, so a developer's afternoon is not an install.
//
// A wrong number looks exactly like a right one, so these are the tests standing in for the
// person who would otherwise notice.

import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one } from '@/store/query'
import { saveSettings } from '@/content/settings'
import { resetSecretCache, serverSecret } from '@/auth/secret'
import {
  dailyToken, dayKey, isNewer, isPublicAddress, maybeRunUpdateCheck, parseRelease,
  resetUpdateCheck, runUpdateCheck, spreadMinutes, updateCheckStatus, updateState,
} from '@/server/update-check'
import { countsAsReader } from '@/web/update-ping'

const DIR = './.tmp/test-update-check'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const NOON = Date.parse('2026-08-22T12:00:00Z')
const SECRET = 'test-secret'
const ANSWER = { latest: '2.9.9', url: 'https://github.com/joiha-steven/quireink/releases/tag/v2.9.9', date: '2026-08-22' }

const realFetch = globalThis.fetch
const lastRow = () => one<{ last_day: string | null; first_done: number; latest: string | null }>(
  `select last_day, first_done, latest from update_check where id = 1`)

/** Stand in for the network. Returns the URLs it was asked for, which is the only thing
    about this feature anybody outside the process can observe. */
function stubFetch(reply: () => Response | Promise<Response>): { calls: string[] } {
  const calls: string[] = []
  globalThis.fetch = mock(async (input: Parameters<typeof fetch>[0]) => {
    calls.push(String(input))
    return await reply()
  }) as unknown as typeof fetch
  return { calls }
}

const ok = (body: unknown = ANSWER) =>
  () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  db().run(`delete from update_check`)
  db().run(`delete from settings`)
  db().run(`delete from server_secrets`)
  resetSecretCache()
  resetUpdateCheck()
  globalThis.fetch = realFetch
})

describe('the pure parts', () => {
  it('keys the day in UTC, because the receiving end does', () => {
    // 23:30 in Hanoi is already tomorrow in UTC, and the log on the other side would file
    // it under tomorrow. A local-time key would have the two ends disagreeing by a day.
    expect(dayKey(Date.parse('2026-08-22T16:30:00Z'))).toBe('2026-08-22')
    expect(dayKey(Date.parse('2026-08-22T23:59:59Z'))).toBe('2026-08-22')
    expect(dayKey(Date.parse('2026-08-23T00:00:00Z'))).toBe('2026-08-23')
  })

  it('gives a stable 12-hex token today and an unrelated one tomorrow', () => {
    const today = dailyToken(SECRET, '2026-08-22')
    expect(today).toMatch(/^[0-9a-f]{12}$/)
    expect(dailyToken(SECRET, '2026-08-22')).toBe(today)
    expect(dailyToken(SECRET, '2026-08-23')).not.toBe(today)
    // Two blogs on one machine are two counts, which is the entire reason this is not an IP.
    expect(dailyToken('another-secret', '2026-08-22')).not.toBe(today)
  })

  it('spreads instances across an hour and no further', () => {
    for (const s of ['a', 'b', 'c', SECRET, 'x'.repeat(64)]) {
      const m = spreadMinutes(s)
      expect(m).toBeGreaterThanOrEqual(0)
      expect(m).toBeLessThan(60)
    }
    expect(spreadMinutes(SECRET)).toBe(spreadMinutes(SECRET))
  })

  it('calls only a reachable address public', () => {
    expect(isPublicAddress('https://quireink.com')).toBe(true)
    expect(isPublicAddress('https://blog.example.co.uk/')).toBe(true)
    // Everything a trial actually looks like.
    expect(isPublicAddress('')).toBe(false)
    expect(isPublicAddress('http://localhost:3000')).toBe(false)
    expect(isPublicAddress('http://quire.localhost')).toBe(false)
    expect(isPublicAddress('http://127.0.0.1:3000')).toBe(false)
    expect(isPublicAddress('http://192.168.1.40')).toBe(false)
    expect(isPublicAddress('http://[::1]:3000')).toBe(false)
    expect(isPublicAddress('http://nas.local')).toBe(false)
    expect(isPublicAddress('http://blog.internal')).toBe(false)
    expect(isPublicAddress('http://myserver')).toBe(false)
    expect(isPublicAddress('not a url')).toBe(false)
  })

  it('compares versions as numbers, so 2.1.10 is newer than 2.1.9', () => {
    expect(isNewer('2.1.10', '2.1.9')).toBe(true)
    expect(isNewer('3.0.0', '2.9.9')).toBe(true)
    expect(isNewer('2.1.3', '2.1.3')).toBe(false)
    expect(isNewer('2.1.2', '2.1.3')).toBe(false)
    expect(isNewer('nonsense', '2.1.3')).toBe(false)
  })

  it('keeps only an answer shaped like a release', () => {
    expect(parseRelease(ANSWER)).toEqual(ANSWER)
    expect(parseRelease(null)).toBeNull()
    expect(parseRelease('<html>a captive portal</html>')).toBeNull()
    expect(parseRelease({ ...ANSWER, latest: 'latest' })).toBeNull()
    expect(parseRelease({ ...ANSWER, date: 'yesterday' })).toBeNull()
    // A link the owner is invited to click is a decision, not a formality.
    expect(parseRelease({ ...ANSWER, url: 'https://evil.example/x' })).toBeNull()
  })
})

describe('the call', () => {
  it('sends the agreed four fields, and new=1 only the first time', async () => {
    const { calls } = stubFetch(ok())
    await runUpdateCheck(SECRET, NOON)
    expect(calls).toHaveLength(1)
    const url = new URL(calls[0]!)
    expect(url.origin + url.pathname).toBe('https://check.quireink.com/releases.json')
    expect(url.searchParams.get('t')).toBe(dailyToken(SECRET, '2026-08-22'))
    expect(url.searchParams.get('v')).toMatch(/^\d+\.\d+\.\d+$/)
    // No site address is set in this database, so this instance is a trial.
    expect(url.searchParams.get('d')).toBe('0')
    expect(url.searchParams.get('new')).toBe('1')
    // ...and nothing else. A field added here is a field the receiving end never agreed to.
    expect([...url.searchParams.keys()].sort()).toEqual(['d', 'new', 't', 'v'])

    await runUpdateCheck(SECRET, NOON + 86_400_000)
    expect(new URL(calls[1]!).searchParams.get('new')).toBeNull()
  })

  it('says d=1 once the blog has a public address', async () => {
    await saveSettings({ siteUrl: 'https://quireink.com' })
    const { calls } = stubFetch(ok())
    await runUpdateCheck(SECRET, NOON)
    expect(new URL(calls[0]!).searchParams.get('d')).toBe('1')
  })

  it('takes the day once, however many readers arrive at once', async () => {
    const { calls } = stubFetch(ok())
    // Not sequential awaits: the failure this guards is two requests in the same tick both
    // reading yesterday and both sending, which sequential calls could never reproduce.
    await Promise.all(Array.from({ length: 8 }, () => runUpdateCheck(SECRET, NOON)))
    expect(calls).toHaveLength(1)
    expect(lastRow()?.last_day).toBe('2026-08-22')

    await runUpdateCheck(SECRET, NOON + 3_600_000) // later the same day
    expect(calls).toHaveLength(1)
    await runUpdateCheck(SECRET, NOON + 86_400_000) // tomorrow
    expect(calls).toHaveLength(2)
  })

  it('gives the day back when the call does not arrive, and logs nothing', async () => {
    const errors: unknown[] = []
    const realError = console.error
    console.error = (...args: unknown[]) => { errors.push(args) }
    globalThis.fetch = mock(async () => { throw new Error('ENOTFOUND') }) as unknown as typeof fetch
    try {
      await runUpdateCheck(SECRET, NOON)
    } finally {
      console.error = realError
    }
    // The day is not spent, so a restart may try again — a blog whose network does not allow
    // outbound requests is not a blog that has used up its turn.
    expect(lastRow()?.last_day).toBeNull()
    // And `new=1` is NOT spent either: nothing arrived, so nothing counted it.
    expect(lastRow()?.first_done).toBe(0)
    // Silence is the feature. A daily error line would tell an offline owner their blog is broken.
    expect(errors).toEqual([])
  })

  it('spends new=1 the moment the request lands, even if the answer is rubbish', async () => {
    // The receiving end is an nginx log line written before the response. The request was
    // counted; if `first_done` waited for a parse, tomorrow would send `new=1` again and one
    // install would land in the numbers as two.
    const { calls } = stubFetch(() => new Response('<html>gateway error</html>', { status: 502 }))
    await runUpdateCheck(SECRET, NOON)
    expect(lastRow()?.first_done).toBe(1)
    expect(lastRow()?.latest).toBeNull()

    globalThis.fetch = mock(async (input: Parameters<typeof fetch>[0]) => {
      calls.push(String(input))
      return ok()()
    }) as unknown as typeof fetch
    await runUpdateCheck(SECRET, NOON + 86_400_000)
    expect(new URL(calls[1]!).searchParams.get('new')).toBeNull()
  })

  it('tells the admin behind, current or unknown — and never guesses current', async () => {
    // Nothing has been asked yet. NOT "current": the dot a person acts on by doing nothing
    // is the one that must never be drawn from an absence of information.
    expect(updateState(NOON)).toEqual({ state: 'unknown' })

    stubFetch(ok())
    await runUpdateCheck(SECRET, NOON)
    expect(updateState(NOON)).toEqual({ state: 'behind', release: ANSWER })

    db().run(`delete from update_check`)
    resetUpdateCheck()
    stubFetch(ok({ ...ANSWER, latest: '0.0.1' }))
    await runUpdateCheck(SECRET, NOON)
    expect(updateState(NOON)).toEqual({ state: 'current' })

    // ...and an answer from over a week ago cannot say "up to date" any more: a release may
    // have happened since, and this blog either had no readers or could not reach out.
    expect(updateState(NOON + 8 * 86_400_000)).toEqual({ state: 'unknown' })
    expect(updateState(NOON + 6 * 86_400_000)).toEqual({ state: 'current' })
  })

  it('does nothing at all when the owner turns it off', async () => {
    await saveSettings({ updateCheck: false })
    const { calls } = stubFetch(ok())
    await runUpdateCheck(SECRET, NOON)
    expect(calls).toEqual([])
    expect(lastRow()).toBeNull()
  })

  it('never throws, even with the table gone', async () => {
    db().run(`drop table update_check`)
    stubFetch(ok())
    expect(await runUpdateCheck(SECRET, NOON)).toBeUndefined()
    db().run(`create table if not exists update_check (
      id integer primary key check (id = 1), last_day text, first_done integer not null default 0,
      latest text, latest_url text, latest_date text, checked_at integer)`)
  })
})

describe('what triggers it', () => {
  const withEnv = async (env: Record<string, string | undefined>, body: () => void) => {
    const before = { NODE_ENV: process.env.NODE_ENV, UPDATE_CHECK: process.env.UPDATE_CHECK }
    Object.assign(process.env, env)
    resetUpdateCheck()
    try { body() } finally {
      process.env.NODE_ENV = before.NODE_ENV
      process.env.UPDATE_CHECK = before.UPDATE_CHECK
      resetUpdateCheck()
    }
  }

  it('stays silent while somebody is working on the software', async () => {
    const { calls } = stubFetch(ok())
    for (const env of ['test', 'development', 'dev', 'ci', 'TEST']) {
      await withEnv({ NODE_ENV: env }, () => {
        maybeRunUpdateCheck(NOON)
        expect(updateCheckStatus().blockedBy).toBe(`NODE_ENV=${env.toLowerCase()}`)
      })
    }
    expect(calls).toEqual([])
  })

  it('stays silent under --watch, which is what `bun run dev` is', async () => {
    // The ONE signal separating `bun run dev` from a systemd install: both leave NODE_ENV
    // empty, and only one of them is somebody editing the files underneath. Measured on Bun
    // 1.3.14 — `bun --watch x.ts` puts '--watch' in execArgv, `bun x.ts` leaves it empty.
    const realArgv = process.execArgv
    const { calls } = stubFetch(ok())
    try {
      process.execArgv = ['--watch']
      await withEnv({ NODE_ENV: undefined, UPDATE_CHECK: undefined }, () => {
        maybeRunUpdateCheck(NOON)
        expect(updateCheckStatus().blockedBy).toBe('--watch')
      })
      process.execArgv = ['--hot']
      await withEnv({ NODE_ENV: undefined, UPDATE_CHECK: undefined }, () => {
        expect(updateCheckStatus().blockedBy).toBe('--hot')
      })
    } finally {
      process.execArgv = realArgv
    }
    expect(calls).toEqual([])
  })

  it('REPORTS from a plain `bun src/index.ts`, which is the systemd install', async () => {
    // The whole point of the 2026-08-22 inversion. The unit in docs/self-host.md sets no
    // NODE_ENV, so under the old rule every from-source install was silent forever while
    // looking perfectly healthy — and nothing on any screen said so.
    await withEnv({ NODE_ENV: undefined, UPDATE_CHECK: undefined }, () => {
      expect(updateCheckStatus().blockedBy).toBeNull()
    })
    await withEnv({ NODE_ENV: 'production', UPDATE_CHECK: undefined }, () => {
      expect(updateCheckStatus().blockedBy).toBeNull()
    })
  })

  it('stays silent when the operator sets UPDATE_CHECK=0, whatever else is true', async () => {
    const { calls } = stubFetch(ok())
    await withEnv({ NODE_ENV: 'production', UPDATE_CHECK: '0' }, () => {
      maybeRunUpdateCheck(NOON)
      // The variable actually in the way, not merely "off". The causes have different fixes,
      // and a screenshot on 2026-08-22 caught the admin printing the wrong one.
      expect(updateCheckStatus().blockedBy).toBe('UPDATE_CHECK=0')
    })
    expect(calls).toEqual([])
  })

  it('waits for this instance\'s own minute of the day before it fires', async () => {
    const { calls } = stubFetch(ok())
    // A FIXED secret, planted before `serverSecret` generates one. Its offset is 24 minutes;
    // a generated secret would give a random one, and one run in sixty would draw 0 and turn
    // the first assertion below into a test that passes by accident.
    db().run(`insert or replace into server_secrets (name, value) values ('update-check', 'fixed-spread-secret')`)
    resetSecretCache()
    await withEnv({ NODE_ENV: 'production', UPDATE_CHECK: undefined }, () => {
      const offset = spreadMinutes(serverSecret('update-check'))
      expect(offset).toBe(24)
      const midnight = Date.parse('2026-08-22T00:00:00Z')
      // A busy blog has a reader at 00:00:00 every day; so does every other busy blog, and
      // they must not all arrive at once.
      maybeRunUpdateCheck(midnight)
      expect(calls).toEqual([])
      maybeRunUpdateCheck(midnight + (offset + 1) * 60_000)
    })
    // Started, not awaited: the reader's response went out without it.
    await Bun.sleep(0)
    expect(calls).toHaveLength(1)
  })

  it('counts a reader and not the owner, a beacon or a favicon', () => {
    expect(countsAsReader('GET', '/')).toBe(true)
    expect(countsAsReader('GET', '/hello-world')).toBe(true)
    expect(countsAsReader('GET', '/category/notes/page/2')).toBe(true)
    // The owner opening their dashboard every morning would otherwise report a blog that
    // has no readers at all as one that is being used.
    expect(countsAsReader('GET', '/admin')).toBe(false)
    expect(countsAsReader('GET', '/admin/settings')).toBe(false)
    expect(countsAsReader('POST', '/api/track')).toBe(false)
    expect(countsAsReader('GET', '/api/search')).toBe(false)
    expect(countsAsReader('GET', '/login')).toBe(false)
    expect(countsAsReader('GET', '/preview/draft-post')).toBe(false)
    // Files arrive WITH a page, so they count nothing new — and a bookmarked favicon would
    // count a reader who is not there.
    expect(countsAsReader('GET', '/favicon.ico')).toBe(false)
    expect(countsAsReader('GET', '/assets/core.a1b2c3.js')).toBe(false)
    expect(countsAsReader('GET', '/uploads/2026/photo.avif')).toBe(false)
    expect(countsAsReader('GET', '/feed.xml')).toBe(false)
    expect(countsAsReader('POST', '/')).toBe(false)
  })
})
