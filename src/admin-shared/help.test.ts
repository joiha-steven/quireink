// The Help screen in every language (2026-09-30): the same shape as the English one, every
// placeholder a real dictionary key, every link a screen or a doc that exists, and no tab named
// that the settings screen does not have.
import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { adminT } from '@/i18n/admin-i18n'
import { dress, helpText } from '@/admin-shared/help'
import { BUILTIN, SHORTCUTS } from '@/admin-shared/keys'
import { TAB_IDS } from '@/admin-shared/settings-tabs'

const LANGS = ['en', 'vi', 'de', 'ja', 'ko', 'zh', 'fr', 'es', 'pt', 'it', 'ru'] as const
const en = helpText('en')

/** Tags with their attributes, in order: what a translation must leave exactly as it was. */
const tags = (html: string): string[] => html.match(/<[^>]+>/g) ?? []
const holes = (text: string): string[] => (text.match(/\{t:\w+\}|\{tabs\}/g) ?? []).sort()
const codes = (html: string): string[] => html.match(/<code>[^<]*<\/code>/g) ?? []

for (const lang of LANGS) describe(`Help in ${lang}`, () => {
  const h = helpText(lang)
  const t = adminT(lang)

  it('has the English shape: sections, index, markdown, keys, trouble', () => {
    expect(h.sections.map((s) => s.id)).toEqual(en.sections.map((s) => s.id))
    expect(Object.keys(h.index)).toEqual(Object.keys(en.index))
    expect(Object.keys(h.markdown)).toEqual(Object.keys(en.markdown))
    expect(Object.keys(h.keys).sort()).toEqual([...SHORTCUTS, ...BUILTIN].map((k) => k.id).sort())
    expect(h.trouble.length).toBe(en.trouble.length)
  })

  it('keeps every tag, placeholder and piece of code as the English has them', () => {
    h.sections.forEach((s, i) => {
      const e = en.sections[i]!
      expect({ id: s.id, tags: tags(s.body) }).toEqual({ id: e.id, tags: tags(e.body) })
      expect({ id: s.id, holes: holes(s.body) }).toEqual({ id: e.id, holes: holes(e.body) })
      expect({ id: s.id, codes: codes(s.body) }).toEqual({ id: e.id, codes: codes(e.body) })
    })
    h.trouble.forEach(([a, b], i) => {
      expect(holes(a + b)).toEqual(holes(en.trouble[i]![0] + en.trouble[i]![1]))
    })
  })

  it('fills every placeholder from the admin dictionary', () => {
    for (const s of h.sections) expect(dress(s.body, t)).not.toMatch(/\{t:|\{tabs\}/)
    for (const [a, b] of h.trouble) expect(dress(a + b, t)).not.toMatch(/\{t:/)
  })

  it('writes with the language’s own apostrophe and never a straight quote in prose', () => {
    const prose = [h.intro, ...h.sections.map((s) => `${s.title} ${s.body.replace(/<[^>]+>/g, ' ')}`),
      ...Object.values(h.markdown), ...Object.values(h.keys), ...h.trouble.flat()].join('\n')
    expect(prose.match(/\w'\w/g) ?? []).toEqual([])
    expect(prose.includes('"')).toBe(false)
  })
})

describe('the links Help gives', () => {
  it('open a settings tab that exists, and a doc that is in the repository', () => {
    const html = en.sections.map((s) => s.body).join('\n')
    for (const [, tab] of html.matchAll(/\/admin\/settings\?tab=(\w+)/g)) expect(TAB_IDS).toContain(tab as never)
    for (const [, path] of html.matchAll(/href="doc:([^"]+)"/g)) expect(existsSync(path!)).toBe(true)
  })
})
