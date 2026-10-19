// The browser tab names the screen first and the site second.
import { afterAll, describe, expect, it } from 'bun:test'
import { tabTitle, tabTitleText } from '@/web/admin/tab-title'
import { screenFor } from '@/web/admin/screens'
import { editorTitle } from '@/web/admin/screens/content'
import { adminT } from '@/i18n/admin-i18n'
import { freshDatabase, dropDatabase } from '@/test/db'
import { savePost } from '@/content/posts'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { settingsScreen } from '@/web/admin/screens/settings'
import { TAB_IDS } from '@/admin-shared/settings-tabs'

const DIR = './.tmp/test-tab-title'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

describe('tabTitleText', () => {
  it('puts the screen before the site', () => {
    expect(tabTitleText(['Settings'], 'Quire Ink')).toBe('Settings · Quire Ink')
  })
  it('keeps every part in order, most specific first', () => {
    expect(tabTitleText(['Appearance', 'Settings'], 'My blog')).toBe('Appearance · Settings · My blog')
  })
  it('falls back to the product name when the site has no title', () => {
    expect(tabTitleText(['Comments'], '')).toBe('Comments · quireINK')
    expect(tabTitleText(['Comments'], '   ')).toBe('Comments · quireINK')
    expect(tabTitleText([], '')).toBe('quireINK')
  })
  it('drops empty parts instead of printing a bare separator', () => {
    expect(tabTitleText(['', 'Trash'], 'Blog')).toBe('Trash · Blog')
  })
  it('escapes markup in the site title and in a part', () => {
    expect(tabTitle(['<b>"x"</b>'], 'A & B')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt; · A &amp; B')
  })
})

describe('what each address names', () => {
  const t = adminT('en')
  const q = new URLSearchParams()
  it('names the screen the rail and the heading use', async () => {
    expect(await screenFor('/admin/comments')?.screen.title(t, q)).toEqual([t.commentsNavTitle])
    expect(await screenFor('/admin/trash')?.screen.title(t, q)).toEqual([t.trashTitle])
  })
  it('names the settings tab as well', async () => {
    const parts = await screenFor('/admin/settings')?.screen.title(t, new URLSearchParams('tab=appearance'))
    expect(parts).toEqual([t.tabAppearance, t.settingsTitle])
  })
  it('names an open piece by its title, and a new one by the "new" wording', async () => {
    await savePost({ title: 'The <golden> canon', slug: 'the-golden-canon', date: new Date().toISOString(), status: 'published', content: 'Body.' })
    expect(await screenFor('/admin/editor/the-golden-canon')?.screen.title(t, q)).toEqual(['The <golden> canon'])
    expect(await editorTitle(t, '/admin/editor')).toEqual([t.newPost])
    expect(await editorTitle(t, '/admin/page-editor')).toEqual([t.newPage])
    expect(await editorTitle(t, '/admin/note-editor')).toEqual([t.newNote])
    expect(await editorTitle(t, '/admin/editor/no-such-piece')).toEqual([t.notFoundTitle])
  })
  it('names an untitled piece, whitespace-only titles included, the way the rest of the product does', async () => {
    await savePost({ title: '   ', slug: 'a-thought-in-passing', date: new Date().toISOString(), status: 'published', content: 'A thought in passing about nothing much.' })
    const [name] = await editorTitle(t, '/admin/editor/a-thought-in-passing')
    expect(name).toContain('A thought in passing')
    expect(name?.trim()).not.toBe('')
  })
  it('hands the settings island every tab label, so a tab swap can re-title without a reload', async () => {
    const html = await settingsScreen(DEFAULT_SETTINGS, new URLSearchParams())
    const raw = /data-tab-titles="([^"]*)"/.exec(html)?.[1] ?? ''
    const labels = JSON.parse(raw.replace(/&quot;/g, '"')) as Record<string, string>
    expect(Object.keys(labels).sort()).toEqual([...TAB_IDS].sort())
    expect(labels.appearance).toBe(t.tabAppearance)
    expect(html).toContain(`data-tab-screen="${t.settingsTitle}"`)
  })
})
