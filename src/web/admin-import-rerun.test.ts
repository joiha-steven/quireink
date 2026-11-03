// An import run again, after the first one stopped part-way. Split from admin-import.test.ts,
// which sits at the file-size cap; the setup is the same: an app, a database of its own, an owner.
//
// The run saves each item and THEN writes the 301 from its old path, two writes with nothing
// holding them together. A process that died between the two left the post with no redirect, and
// running the file again found the post already here and moved on before the redirect, so that
// one old address stayed a 404 for good (2026-11-03).
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/test/sqlite'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { saveRedirect } from '@/server/redirects'
import { payload } from '@/test/api'

const DIR = './.tmp/test-admin-import-rerun'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
let cookie = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'posts', 'pages', 'post_terms', 'activity_log', 'settings', 'server_secrets', 'redirects']) {
    db().run(`delete from ${t}`)
  }
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

const wxr = (items: string) => `<?xml version="1.0"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>${items}</channel></rss>`

const item = (title: string, slug: string, type = 'post') => `
<item>
  <title>${title}</title>
  <link>https://old.example/2020/05/${slug}/</link>
  <wp:post_name>${slug}</wp:post_name>
  <wp:post_type>${type}</wp:post_type>
  <wp:status>publish</wp:status>
  <wp:post_date_gmt>2020-05-01 10:00:00</wp:post_date_gmt>
  <content:encoded><![CDATA[<p>Body of ${title}.</p>]]></content:encoded>
</item>`

const send = (xml: string) => {
  const form = new FormData()
  form.append('file', new File([xml], 'export.xml', { type: 'text/xml' }), 'export.xml')
  return app.request('/api/import/wordpress', {
    method: 'POST', body: form, headers: { cookie, 'sec-fetch-site': 'same-origin' },
  })
}

type Report = { posts: number; pages: number; already: number; redirects: number }
const located = async (path: string) => {
  const res = await app.request(path)
  return `${path} ${res.status} ${res.headers.get('location') ?? '-'}`
}

describe('an import run again after it stopped between an item and its redirect', () => {
  it('writes the redirect the first run never reached, for a post and for a page', async () => {
    const file = wxr(item('Hello', 'hello') + item('About', 'about', 'page'))
    expect(await payload<Report>(await send(file))).toMatchObject({ posts: 1, pages: 1, redirects: 2 })
    // The state a process dying after `savePost` leaves: the item here, its 301 not.
    db().run(`delete from redirects`)

    expect(await payload<Report>(await send(file))).toMatchObject({ posts: 0, pages: 0, already: 2, redirects: 2 })
    expect(await located('/2020/05/hello/')).toBe('/2020/05/hello/ 301 /hello')
    expect(await located('/2020/05/about/')).toBe('/2020/05/about/ 301 /about')
  })

  it('counts nothing and changes nothing when every redirect is already there', async () => {
    const file = wxr(item('Hello', 'hello'))
    await send(file)
    expect(await payload<Report>(await send(file))).toMatchObject({ posts: 0, already: 1, redirects: 0 })
  })

  // An import is not asked, so it does not win over a rule the owner made at that path since.
  it('leaves a redirect the owner put on the old path alone', async () => {
    const file = wxr(item('Hello', 'hello'))
    await send(file)
    await saveRedirect({ source: '/2020/05/hello', destination: '/somewhere-else' })
    expect(await payload<Report>(await send(file))).toMatchObject({ already: 1, redirects: 0 })
    expect(await located('/2020/05/hello')).toBe('/2020/05/hello 301 /somewhere-else')
  })
})
