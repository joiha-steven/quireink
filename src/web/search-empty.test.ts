// /search on a site with nothing published: no tags and no posts to suggest, so the page
// says what the box is for instead of standing as a heading and a box alone.
import { afterAll, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import en from '../../locales/en'
import { escapeHtml } from '@/utils'

const DIR = './.tmp/test-search-empty'
freshDatabase(DIR)
const app = createApp()
afterAll(() => dropDatabase(DIR))

describe('/search on an empty site', () => {
  it('falls back to the hint', async () => {
    const res = await app.request('/search')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<form class="qbox"')
    expect(html).toContain(`<p class="empty">${escapeHtml(en.searchHint)}</p>`)
    expect(html).not.toContain('class="qs-label"')
  })
})
