// The chrome, the code face and a theme's headline face take a CJK tail for the page's language
// and for no other. One tail for all three set a Japanese headline in Chinese letterforms.
import { describe, expect, it } from 'bun:test'
import { cjkRoleCss } from '@/content/cjk-roles'
import { pageStyles } from '@/web/layout-styles'
import { DEFAULT_SETTINGS } from '@/content/settings'

describe('the CJK tail of the chrome, code and headline stacks', () => {
  it('prints nothing on a page in a language that is not Chinese, Japanese or Korean', () => {
    for (const lang of ['en', 'vi', 'de', 'ru', '']) expect(cjkRoleCss(lang)).toBe('')
    expect(pageStyles({ ...DEFAULT_SETTINGS, language: 'en' })).not.toContain('--cjk-sans:')
  })

  it("names that language's own faces, and only that language's", () => {
    const ja = cjkRoleCss('ja')
    expect(ja.startsWith(':root:lang(ja){')).toBe(true)
    expect(ja).toContain("--cjk-sans:'Hiragino Sans'")
    expect(ja).toContain("--cjk-serif:'Hiragino Mincho ProN'")
    expect(ja).not.toContain('PingFang')
    expect(ja).not.toContain('Songti')
    expect(cjkRoleCss('zh-TW')).toContain(":root:lang(zh){--cjk-sans:'PingFang SC'")
  })

  it('gives a monospace the sans tail and keeps its generic keyword', () => {
    expect(cjkRoleCss('zh')).toContain("--cjk-mono:'PingFang SC'")
    expect(cjkRoleCss('zh')).toMatch(/--cjk-mono:[^;]*, monospace;/)
  })

  it('keeps a Korean serif role on a face with a bold, never AppleMyungjo', () => {
    const ko = cjkRoleCss('ko')
    expect(ko).not.toContain('AppleMyungjo')
    expect(ko).toMatch(/--cjk-serif:[^}]*'Apple SD Gothic Neo'/)
  })

  it('reaches the page through pageStyles, for the language it is given', () => {
    expect(pageStyles({ ...DEFAULT_SETTINGS, language: 'en' }, '', 'ja')).toContain(':root:lang(ja){')
    const css = pageStyles({ ...DEFAULT_SETTINGS, language: 'ko' })
    expect(css).toContain(':root:lang(ko){')
    expect(css).toContain("--font-sans:'Inter', 'Inter Fallback', system-ui, -apple-system, 'Segoe UI', var(--cjk-sans, sans-serif)")
  })
})
