// The log says a changed setting by its name on the screen, never by its path (2026-09-30).
import { describe, expect, it } from 'bun:test'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { adminT } from '@/i18n/admin-i18n'
import { settingName, settingsDetail } from '@/admin-shared/setting-names'
import { logSentence } from '@/admin-shared/log-sentence'
import { describeSettingsSave } from '@/content/settings-diff'

const LANGS = ['en', 'vi', 'de', 'ja', 'ko', 'zh', 'fr', 'es', 'pt', 'it', 'ru'] as const

/** Every path the diff can write: the top level, and one level into each group. */
function paths(): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    out.push(k)
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const s of Object.keys(v)) out.push(`${k}.${s}`)
  }
  return out
}

describe('settingName', () => {
  it('has words for every path a save can record, in every language', () => {
    for (const lang of LANGS) {
      const t = adminT(lang)
      const missing = paths().filter((p) => settingName(t, p) === '')
      expect({ lang, missing }).toEqual({ lang, missing: [] })
    }
  })

  it('climbs to the group for a path deeper than the diff writes', () => {
    const t = adminT('en')
    expect(settingName(t, 'home.front.lead.on')).toBe(t.cardFront)
    expect(settingName(t, 'features.search')).toBe(t.featSearch)
  })
})

describe('a settings save in the log', () => {
  it('reads as names, and keeps the count of the rest', () => {
    const t = adminT('vi')
    const before = structuredClone(DEFAULT_SETTINGS)
    const after = { ...structuredClone(DEFAULT_SETTINGS), mcp: { enabled: true }, logoDarkUrl: '/x.png',
      logoDarkRenderUrl: '/y.png', logoDarkRenderHeight: 40, title: 'T', description: 'D', postsPerPage: 3 }
    const raw = describeSettingsSave(before, after)
    expect(raw).toContain('+')
    const line = logSentence(t, 'settings.save', raw)
    expect(line).not.toMatch(/mcp\.enabled|logoDark/)
    expect(line).toContain(t.chooseLogoDark)
    // Three dark-logo paths are one control, said once.
    expect(line.split(t.chooseLogoDark).length).toBe(2)
    expect(line).toMatch(/\+\d+$/)
  })

  it('says a save that moved nothing, and the hand-written details, in words', () => {
    const t = adminT('de')
    expect(settingsDetail(t, 'no change')).toBe(t.logNoChange)
    expect(settingsDetail(t, 'offsite bucket')).toBe(t.offsiteTitle)
    expect(settingsDetail(t, 'something new')).toBe('something new')
  })
})
