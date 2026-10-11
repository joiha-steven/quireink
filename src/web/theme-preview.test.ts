// Previewing a theme before choosing it (ADR 0072, T2c), through the real router: the owner gets
// the site wearing the theme with the bar, `noindex` and `private, no-store`; anybody else carrying
// the same cookie gets the reader's page with no trace of it; an id the site cannot draw is the
// reader's page; Leave ends it; nothing is logged. The caches are `theme-preview-cache.test.ts`.
import { describe, expect, it } from 'bun:test'
import { db } from '@/test/sqlite'
import { forgetInstalledTheme } from '@/content/chosen-theme'
import { clearCache } from '@/server/cache'
import { PUBLIC } from '@/web/cache-headers'
import { MANIFEST, themeZip } from '@/theme/test-zip'
import { htmlTag, sheetLink, themeBlog } from '@/test/installed-theme'
import { adminT } from '@/i18n/admin-i18n'
import { PREVIEW_COOKIE, safeReturnPath } from '@/web/theme-preview-paths'

const { app, asOwner, install, save, page, sessionCookie } = themeBlog('./.tmp/test-theme-preview')

/** A page as the owner previewing `themeId` asks for it: the session and the preview cookie. */
const previewed = async (path: string, themeId: string, session = sessionCookie()) => {
  const res = await app.request(path, { headers: { cookie: `${session}; ${PREVIEW_COOKIE}=${themeId}` } })
  return { res, html: await res.text() }
}

const BAR = 'data-theme-preview="'

/** Everything about the answer that says it is the reader's page and nothing else. */
async function expectReaderPage(path: string, res: Response, html: string): Promise<void> {
  expect(res.status).toBe(200)
  expect(htmlTag(html)).toContain(' data-theme="plain"')
  expect(html).not.toContain(BAR)
  expect(html).not.toContain('theme-preview')
  expect(html).not.toContain('noindex')
  expect(res.headers.get('cache-control')).toBe(PUBLIC)
  expect(res.headers.get('x-robots-tag')).toBeNull()
  expect(res.headers.get('vary') ?? '').not.toContain('Cookie')
  // Byte for byte the page a reader with no cookie at all is given.
  expect(html).toBe((await page(path)).html)
}

describe('entering a preview', () => {
  it('sets an owner-only cookie for an hour and sends the tab to a home page no reader is cached under', async () => {
    await install(themeZip())
    const res = await asOwner('/api/themes/broadsheet/preview')
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/?theme-preview=broadsheet')
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toStartWith(`${PREVIEW_COOKIE}=broadsheet;`)
    for (const part of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=3600']) expect(cookie).toContain(part)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('is the owner\'s alone: no session, no preview', async () => {
    await install(themeZip())
    expect((await app.request('/api/themes/broadsheet/preview')).status).toBe(401)
  })

  it('opens nothing for an id the site cannot draw, ends a preview that was open, and sends the tab to the Look card saying why', async () => {
    const refused = async (id: string, why: string) => {
      const res = await asOwner(`/api/themes/${encodeURIComponent(id)}/preview`)
      expect(res.status).toBe(303)
      expect(res.headers.get('location')).toBe(`/admin/settings?tab=appearance&preview-refused=${encodeURIComponent(id)}&why=${why}`)
      expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
    }
    await refused('nope', 'missing')
    await refused('Not-An-Id', 'missing')
    await install(themeZip())
    expect((await asOwner('/api/themes/broadsheet', { method: 'DELETE' })).status).toBe(200)
    await refused('broadsheet', 'missing')
    await install(themeZip())
    db().run(`update themes set manifest = '{not json' where theme_id = 'broadsheet'`)
    forgetInstalledTheme()
    await refused('broadsheet', 'unreadable')
  })

  it('writes nothing to the activity log', async () => {
    await install(themeZip())
    const before = (db().query('select count(*) as n from activity_log').get() as { n: number }).n
    expect((await asOwner('/api/themes/broadsheet/preview')).status).toBe(303)
    expect((await previewed('/', 'broadsheet')).res.status).toBe(200)
    expect((db().query('select count(*) as n from activity_log').get() as { n: number }).n).toBe(before)
  })
})

describe('the owner previewing', () => {
  it('draws the list, a post and the front page in the installed theme, with the bar, noindex and no-store', async () => {
    const hash = await install(themeZip())
    const check = async (path: string) => {
      const { res, html } = await previewed(path, 'broadsheet')
      expect(res.status).toBe(200)
      expect(htmlTag(html)).toContain(' data-theme="broadsheet"')
      expect(html).toContain(sheetLink(hash))
      expect(html).toContain(`${BAR}broadsheet"`)
      expect(html).toContain('Previewing <strong>Broadsheet</strong>')
      expect(html).toContain('<meta name="robots" content="noindex, nofollow">')
      // The bar is the first thing in the body, so it pushes the page down rather than covering it.
      expect(html).toMatch(/<body[^>]*>\n<div class="theme-preview"/)
      expect(res.headers.get('cache-control')).toBe('private, no-store')
      expect(res.headers.get('vary')).toContain('Cookie')
      expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
      expect(res.headers.get('speculation-rules')).toBeNull()
      return html
    }
    await check('/')
    const post = await check('/a-post')
    // Leave goes back to the page it was pressed on; Choose ends the preview on the Look card with the tile picked.
    expect(post).toContain('href="/theme-preview/leave?to=%2Fa-post"')
    expect(post).toContain(`href="/theme-preview/leave?to=${encodeURIComponent('/admin/settings?tab=appearance&pick-theme=broadsheet')}"`)
    // Never back to the entry's own URL: without the cookie that is a reader's page a shared cache
    // may keep, under the address the next preview lands on.
    expect((await previewed('/?theme-preview=broadsheet', 'broadsheet')).html).toContain('href="/theme-preview/leave?to=%2F"')
    expect((await previewed('/a-post?x=1&theme-preview=broadsheet', 'broadsheet')).html)
      .toContain(`href="/theme-preview/leave?to=${encodeURIComponent('/a-post?x=1')}"`)
    expect((await save({ home: { mode: 'front' } })).status).toBe(200)
    await check('/')
    // The saved choice did not move.
    expect(htmlTag((await page('/')).html)).toContain(' data-theme="plain"')
  })

  it('draws a built-in theme too, named in the admin\'s words', async () => {
    const { html } = await previewed('/a-post', 'paper')
    expect(htmlTag(html)).toContain(' data-theme="paper"')
    expect(htmlTag(html)).toContain(' data-look="paper"')
    expect(html).toContain(`Previewing <strong>${adminT('en').lookPaper}</strong>`)
  })

  it('says it in the site\'s language', async () => {
    await install(themeZip())
    expect((await save({ language: 'de' })).status).toBe(200)
    const { html } = await previewed('/', 'broadsheet')
    const de = adminT('de')
    expect(html).toContain(de.themePreviewing.replace('{theme}', '<strong>Broadsheet</strong>'))
    expect(html).toContain(`>${de.themePreviewLeave}</a>`)
    expect(html).toContain(`>${de.themePreviewChoose}</a>`)
    expect(de.themePreviewLeave).not.toBe(adminT('en').themePreviewLeave)
  })

  it('escapes the theme\'s name', async () => {
    await install(themeZip({ 'theme.json': { ...MANIFEST, name: 'A <b>bold</b> & "sly" name' } }))
    const { html } = await previewed('/', 'broadsheet')
    expect(html).toContain('<strong>A &lt;b&gt;bold&lt;/b&gt; &amp; &quot;sly&quot; name</strong>')
  })
})

describe('anybody else carrying the cookie', () => {
  it('gets the reader\'s page: signed out, a session that is not one, or a removed session', async () => {
    await install(themeZip())
    for (const session of ['', '__Host-quire_session=forged']) {
      const { res, html } = await previewed('/', 'broadsheet', session)
      await expectReaderPage('/', res, html)
    }
    db().run('delete from sessions')
    const { res, html } = await previewed('/a-post', 'broadsheet')
    await expectReaderPage('/a-post', res, html)
  })
})

describe('an id the site cannot draw', () => {
  it('is the reader\'s page: unknown, not an id, removed or unreadable', async () => {
    await install(themeZip())
    for (const id of ['nope', '..%2Fx', 'PLAIN']) {
      const { res, html } = await previewed('/', id)
      await expectReaderPage('/', res, html)
    }
    expect((await asOwner('/api/themes/broadsheet', { method: 'DELETE' })).status).toBe(200)
    const removed = await previewed('/', 'broadsheet')
    await expectReaderPage('/', removed.res, removed.html)

    await install(themeZip())
    db().run(`update themes set manifest = '{not json' where theme_id = 'broadsheet'`)
    forgetInstalledTheme()
    clearCache()
    const unreadable = await previewed('/', 'broadsheet')
    await expectReaderPage('/', unreadable.res, unreadable.html)
  })
})

describe('leaving a preview', () => {
  it('clears the cookie and goes back to the page, signed in or not', async () => {
    for (const ask of [asOwner, (p: string) => app.request(p)]) {
      const res = await ask('/theme-preview/leave?to=%2Fa-post%3Fx%3D1')
      expect(res.status).toBe(303)
      expect(res.headers.get('location')).toBe('/a-post?x=1')
      expect(res.headers.get('set-cookie')).toBe(`${PREVIEW_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)
      expect(res.headers.get('cache-control')).toBe('private, no-store')
    }
  })

  it('never sends the browser to another site', async () => {
    for (const to of ['//evil.example/x', '/\\evil.example', 'https://evil.example/', 'javascript:alert(1)', '', '/a\r\nSet-Cookie:x=1', '/a b']) {
      const res = await app.request(`/theme-preview/leave?to=${encodeURIComponent(to)}`)
      expect(res.headers.get('location')).toBe('/')
    }
  })

  it('answers a path a header cannot carry percent-encoded, never with a 500', async () => {
    for (const [to, location] of [['/　', '/%E3%80%80'], ['/café?q=中', '/caf%C3%A9?q=%E4%B8%AD'], ['/%E3%80%80', '/%E3%80%80']] as const) {
      const res = await app.request(`/theme-preview/leave?to=${encodeURIComponent(to)}`)
      expect(res.status).toBe(303)
      expect(res.headers.get('location')).toBe(location)
    }
    expect(safeReturnPath('/a\ud800')).toBe('/')
  })
})
