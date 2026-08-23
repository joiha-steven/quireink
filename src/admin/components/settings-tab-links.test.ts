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

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
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
  const src = readFileSync(join(import.meta.dir, 'SettingsView.tsx'), 'utf8')
  const block = src.match(/const TAB_IDS: Tab\[\] = \[([\s\S]*?)\]/)
  if (!block) throw new Error('settings-tab-links: no TAB_IDS in SettingsView.tsx')
  const ids = [...block[1]!.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]!)
  // A parse that quietly returns nothing would call every link in the admin broken, which
  // is the loud failure — but half a list would call SOME of them broken, which is worse.
  if (ids.length < 5) throw new Error(`settings-tab-links: read only ${ids.length} tabs`)
  return ids
}

const TABS = tabIds()

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

describe('settings tab links', () => {
  it('never point at a tab that does not exist', () => {
    const bad: string[] = []
    for (const file of sourceFiles(join(import.meta.dir, '..'))) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/[?&]tab=([a-z-]+)/g)) {
        if (!TABS.includes(m[1]!)) bad.push(`${file.split('/admin/')[1]}: ?tab=${m[1]}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('finds the links it is meant to be checking', () => {
    // A matcher that silently matches nothing passes forever. The admin does link to tabs.
    const found = sourceFiles(join(import.meta.dir, '..'))
      .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/[?&]tab=([a-z-]+)/g)])
    expect(found.length).toBeGreaterThan(2)
  })
})
