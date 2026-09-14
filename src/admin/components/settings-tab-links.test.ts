// Every `?tab=` the admin links to must be a tab that exists.
//
// It shipped wrong and nothing said so. Four links across three files pointed at
// `?tab=integrations`, a name from the FIVE-tab arrangement ADR 0011 replaced. `SettingsView`
// falls back to the Site tab for an unknown value — deliberately, since the parameter comes
// off a URL — so "SMTP settings" and "Turn on what you need" both quietly landed the owner on
// a screen about the site's title, with nothing to say they had been sent somewhere else.
//
// A silent fallback plus a hand-typed key is a combination that cannot fail loudly at runtime,
// so it has to fail here instead. Reads the source rather than the rendered page: a dead link
// on a screen nobody opened in the tour is exactly the one that survives.
//
// ⚠️ THE OLD IDS DO NOT COUNT AS LIVE TABS. `SettingsView` maps the eight names of the
// pre-0041 arrangement onto the seven that replaced them, so a bookmark, a printed guide or a
// link in somebody's notes still lands correctly — but that map is for addresses arriving
// from OUTSIDE. A link inside this bundle naming a tab that no longer exists is a link nobody
// updated, and it goes stale in the direction that matters: the redirect is a promise about
// old URLs, not a licence to keep writing them.

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { TAB_IDS } from '@/admin-shared/settings-tabs'
import { join } from 'node:path'

/**
 * The tabs, READ OUT OF `SettingsView` rather than copied here.
 *
 * It was a copy, and on 2026-08-24 the copy was stale in exactly the way this file exists to
 * catch: the AI tab had been shipped for a day, `TAB_IDS` in `SettingsView` had never been
 * told about it either, and the two agreed with each other while both disagreed with the
 * screen. Two hand-typed copies of one list do not check each other; they only make the
 * wrong answer look confirmed. There is one list now, and this reads it.
 */
function tabIds(): string[] {
  // Read from `@/admin-shared/settings-tabs`, which is where the list lives since the screen
  // became server-rendered (ADR 0054). It was parsed out of `SettingsView.tsx` with a regular
  // expression before that, and before THAT it was a hand-typed copy here — which on
  // 2026-08-24 was stale in exactly the way this file exists to catch: the AI tab had shipped a
  // day earlier, the copy had never been told, and the two agreed with each other while both
  // disagreed with the screen. Two copies of one list do not check each other.
  return [...TAB_IDS]
}

const TABS = tabIds()

/**
 * BOTH ADMIN TREES, and the second one is why this test failed on 2026-09-14.
 *
 * It read `src/admin` only, which was every screen in the admin until ADR 0054 began moving
 * them to `src/web/admin/screens`. Deleting the newsletter's React files took the link count
 * under its floor, and that floor is the only reason anybody looked: the screens that had
 * already moved were carrying `?tab=` links that nothing checked, and a dead one there would
 * have landed the owner on the Site tab in silence exactly as the 2026-08 bug did.
 */
const ROOTS = [join(import.meta.dir, '..'), join(import.meta.dir, '../../web/admin')]

const allSources = (): string[] => ROOTS.flatMap(sourceFiles)

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'dist' || entry === 'node_modules') continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.tsx?$/.test(entry) && !entry.endsWith('.test.ts')) out.push(path)
  }
  return out
}

/**
 * A SETTINGS LINK, not any `?tab=` anywhere.
 *
 * The bare matcher was right while every screen lived in `src/admin` and `?tab=` meant one
 * thing. It stopped being right the moment this test learned to read `src/web/admin`: the
 * trash keeps WHICH KIND IS OPEN in `?tab=` too, so `?tab=media` — a perfectly good trash
 * address — was reported as a dead settings tab. A matcher that cries about working links is
 * a matcher somebody turns off.
 *
 * The optional group before `tab=` is for a settings URL that ever grows a second parameter.
 */
const SETTINGS_TAB = /\/admin\/settings\?(?:[^"'\s]*[?&])?tab=([a-z-]+)/g

describe('settings tab links', () => {
  it('never point at a tab that does not exist', () => {
    const bad: string[] = []
    for (const file of allSources()) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(SETTINGS_TAB)) {
        if (!TABS.includes(m[1]!)) bad.push(`${file.split('/src/')[1]}: ?tab=${m[1]}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('finds the links it is meant to be checking', () => {
    // A matcher that silently matches nothing passes forever. The admin does link to tabs.
    const found = allSources()
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(SETTINGS_TAB)])
    expect(found.length).toBeGreaterThan(2)
    // And from BOTH trees, so that converting the last React screen cannot quietly leave this
    // checking one empty directory.
    const fromServer = sourceFiles(ROOTS[1]!)
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(SETTINGS_TAB)])
    expect(fromServer.length).toBeGreaterThan(0)
  })
})
