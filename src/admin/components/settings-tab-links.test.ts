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

/** The seven, as `SettingsView` keys them. Kept here as the literal it is checking against. */
const TABS = ['site', 'layout', 'reading', 'appearance', 'seo', 'connections', 'system']

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
