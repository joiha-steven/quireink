// The M2 gate, at the level it can be held today: for every corpus fixture, Quire Ink 2.0's
// article body is BYTE-IDENTICAL to the frozen implementation's.
//
// The reference HTML in `golden/v1/corpus/` was produced by actually running the frozen
// renderer (`golden/capture-corpus.ts`), not written by hand. Hand-written expectations
// would only test that I transcribed my own port correctly, which is the thing least worth
// testing.
//
// `marked` and `shiki` are pinned to the EXACT versions the frozen tree resolves
// (18.0.5 and 4.2.0, no caret). A byte comparison against a floating dependency would fail
// on a patch release and teach everyone to ignore it.
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
