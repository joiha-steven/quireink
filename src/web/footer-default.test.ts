// The untouched default footer speaks the blog's language; a written one is left alone (FIXLIST 8.2).
import { describe, expect, it } from 'bun:test'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { siteFooter } from '@/web/chrome'

const render = (over: Partial<typeof DEFAULT_SETTINGS>): string =>
  siteFooter({ ...DEFAULT_SETTINGS, title: 'Blog', ...over }, {} as Parameters<typeof siteFooter>[1])

describe('the default footer', () => {
  it('is said in the blog’s language', () => {
    expect(render({ language: 'en' })).toContain('powered by Quire Ink')
    const vi = render({ language: 'vi' })
    expect(vi).toContain('chạy bằng Quire Ink')
    expect(vi).not.toContain('powered by')
    expect(vi).toContain(`© ${new Date().getFullYear()} Blog`)
  })

  it('leaves a footer the owner wrote exactly as written', () => {
    expect(render({ language: 'vi', footer: 'Made by hand' })).toContain('Made by hand')
  })
})
