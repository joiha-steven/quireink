// The pen as a stylesheet anyone may link (ADR 0048).
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { DEFAULT_INKS, EMBED_SCOPE, inkEmbedCss, inkHighlightCss, inkLinesCss, PEN_GRIPS, penStroke } from '@/pen'

const DIR = './.tmp/test-pen-css'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
beforeEach(() => { db().run(`delete from settings`); clearCache() })

describe('the embeddable sheet', () => {
  it('hangs off .pen and the .dark ancestor, and asks the host page for nothing of this blog', () => {
    const css = inkEmbedCss()
    expect(css).toContain(`.pen mark[data-pen="0"]{--ink-h:${PEN_GRIPS[0]!.h}`)
    expect(css).toContain('.pen u{')
    expect(css).toContain('.pen mark[data-form=o]{')
    expect(css).toContain('.dark .pen mark{mix-blend-mode:normal;color:inherit}')
    expect(css).not.toContain('.prose')
    expect(css).not.toContain('var(--c-')
  })

  it('is the site sheets under another name: same strokes, same grips, only the scope differs', () => {
    const site = inkHighlightCss() + inkLinesCss()
    const embed = inkHighlightCss(undefined, EMBED_SCOPE) + inkLinesCss(undefined, EMBED_SCOPE)
    const norm = (s: string) => s.replace(/\.dark \.(prose|pen)/g, '.D').replace(/\.(prose|pen)/g, '.S')
      .replace('color:var(--c-heading)', 'color:inherit')
    expect(norm(embed)).toBe(norm(site))
    expect(embed).toContain(penStroke('#d5f856', 0).slice(0, 40))
  })
})

describe('GET /pen.css', () => {
  it('serves it as CSS, open to every origin, fresh for an hour and stale for a day', async () => {
    const res = await app.request('/pen.css')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/css; charset=utf-8')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600, stale-while-revalidate=86400')
    const body = await res.text()
    expect(body.startsWith('/* The pen, from Quire Ink')).toBe(true)
    expect(body).toContain('.pen mark[data-pen="0"]')
    expect(body).not.toContain('.prose')
  })

  it("follows this blog's inks", async () => {
    const before = await (await app.request('/pen.css')).text()
    await saveSettings({ inks: { ...DEFAULT_INKS, yellow: '#ff00aa' } })
    clearCache()
    const after = await (await app.request('/pen.css')).text()
    expect(after).not.toBe(before)
    expect(after).toContain(penStroke('#ff00aa').slice(0, 40))
  })
})
