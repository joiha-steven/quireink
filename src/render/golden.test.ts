// The M2 gate, at the level it can be held today: for every corpus fixture, Quire Ink 2.0's
// article body is BYTE-IDENTICAL to the frozen implementation's.
//
// The reference HTML in `golden/v1/corpus/` was produced by actually running the frozen
// renderer (`golden/capture-corpus.ts`), not written by hand. Hand-written expectations
// would only test that I transcribed my own port correctly, which is the thing least worth
// testing.
//
// `marked` and `shiki` are pinned to EXACT versions in `package.json`, no caret. A byte
// comparison against a floating dependency would fail on a patch release and teach everyone
// to ignore it.
//
// The pins are no longer the frozen tree's own (18.0.5 / 4.2.0): the 2026-08-11 security
// pass moved them to 18.0.9 and 4.4.3 and re-ran this gate, which stayed 46/46. That is what
// the pins are FOR — a bump is a reviewed change that has to prove it moved nothing, not a
// number nobody may touch. Deliberately not restated here as a version number, because the
// last one sat in this comment untrue from the day of the bump.
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderPostContent } from '@/render/post-content'

const ROOT = join(import.meta.dir, '..', '..', 'golden')
const CORPUS = join(ROOT, 'corpus')
const REFERENCE = join(ROOT, 'v1', 'corpus')

const fixtures = readdirSync(CORPUS).filter((f) => f.endsWith('.md')).sort()

describe('golden: article bodies are byte-identical to Quire 1.x', () => {
  test('the corpus is present and non-trivial', () => {
    // A harness that silently finds zero fixtures passes forever and proves nothing.
    expect(fixtures.length).toBeGreaterThan(40)
  })

  for (const file of fixtures) {
    const name = file.replace(/\.md$/, '')
    test(name, async () => {
      const markdown = readFileSync(join(CORPUS, file), 'utf8')
      const expected = readFileSync(join(REFERENCE, `${name}.html`), 'utf8')
      expect(await renderPostContent({ markdown })).toBe(expected)
    })
  }
})
