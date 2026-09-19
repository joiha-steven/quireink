// THE HEADER'S THEME KEY, as the server sends it.
//
// The island decides which of the two words is showing (`assets/js/theme-token.test.ts`); this
// is the other half of that deal — the words have to ARRIVE. They ride on the button, the way
// the palette key carries its own list, because the reader's bundle holds no locale table.
//
// Without this the island's own tests go on passing against a fixture they built themselves
// while the live page ships a button with nothing to read: the word would simply never move
// again, which is the bug this pair exists for.
import { afterAll, describe, expect, it } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { saveSettings } from '@/content/settings'
import { clearCache } from '@/server/cache'
import { createApp } from '@/web/app'
import { t } from '@/i18n/i18n'

const DIR = './.tmp/test-theme-key'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))
const app = createApp()

const home = async (): Promise<string> => (await app.request('/')).text()
const key = (html: string): string => /<button[^>]*data-theme-toggle[\s\S]*?<\/button>/.exec(html)?.[0] ?? ''

describe('the theme key carries both of its words', () => {
  it('ships the pair, and prints the one a light page is offering', async () => {
    clearCache()
    await saveSettings({ language: 'en' })
    const s = t('en')
    const button = key(await home())
    expect(button).not.toBe('')
    expect(button).toContain(`data-theme-words="${s.shortThemeDark}|${s.shortThemeLight}"`)
    // ⚠️ THE DARK WORD IN THE MARKUP. The page is cached and the reader's choice is in their
    // own storage, so the server cannot know which is right; it prints what a blog nobody has
    // switched is offering, and the island corrects it on its first apply.
    expect(button).toContain(`<span class="btn-token">${s.shortThemeDark}</span>`)
    expect(button).not.toContain(`>${s.shortThemeLight}<`)
  })

  it('carries the blog\'s own language, not English', async () => {
    clearCache()
    await saveSettings({ language: 'vi' })
    const vi = t('vi')
    const button = key(await home())
    expect(button).toContain(`data-theme-words="${vi.shortThemeDark}|${vi.shortThemeLight}"`)
    // The counter-test: a pair that came out in the wrong language would still be a pair.
    expect(vi.shortThemeDark).not.toBe(t('en').shortThemeDark)
    expect(button).not.toContain(t('en').shortThemeDark)
  })

  it('never ships the two words the same way round', async () => {
    // Both halves come from one dictionary, so a file that copied one key into the other
    // would print a button offering the state it is already in, in every language.
    for (const lang of ['en', 'vi', 'de', 'ja', 'ko', 'zh', 'fr', 'es', 'pt', 'it', 'ru'] as const) {
      const s = t(lang)
      expect(s.shortThemeDark, lang).not.toBe(s.shortThemeLight)
      expect(s.shortThemeDark.trim(), lang).not.toBe('')
      expect(s.shortThemeLight.trim(), lang).not.toBe('')
    }
  })
})
