// The owner's own markup, and the four pages it must and must not reach.
//
// This is the one setting in the product that runs code, so where it does NOT go is as much
// of the feature as where it does. A tracker on the sign-in page watches the owner typing a
// password; a tracker on a draft preview reports a reader who does not exist and quietly
// corrupts the numbers the same owner reads in Analytics.
import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { savePost } from '@/content/posts'
import { saveSettings } from '@/content/settings'
import { previewToken } from '@/content/preview'
import { sanitizeSnippet } from '@/content/settings-sanitize'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'

const DIR = './.tmp/test-custom-code'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const app = createApp()
const html = async (path: string): Promise<string> => (await app.request(path)).text()

const HEAD = '<script>window.__head = 1</script>'
const FOOT = '<script>window.__foot = 1</script>'

beforeEach(async () => {
  clearCache()
  for (const t of ['posts', 'post_terms', 'post_revisions', 'settings']) db().run(`delete from ${t}`)
  await saveSettings({ customHead: HEAD, customBodyEnd: FOOT })
})

describe('custom code on the public pages', () => {
  it('rides an article, at both ends of the document', async () => {
    await savePost({ title: 'Post', content: 'body text here', status: 'published' })
    const page = await html('/post')
    expect(page).toContain(HEAD)
    expect(page).toContain(FOOT)
    // In the head, and after the body — not merely present somewhere.
    expect(page.indexOf(HEAD)).toBeLessThan(page.indexOf('</head>'))
    expect(page.indexOf(FOOT)).toBeGreaterThan(page.indexOf('</head>'))
    expect(page.indexOf(FOOT)).toBeLessThan(page.indexOf('</body>'))
  })

  it('rides a listing', async () => {
    await savePost({ title: 'Post', content: 'body text here', status: 'published' })
    const page = await html('/')
    expect(page).toContain(HEAD)
    expect(page).toContain(FOOT)
  })

  // The three pages a tracker has no business on. Each is a different renderer calling the
  // same document function, which is why the snippets are passed in rather than read there.
  it('stays off the sign-in page', async () => {
    const page = await html('/login')
    expect(page).not.toContain(HEAD)
    expect(page).not.toContain(FOOT)
  })

  it('stays off a draft preview', async () => {
    await savePost({ title: 'Draft', content: 'not published yet', status: 'draft' })
    const res = await app.request(`/preview/draft?key=${previewToken('draft')}`)
    expect(res.status).toBe(200)
    const page = await res.text()
    // The page really is the preview, so the absence below is a fact about this render
    // rather than about a 404 that never got as far as the shell.
    expect(page).toContain('not published yet')
    expect(page).not.toContain(HEAD)
    expect(page).not.toContain(FOOT)
  })

  it('is empty by default, so a fresh install ships no third-party request', async () => {
    await saveSettings({ customHead: '', customBodyEnd: '' })
    await savePost({ title: 'Post', content: 'body text here', status: 'published' })
    const page = await html('/post')
    expect(page).not.toContain('<script>window.')
  })
})

describe('sanitizeSnippet', () => {
  // Deliberately NOT the treatment customCss gets: a field for scripts cannot strip scripts.
  it('keeps the markup exactly as typed', () => {
    const snippet = '<script src="https://x.example/a.js"></script>\n<!-- keep -->'
    expect(sanitizeSnippet(snippet)).toBe(snippet)
  })

  it('trims the edges and refuses anything that is not a string', () => {
    expect(sanitizeSnippet('  <meta>  ')).toBe('<meta>')
    expect(sanitizeSnippet('   ')).toBe('')
    expect(sanitizeSnippet(undefined)).toBe('')
    expect(sanitizeSnippet(42)).toBe('')
  })
})
