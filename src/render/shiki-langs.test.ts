// The copy of Shiki's language table is Shiki's language table.
//
// `shiki-langs.ts` is generated so that neither runtime has to import the bundle that holds the
// original (the generator says why). A copy is only safe while something compares it: this does,
// against the table rebuilt from Shiki exactly as `highlight.ts` built it before the copy existed.
import { describe, expect, test } from 'bun:test'
import { SHIKI_LANGS } from '@/render/shiki-langs'
import { shikiTable } from '../../scripts/gen-shiki-langs'

describe('shiki-langs.ts', () => {
  test('is Shiki\'s own table, spelling for spelling (re-run `bun scripts/gen-shiki-langs.ts` if not)', () => {
    const want = Object.fromEntries([...shikiTable()].sort(([a], [b]) => a.localeCompare(b)))
    const have = Object.fromEntries([...SHIKI_LANGS].sort(([a], [b]) => a.localeCompare(b)))
    expect(have).toEqual(want)
  })

  test('every alias lands on an id, never on another alias', () => {
    for (const [spelling, id] of SHIKI_LANGS) expect({ spelling, id: SHIKI_LANGS.get(id) }).toEqual({ spelling, id })
  })
})
