// Every setting, set one at a time, with the other 157 watched.
//
// This is the test that makes it safe for anything other than a form to write a setting. The
// promise `settings-path.ts` relies on is that `saveSettings` DEEP-merges — that a partial
// mentioning one leaf leaves every other leaf exactly where it was. That promise is already
// pinned for one case (`content/settings.test.ts`, after a patch carrying only a title reset
// `home.mode` on 2026-08-02). Here it is checked for ALL of them, because a path API turns a
// single group whose sanitiser happens to replace instead of merge into a way to wipe
// settings nobody named.
import { describe, expect, it, beforeEach } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabases } from '@/store/db'
import { getSettings, saveSettings } from '@/content/settings'
import { SETTING_PATHS, getAt, isSettingPath, patchAt, typeOfPath } from '@/content/settings-path'

beforeEach(() => {
  openDatabases(mkdtempSync(join(tmpdir(), 'quire-paths-')))
})

/** A value of the right kind that is NOT the one already there, so a no-op cannot pass. */
function differentValue(current: unknown, path: string): unknown {
  switch (typeOfPath(path)) {
    case 'boolean': return !current
    case 'number': return typeof current === 'number' ? current + 1 : 1
    case 'string': return `${String(current)}x`
    default: return null
  }
}

describe('the path list', () => {
  it('is derived from the shape, so it cannot go stale', () => {
    expect(SETTING_PATHS.length).toBeGreaterThan(100)
    expect(isSettingPath('title')).toBe(true)
    expect(isSettingPath('typography.roles.body.size')).toBe(true)
    expect(isSettingPath('features.search')).toBe(true)
  })

  it('leaves out what the server derives, so nothing offers a lever attached to nothing', () => {
    for (const derived of ['logoRenderUrl', 'logoEmailUrl', 'logoDarkRenderHeight', 'firstRunDone']) {
      expect(isSettingPath(derived)).toBe(false)
    }
  })

  it('leaves out the per-palette theme record, whose paths depend on which palettes exist', () => {
    expect(SETTING_PATHS.some((p) => p.startsWith('themes.'))).toBe(false)
  })

  it('refuses a path that is not one', () => {
    expect(isSettingPath('features.nonesuch')).toBe(false)
    expect(isSettingPath('')).toBe(false)
    expect(isSettingPath('__proto__.polluted')).toBe(false)
  })
})

describe('patchAt builds what saveSettings expects', () => {
  it('nests a dotted path', () => {
    expect(patchAt('typography.roles.body.size', 18)).toEqual({ typography: { roles: { body: { size: 18 } } } })
  })

  it('leaves a top-level path flat', () => {
    expect(patchAt('title', 'A blog')).toEqual({ title: 'A blog' })
  })
})

/**
 * The whole point of the file, and the reason it is worth the seconds it takes.
 *
 * One setting is changed, then EVERY other path is compared with what it was. A group whose
 * sanitiser replaced rather than merged would fail here on its first sibling, loudly, naming
 * both the path that was written and the one that moved with it.
 */
describe('writing ONE setting moves exactly one setting', () => {
  for (const path of SETTING_PATHS) {
    const kind = typeOfPath(path)
    if (kind === 'array' || kind === 'unknown') continue
    it(path, async () => {
      const before = await getSettings()
      const wanted = differentValue(getAt(before, path), path)
      const after = await saveSettings(patchAt(path, wanted))

      const moved = SETTING_PATHS.filter(
        (other) => other !== path && JSON.stringify(getAt(before, other)) !== JSON.stringify(getAt(after, other)),
      )
      // Named, not counted: "3 settings moved" starts a hunt, and the whole value of this
      // suite is that it hands over the list.
      expect(`${path} also moved: ${moved.join(', ')}`).toBe(`${path} also moved: `)
    })
  }
})
