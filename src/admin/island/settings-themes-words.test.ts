// What the Look card says after an install, from the words the server hands the island
// (`themeWords`): the sentence for what happened, and the count of files the operating system
// had added that the install left out. The DOM around it is `settings-themes.test.ts`.
import { describe, expect, it } from 'bun:test'
import { adminT } from '@/i18n/admin-i18n'
import { installedMessage, violationLines, type ThemeWords } from './lib/settings-themes'

const t = adminT('en')
const w: ThemeWords = {
  installedOk: t.themeInstalledOk, unchanged: t.themeUnchanged, replaced: t.themeReplaced, skippedOs: t.themeSkippedOs,
  rules: t.themeRules,
}
const said = (data: Parameters<typeof installedMessage>[0]) => installedMessage(data, 'Broadsheet', w)

describe('after an install', () => {
  it('says installed, already installed, or replaced with nothing to roll back to', () => {
    expect(said({ id: 'b', version: '1.1.0', changed: true })).toBe('Installed Broadsheet 1.1.0.')
    expect(said({ id: 'b', version: '1.1.0', changed: false })).toBe('Broadsheet 1.1.0 was already installed. Nothing changed.')
    expect(said({ id: 'b', version: '1.1.0', changed: true, replaced: true }))
      .toBe(t.themeReplaced.replace('{theme}', 'Broadsheet').replace('{version}', '1.1.0'))
  })

  it('says how many files the operating system had added, and nothing when there were none', () => {
    expect(said({ id: 'b', version: '1.1.0', changed: true, skipped: 7 }))
      .toBe('Installed Broadsheet 1.1.0. Files macOS or Windows add by themselves were left out: 7.')
    expect(said({ id: 'b', version: '1.1.0', changed: true, skipped: 0 })).toBe('Installed Broadsheet 1.1.0.')
  })

  it('says a missing required file in its own sentence, not as a file the package may not hold', () => {
    const v = { rule: 'A3', file: 'screenshot.webp', line: 0, col: 0, subject: 'missing' }
    expect(violationLines(v, w)).toEqual({ what: t.themeRules.missing, where: 'A3 · screenshot.webp · missing' })
    expect(violationLines({ ...v, subject: 'fonts/OFL.txt' }, w).what).toBe(t.themeRules.A3)
  })
})
