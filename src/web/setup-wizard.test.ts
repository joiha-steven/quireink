// The four questions that follow the account, driven through the real router.
//
// Split out of `setup.test.ts` when that file passed the 400-line cap. The cut is by
// SUBJECT: everything before it is about CLAIMING an install — the one write route that
// creates an owner, reachable without a session by definition, and therefore mostly a file
// about refusal. This is what happens after there IS an owner: four small settings forms,
// each protected by the router it is registered on rather than by a check inside it.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { getSettings } from '@/content/settings'
import { APP_VERSION } from '@/version'
import { resetEnrolment } from '@/web/enrol-routes'
import { resetLimits } from '@/server/rate-limit'
import { setupToken, resetSetupToken } from '@/server/setup-token'

const DIR = './.tmp/test-setup-wizard'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const PASSWORD = 'wandering violet cassette'
const app = createApp()

const post = (path: string, data: Record<string, string>) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data),
  })

const claim = (over: Record<string, string> = {}) =>
  post('/api/setup/claim', {
    token: setupToken(), username: 'owner', email: 'owner@example.com', password: PASSWORD, ...over,
  })

beforeEach(() => {
  db().exec('delete from users; delete from sessions; delete from settings')
  resetEnrolment()
  resetLimits()
  resetSetupToken()
})

describe('the four questions after the account', () => {
  const session = async (): Promise<string> => {
    const ticket = (await (await claim()).text()).match(/name="ticket" value="([^"]+)"/)?.[1] ?? ''
    const res = await post('/api/auth/enrol/skip', { ticket })
    return (res.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  }

  // `sec-fetch-site` because a real browser always sends it, and `auth/csrf.ts` insists on
  // it: a state-changing request with neither that nor an Origin is a non-browser client,
  // which has the token path and no business on a cookie-authenticated route. Leaving it off
  // here made the test 403 against code that is correct — the harness was the unrealistic
  // half, not the guard.
  const asOwner = (path: string, data?: Record<string, string>) => async (cookie: string) =>
    app.request(path, data === undefined ? { headers: { cookie } } : {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/x-www-form-urlencoded',
        'sec-fetch-site': 'same-origin',
      },
      body: new URLSearchParams(data),
    })

  it('refuses every step without a session, because they write settings', async () => {
    // Invariant 4: they are protected by the router they are registered on, not by a check
    // inside them, and this is the assertion that would notice if they moved.
    expect((await app.request('/setup/site')).status).toBe(401)
    expect((await app.request('/setup/face')).status).toBe(401)
    expect((await app.request('/setup/reader')).status).toBe(401)
    expect((await app.request('/setup/look')).status).toBe(401)
  })

  it('saves the site step and moves on to the face', async () => {
    const cookie = await session()
    const res = await asOwner('/setup/site', {
      title: 'A Quiet Press', language: 'vi', timezone: 'Asia/Ho_Chi_Minh',
      siteUrl: 'https://quiet.example',
    })(cookie)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/setup/face')
    const saved = await getSettings()
    expect(saved.title).toBe('A Quiet Press')
    expect(saved.language).toBe('vi')
    expect(saved.timezone).toBe('Asia/Ho_Chi_Minh')
    expect(saved.siteUrl).toBe('https://quiet.example')
  })

  it('saves the face and moves on to the reader', async () => {
    const res = await asOwner('/setup/face', { mode: 'front' })(await session())
    expect(res.headers.get('location')).toBe('/setup/reader')
    expect((await getSettings()).home.mode).toBe('front')
  })

  it('saves the reader\'s pen and moves on to the dialect', async () => {
    const cookie = await session()
    const off = await asOwner('/setup/reader', { pen: 'off' })(cookie)
    expect(off.headers.get('location')).toBe('/setup/look')
    expect((await getSettings()).features.readerPen).toBe(false)
    await asOwner('/setup/reader', { pen: 'on' })(cookie)
    expect((await getSettings()).features.readerPen).toBe(true)
  })

  it('saves the dialect and ends in the editor, not the dashboard', async () => {
    const res = await asOwner('/setup/look', { look: 'notes' })(await session())
    expect(res.headers.get('location')).toBe('/admin/editor')
    expect((await getSettings()).look).toBe('notes')
  })

  it('finishes the run and stamps the release on the LAST step and no earlier', async () => {
    // A setup somebody abandoned halfway is one they should be offered again, and a blog that
    // has answered the dialect question must never be asked it by the what's-new panel — so
    // both facts are written here and nowhere before.
    const cookie = await session()
    await asOwner('/setup/site', { title: 'Halfway', timezone: 'UTC', siteUrl: '' })(cookie)
    await asOwner('/setup/face', { mode: 'list' })(cookie)
    await asOwner('/setup/reader', { pen: 'on' })(cookie)
    const half = await getSettings()
    expect(half.setupDone).toBe(false)
    expect(half.seenRelease).toBe('')

    await asOwner('/setup/look', { look: 'paper' })(cookie)
    const done = await getSettings()
    expect(done.setupDone).toBe(true)
    expect(done.seenRelease).toBe(APP_VERSION)
  })

  it('keeps the dialect it had when the form carried no answer at all', async () => {
    // A browser that lost the radios must not pick a dialect nobody chose.
    const cookie = await session()
    await asOwner('/setup/look', { look: 'code' })(cookie)
    await asOwner('/setup/look', {})(cookie)
    expect((await getSettings()).look).toBe('code')
  })

  it('keeps the pen ON for a form that carried no answer at all', async () => {
    // A browser that lost the markup lands on the default, and the default is on.
    const cookie = await session()
    await asOwner('/setup/reader', { pen: 'off' })(cookie)
    await asOwner('/setup/reader', {})(cookie)
    expect((await getSettings()).features.readerPen).toBe(true)
  })

  it('reads anything that is not the newspaper as the list', async () => {
    await asOwner('/setup/face', { mode: 'nonsense' })(await session())
    expect((await getSettings()).home.mode).toBe('list')
  })

  it('offers the address of the host actually being used', async () => {
    const cookie = await session()
    // The one field, not the whole page: a `toContain` over a rendered document prints the
    // document when it fails, which buries the reason it failed.
    const field = async (r: Response) => (await r.text()).match(/id="siteUrl"[^>]*value="([^"]*)"/s)?.[1]
    expect(await field(await app.request('http://blog.example/setup/site', {
      headers: { cookie, 'x-forwarded-proto': 'https' },
    }))).toBe('https://blog.example')
    // But the OPERATOR's address outranks the host: a first run reached at a temporary one
    // must not write that over the `SITE_URL` the deployment was configured with.
    process.env.SITE_URL = 'https://configured.example'
    try {
      expect(await field(await app.request('http://10.0.0.4:3000/setup/site', { headers: { cookie } })))
        .toBe('https://configured.example')
    } finally {
      delete process.env.SITE_URL
    }
  })
})

