// The Look card with themes installed from a zip (ADR 0072, T2c), as markup: each installed theme
// is a key in the same track as the four built in, with its name, version, author and the
// Unreviewed badge; Rollback only where a version before it exists; Remove always; the install
// control drawn with every answer hidden; and a warning only when the chosen theme is not what the
// site draws.
import { describe, expect, it } from 'bun:test'
import { adminT } from '@/i18n/admin-i18n'
import { DEFAULT_SETTINGS } from '@/content/settings'
import { BUILTIN_THEMES } from '@/content/themes-builtin'
import type { InstalledTheme } from '@/content/installed-themes'
import { lookPicker } from '@/web/admin/screens/settings-appearance-look'
import { appearanceTab } from '@/web/admin/screens/settings-appearance'

const t = adminT('en')
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)

const theme = (id: string, over: Partial<InstalledTheme['current']> = {}, previous: InstalledTheme['previous'] = []): InstalledTheme => ({
  id,
  current: {
    version: '1.1.0', hash: HASH_A, installedAt: 1, name: 'Broadsheet', author: 'A. Writer',
    description: null, license: 'MIT', homepage: null, api: 1, screenshot: `/themes/${HASH_A}/screenshot.webp`,
    ...over,
  },
  previous,
  active: false,
  reviewed: false,
  readable: true,
})

const BROADSHEET = theme('broadsheet', {}, [{ version: '1.0.0', hash: HASH_B, installedAt: 0 }])
const LONG_NAME = 'A theme whose name runs on for exactly sixty characters, ok!'
const LEDGER = theme('ledger', { name: LONG_NAME, author: 'Somebody <b>loud</b>', hash: HASH_B, screenshot: `/themes/${HASH_B}/screenshot.webp` })
const OK = { ok: true } as const

/** The markup of one installed theme's cell. */
const cell = (html: string, id: string): string => {
  const start = html.indexOf(`data-theme-cell="${id}"`)
  expect(start).toBeGreaterThan(-1)
  const next = html.indexOf('data-theme-cell="', start + 1)
  return html.slice(start, next === -1 ? html.indexOf('data-theme-install') : next)
}

describe('the installed tiles', () => {
  it('sit in the built-in tiles’ own track, after them, and are chosen the same way', () => {
    const html = lookPicker(t, { ...DEFAULT_SETTINGS, theme: 'broadsheet' }, { installed: [BROADSHEET, LEDGER], health: OK })
    const track = html.slice(html.indexOf('data-choice-track'), html.indexOf('data-theme-install'))
    const ids = [...track.matchAll(/data-choice="([^"]+)"/g)].map((m) => m[1])
    expect(ids).toEqual([...BUILTIN_THEMES.map((b) => b.id), 'broadsheet', 'ledger'])
    expect(track).toContain('data-k="theme" data-was="broadsheet"')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html).toContain('data-choice="broadsheet" aria-pressed="true"')
    // The same skin as a built-in tile, to the class.
    const builtinOn = html.match(/data-choice="plain"[^>]* data-on="([^"]+)"/)![1]
    expect(cell(html, 'broadsheet')).toContain(`data-on="${builtinOn}"`)
  })

  it('shows each theme’s name, version and author, the Unreviewed badge and its screenshot', () => {
    const html = lookPicker(t, DEFAULT_SETTINGS, { installed: [BROADSHEET, LEDGER], health: OK })
    const one = cell(html, 'broadsheet')
    expect(one).toContain('>Broadsheet</span>')
    expect(one).toContain('>Version 1.1.0 · A. Writer</span>')
    expect(one).toContain(`>${t.themeUnreviewed}</span>`)
    expect(one).toContain(`<img src="/themes/${HASH_A}/screenshot.webp" alt=""`)
    const two = cell(html, 'ledger')
    expect(two).toContain(`>${LONG_NAME}</span>`)
    expect(two).toContain(`<img src="/themes/${HASH_B}/screenshot.webp" alt=""`)
    // An author's markup is text, never markup.
    expect(two).toContain('Somebody &lt;b&gt;loud&lt;/b&gt;')
    expect(two).not.toContain('<b>loud')
  })

  it('draws every installed tile’s picture in the built-in drawing’s 160 by 96 box', () => {
    const html = lookPicker(t, DEFAULT_SETTINGS, { installed: [LEDGER], health: OK })
    const builtin = [...html.matchAll(/<svg viewBox="([^"]+)" class="mb-2 block w-full/g)].map((m) => m[1])
    expect(builtin).toEqual(BUILTIN_THEMES.map(() => '0 0 160 96'))
    // The installed one: the same box, its 8px below moved onto the wrapper the screenshot sits in.
    expect(cell(html, 'ledger')).toContain('<span class="relative mb-2 block"><svg viewBox="0 0 160 96" class="block w-full')
  })

  it('offers Rollback only where a version before the current one exists, and Remove on every theme', () => {
    const html = lookPicker(t, DEFAULT_SETTINGS, { installed: [BROADSHEET, LEDGER], health: OK })
    expect(cell(html, 'broadsheet')).toContain('data-theme-rollback="broadsheet"')
    expect(cell(html, 'broadsheet')).toContain('>Roll back to 1.0.0</button>')
    expect(cell(html, 'ledger')).not.toContain('data-theme-rollback')
    expect(cell(html, 'broadsheet')).toContain('data-theme-remove="broadsheet"')
    expect(cell(html, 'ledger')).toContain('data-theme-remove="ledger"')
  })

  it('offers Preview on every built-in and every readable installed tile, opening a new tab, and not on an unreadable one', () => {
    const broken: InstalledTheme = { ...theme('ruin', { name: 'ruin', screenshot: '' }), readable: false }
    const html = lookPicker(t, DEFAULT_SETTINGS, { installed: [BROADSHEET, LEDGER, broken], health: OK })
    const keys = [...html.matchAll(/<a href="([^"]+)"[^>]*data-theme-preview-key="([^"]+)" aria-label="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
      .map(([, href, id, label, text]) => ({ href, id, label, text }))
    expect(keys.map((k) => k.id)).toEqual([...BUILTIN_THEMES.map((b) => b.id), 'broadsheet', 'ledger'])
    for (const k of keys) {
      expect(k.href).toBe(`/api/themes/${k.id}/preview`)
      expect(k.text).toBe(t.themePreview)
    }
    expect(keys.find((k) => k.id === 'paper')?.label).toBe(t.themePreviewLabel.replace('{theme}', t.lookPaper))
    expect(keys.find((k) => k.id === 'broadsheet')?.label).toBe('Preview Broadsheet in a new tab')
    expect(html.match(/data-theme-preview-key="[^"]+" [^>]*/g)?.length).toBe(keys.length)
    expect(cell(html, 'broadsheet')).toMatch(/<a href="\/api\/themes\/broadsheet\/preview" target="_blank" rel="noopener"/)
    expect(cell(html, 'ruin')).not.toContain('data-theme-preview-key')
    // Previewing is not choosing: no key is a preview link and no preview link is a key.
    expect(html).not.toMatch(/data-choice="[^"]+"[^>]*data-theme-preview-key/)
  })

  it('draws no installed tile and the install control when nothing is installed', () => {
    const html = lookPicker(t, DEFAULT_SETTINGS, { installed: [], health: OK })
    expect(html).not.toContain('data-theme-cell')
    expect(html).toContain('data-theme-choose')
    expect(html).toContain('<input type="file" hidden data-theme-file accept=".zip,application/zip">')
    for (const hook of ['data-theme-status', 'data-theme-error', 'data-theme-refusal']) {
      expect(html).toMatch(new RegExp(`${hook}[^>]* hidden>|${hook} hidden>`))
    }
    expect(html).toContain('<template data-theme-violation>')
  })

  it('carries a line for every rule code of the checker in the island’s words', () => {
    const html = lookPicker(t, DEFAULT_SETTINGS)
    const raw = html.match(/data-theme-words="([^"]+)"/)![1]!.replaceAll('&quot;', '"').replaceAll('&amp;', '&')
    const words = JSON.parse(raw) as { rules: Record<string, string> }
    expect(Object.keys(words.rules).sort()).toEqual(
      ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'C1', 'F1', 'P1', 'S1', 'S2', 'S3', 'T1', 'V1', 'X1', 'other'])
  })
})

describe('the broken-theme warning', () => {
  it('is not drawn while the chosen theme draws', () => {
    expect(lookPicker(t, { ...DEFAULT_SETTINGS, theme: 'broadsheet' }, { installed: [BROADSHEET], health: OK }))
      .not.toContain('data-theme-broken')
  })

  it('says the site is drawn as Plain, and why, for each of the three ways', () => {
    const plain = t.lookPlain
    const cases = [
      ['missing', 'gone', 'is not installed'],
      ['unreadable', 'Broadsheet', 'cannot be read'],
      ['sheet_missing', 'Broadsheet', 'missing from storage'],
    ] as const
    for (const [why, name, says] of cases) {
      const id = why === 'missing' ? 'gone' : 'broadsheet'
      const html = lookPicker(t, { ...DEFAULT_SETTINGS, theme: id }, { installed: [BROADSHEET], health: { ok: false, id, why } })
      const line = html.match(/<p [^>]*data-theme-broken="([^"]+)">([^<]+)<\/p>/)
      expect(line?.[1]).toBe(why)
      expect(line?.[2]).toContain(`drawn as ${plain}`)
      expect(line?.[2]).toContain(name)
      expect(line?.[2]).toContain(says)
    }
  })

  it('presses no tile when the stored id is not on offer, so opening the screen is not a change', () => {
    const html = lookPicker(t, { ...DEFAULT_SETTINGS, theme: 'gone' }, { installed: [BROADSHEET], health: { ok: false, id: 'gone', why: 'missing' } })
    expect(html).toContain('data-k="theme" data-was=""')
    expect(html).not.toContain('aria-pressed="true"')
  })

  it('reaches the Appearance tab from the view the settings screen loads', () => {
    const html = appearanceTab(t, { ...DEFAULT_SETTINGS, theme: 'broadsheet' }, {
      presets: [], installed: [BROADSHEET], health: { ok: false, id: 'broadsheet', why: 'sheet_missing' },
    })
    expect(html).toContain('data-theme-cell="broadsheet"')
    expect(html).toContain('data-theme-broken="sheet_missing"')
  })
})
