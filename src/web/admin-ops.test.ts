// The cron tick, the health probe, the preview link and the WordPress import.
//
// The bearer check is the one worth the most attention: `/api/cron` is reachable without a
// session, so the secret is the only thing between an external caller and a maintenance
// run.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { verifyPreview } from '@/content/preview'
import { payload } from '@/test/api'

const DIR = './.tmp/test-admin-ops'
const SNAPSHOTS = `${DIR}-snapshots`
const UPLOADS = `${DIR}-uploads`
freshDatabase(DIR)
// Its own directory, so a snapshot taken here is never the real one on a dev machine.
process.env.BACKUP_DIR = SNAPSHOTS
// And its own upload store, CREATED. `/api/health` checks that the store is writable, so
// these tests were passing on the accident that every developer machine has an ./uploads
// left over from running the app; on a clean checkout the probe answered 503 and two tests
// failed for a reason that had nothing to do with what they test.
process.env.STORAGE_LOCAL_DIR = UPLOADS
mkdirSync(UPLOADS, { recursive: true })

afterAll(() => {
  dropDatabase(DIR)
  delete process.env.CRON_SECRET
  delete process.env.BACKUP_DIR
  delete process.env.STORAGE_LOCAL_DIR
  for (const d of [SNAPSHOTS, UPLOADS]) {
    try { rmSync(d, { recursive: true, force: true }) } catch { /* ignore */ }
  }
})

/** What the backup routes answer with. Narrow, because only these fields are read here. */
type ApiShape = {
  data: {
    snapshots: { name: string; size: number; createdAt: string }[]
    lastRunAt: string | null
    snapshot?: { name: string }
  }
}

const app = createApp()
let cookie = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'posts', 'pages', 'post_terms', 'activity_log', 'settings', 'server_secrets']) {
    db().run(`delete from ${t}`)
  }
  delete process.env.CRON_SECRET
  rmSync(SNAPSHOTS, { recursive: true, force: true })
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

const asOwner = (path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: { cookie, 'sec-fetch-site': 'same-origin', ...(init.headers as Record<string, string> ?? {}) },
  })

describe('the gate', () => {
  it('refuses the owner-only ops routes without a session', async () => {
    expect((await app.request('/api/preview-link?slug=x')).status).toBe(401)
    const res = await app.request('/api/import/wordpress', {
      method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, body: new FormData(),
    })
    expect(res.status).toBe(401)
  })

  // ...and does NOT gate the two an external caller reaches. A probe that had to hold a
  // session would be a worse probe, and a scheduler cannot sign in at all.
  it('leaves cron and health reachable', async () => {
    expect((await app.request('/api/health')).status).toBe(200)
    expect((await app.request('/api/cron')).status).toBe(200)
  })
})

describe('the cron tick', () => {
  it('is open when no secret is set, so a fresh install still ticks', async () => {
    const res = await app.request('/api/cron')
    expect(res.status).toBe(200)
    expect((await payload<{ alive: boolean }>(res)).alive).toBe(true)
  })

  it('demands the bearer token once a secret is set', async () => {
    process.env.CRON_SECRET = 'a-long-shared-secret'
    expect((await app.request('/api/cron')).status).toBe(401)
    expect((await app.request('/api/cron', { headers: { authorization: 'Bearer wrong' } })).status).toBe(401)
    const ok = await app.request('/api/cron', { headers: { authorization: 'Bearer a-long-shared-secret' } })
    expect(ok.status).toBe(200)
  })

  // `timingSafeEqual` throws on a length mismatch, so a wrong-length header must be
  // rejected rather than becoming a 500.
  it('rejects a header of the wrong length without throwing', async () => {
    process.env.CRON_SECRET = 'a-long-shared-secret'
    for (const authorization of ['', 'Bearer', 'Bearer x', `Bearer ${'x'.repeat(200)}`]) {
      expect((await app.request('/api/cron', { headers: { authorization } })).status).toBe(401)
    }
  })

  /**
   * A scheduled post is a PUBLISHED one with a future date — there is no `scheduled`
   * status. It goes live when its date crosses now, which is what the sweep detects, so
   * the fixture is a published post dated a minute ago and the window is six.
   */
  it('reports a post that just crossed into live', async () => {
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    await asOwner('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Timed', status: 'published', date: oneMinuteAgo, content: 'x' }),
    })
    const res = await app.request('/api/cron?publish=1')
    expect((await payload<{ published: number }>(res)).published).toBe(1)
    // Invariant 1: on the home page without a cold hit.
    expect(await (await app.request('/')).text()).toContain('Timed')
  })

  it('reports nothing when a post is dated outside the window', async () => {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    await asOwner('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Old news', status: 'published', date: lastWeek, content: 'x' }),
    })
    const res = await app.request('/api/cron?publish=1')
    expect((await payload<{ published: number }>(res)).published).toBe(0)
  })

  it('reports the session purge it now also does', async () => {
    const res = await app.request('/api/cron')
    const body = await payload<{ sessions: number; finalized: number }>(res)
    expect(typeof body.sessions).toBe('number')
    expect(typeof body.finalized).toBe('number')
  })
})

describe('the health probe', () => {
  it('reports both checks and never caches', async () => {
    const res = await app.request('/api/health')
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await payload<{ status: string; checks: { database: boolean; storage: boolean } }>(res)
    expect(body.status).toBe('ok')
    expect(body.checks.database).toBe(true)
  })

  // 503 when degraded, so a load balancer takes the instance out of rotation. A 200 with
  // `status: degraded` in the body would be read by nothing.
  it('returns 503 when the storage directory is not writable', async () => {
    const previous = process.env.STORAGE_LOCAL_DIR
    process.env.STORAGE_LOCAL_DIR = './this-directory-does-not-exist-at-all'
    const res = await app.request('/api/health')
    expect(res.status).toBe(503)
    expect((await payload<{ status: string }>(res)).status).toBe('degraded')
    if (previous === undefined) delete process.env.STORAGE_LOCAL_DIR
    else process.env.STORAGE_LOCAL_DIR = previous
  })
})

describe('the preview link', () => {
  it('returns a token the preview route accepts', async () => {
    const res = await asOwner('/api/preview-link?slug=a-draft')
    expect(res.status).toBe(200)
    const { token } = await payload<{ token: string }>(res)
    expect(verifyPreview('a-draft', token)).toBe(true)
    // Bound to the slug it was issued for, so sharing one draft does not share them all.
    expect(verifyPreview('another-draft', token)).toBe(false)
  })

  it('requires a slug', async () => {
    expect((await asOwner('/api/preview-link')).status).toBe(400)
  })
})

describe('the WordPress import', () => {
  const wxr = (items: string) => `<?xml version="1.0"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/">
<channel>${items}</channel></rss>`

  const item = (title: string, type = 'post', slug = '') => `
<item>
  <title>${title}</title>
  <wp:post_name>${slug}</wp:post_name>
  <wp:post_type>${type}</wp:post_type>
  <wp:status>publish</wp:status>
  <content:encoded><![CDATA[<p>Body of <strong>${title}</strong>.</p>]]></content:encoded>
</item>`

  const send = (xml: string, name = 'export.xml') => {
    const form = new FormData()
    form.append('file', new File([xml], name, { type: 'text/xml' }), name)
    return asOwner('/api/import/wordpress', { method: 'POST', body: form })
  }

  it('imports posts and pages and converts the HTML to markdown', async () => {
    const res = await send(wxr(item('First Post') + item('About', 'page')))
    expect(res.status).toBe(200)
    const result = await payload<{ posts: number; pages: number }>(res)
    expect(result.posts).toBe(1)
    expect(result.pages).toBe(1)

    const list = await payload<Array<{ slug: string }>>(asOwner('/api/posts'))
    const full = await payload<{ content: string }>(asOwner(`/api/posts/${list[0].slug}`))
    expect(full.content).toContain('**First Post**')
    expect(full.content).not.toContain('<strong>')
  })

  /**
   * Nothing is ever overwritten: an import ADDS. Posts and pages share one namespace
   * (Invariant 2), so the suffix has to be found against both.
   */
  it('suffixes a slug that already exists rather than overwriting', async () => {
    await send(wxr(item('Same Title')))
    await send(wxr(item('Same Title')))
    const list = await payload<Array<{ slug: string }>>(asOwner('/api/posts'))
    expect(list.length).toBe(2)
    expect(new Set(list.map((p) => p.slug)).size).toBe(2)
  })

  it('rejects a file that is not a WordPress export, with a specific message', async () => {
    const res = await send('<html><body>not an export</body></html>')
    expect(res.status).toBe(400)
    // "import failed" on the wrong file is the least useful thing to say to someone.
    expect(await res.json()).toEqual({ success: false, error: 'not_a_wordpress_export' })
  })

  it('rejects a request with no file', async () => {
    const res = await asOwner('/api/import/wordpress', { method: 'POST', body: new FormData() })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ success: false, error: 'no_file' })
  })
})

describe('the manual archive', () => {
  // The copy the owner takes away, as opposed to the snapshots the server keeps (those are
  // covered in server/backup.test.ts). Worth proving it is a real archive with the real
  // files in it, not an empty tarball.
  it('builds a gzip archive holding both databases', async () => {
    const res = await asOwner('/api/backup/export')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/gzip')
    expect(res.headers.get('content-disposition'))
      .toMatch(/attachment; filename="quire-\d{4}-\d{2}-\d{2}T\d{4}\.tar\.gz"/)

    const bytes = new Uint8Array(await res.arrayBuffer())
    // The gzip magic number. A zero-length or error body would not carry it.
    expect(bytes[0]).toBe(0x1f)
    expect(bytes[1]).toBe(0x8b)

    // And it really contains the databases: list the archive rather than trust its size.
    const listed = Bun.spawnSync(['tar', '-tzf', '-'], { stdin: bytes, stdout: 'pipe' })
    const names = new TextDecoder().decode(listed.stdout)
    expect(names).toContain('quire.db')
    expect(names).toContain('analytics.db')
  })

  // It is built into a temp directory on purpose: leaving it in the snapshots directory
  // would make every download the owner takes count towards the retention limit and push a
  // scheduled snapshot out.
  it('does not leave itself among the kept snapshots', async () => {
    expect((await (await asOwner('/api/backup/list')).json() as ApiShape).data.snapshots)
      .toHaveLength(0)
    await asOwner('/api/backup/export')
    expect((await (await asOwner('/api/backup/list')).json() as ApiShape).data.snapshots)
      .toHaveLength(0)
  })

  it('every backup route is owner-gated', async () => {
    for (const path of ['/api/backup/export', '/api/backup/list', '/api/backup/download?name=x']) {
      expect((await app.request(path)).status).toBe(401)
    }
    // 403 rather than 401 on the writes: the gate checks the origin BEFORE the session, so
    // a request that can prove neither is refused as cross-site. Signing in would not help.
    for (const path of ['/api/backup/run', '/api/backup/delete']) {
      expect((await app.request(path, { method: 'POST' })).status).toBe(403)
    }
  })
})

describe('snapshots kept on the server', () => {
  it('takes one, lists it, downloads it, then deletes it', async () => {
    const run = await (await asOwner('/api/backup/run', { method: 'POST' })).json() as ApiShape
    const name = run.data.snapshot!.name

    const listed = await (await asOwner('/api/backup/list')).json() as ApiShape
    expect(listed.data.snapshots.map((s) => s.name)).toEqual([name])
    expect(listed.data.lastRunAt).not.toBeNull()

    const file = await asOwner(`/api/backup/download?name=${encodeURIComponent(name)}`)
    expect(file.status).toBe(200)
    const bytes = new Uint8Array(await file.arrayBuffer())
    expect(bytes[0]).toBe(0x1f) // gzip, so it is the archive and not an error page
    expect(bytes[1]).toBe(0x8b)

    const gone = await asOwner('/api/backup/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    expect(gone.status).toBe(200)
    expect((await (await asOwner('/api/backup/list')).json() as ApiShape).data.snapshots)
      .toHaveLength(0)
  })

  // The name arrives in a query string and in a JSON body. Both are a path if nothing
  // stops them being one.
  it('refuses a name that is a path, on download and on delete', async () => {
    for (const bad of ['../../package.json', '/etc/passwd', 'notes.txt', '']) {
      const read = await asOwner(`/api/backup/download?name=${encodeURIComponent(bad)}`)
      expect(read.status).toBe(400)
      const remove = await asOwner('/api/backup/delete', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: bad }),
      })
      expect(remove.status).toBe(400)
    }
    // The file the traversal was aiming at is still there.
    expect(await Bun.file('package.json').exists()).toBe(true)
  })

  it('404s a well-formed name that is not on disk', async () => {
    expect((await asOwner('/api/backup/download?name=quire-2020-01-01T0000.tar.gz')).status)
      .toBe(404)
  })
})
