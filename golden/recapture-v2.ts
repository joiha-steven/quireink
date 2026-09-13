// Re-capture `golden/v2/corpus/` — what THIS tree prints for a deliberately diverged fixture.
//
//   cd <repo root> && bun golden/recapture-v2.ts          # report only
//   cd <repo root> && bun golden/recapture-v2.ts --write  # report, then write
//
// ⚠️ RE-CAPTURING A REFERENCE IS HOW A GATE GETS SWITCHED OFF WITHOUT ANYONE SAYING SO. The
// v2 answers are a byte contract, and a script that silently overwrites them turns every
// future failure into a shrug. So this one REFUSES BY DEFAULT: it prints what would change,
// classified through `html-equivalence.ts`'s ladder, and writes nothing unless told to — and
// it will not write at all if any difference survives the ladder, because a difference a
// reader can see is a decision, not a capture.
//
// `golden/v1/corpus` is never touched by anything. That is the frozen tree's own output and
// the only reason the word "identical" means something here.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderPostContent } from '@/render/post-content'
import { classify, firstDifference } from '@/render/html-equivalence'

const CORPUS = join(import.meta.dir, 'corpus')
const V2 = join(import.meta.dir, 'v2', 'corpus')
const write = process.argv.includes('--write')

const names = readFileSync(join(import.meta.dir, 'v2', 'names.txt'), 'utf8')
  .split('\n')
  .map((n) => n.trim())
  .filter((n) => n !== '' && !n.startsWith('#'))

const changed: { name: string; rung: string; actual: string }[] = []
const real: string[] = []
let same = 0

for (const name of names) {
  const markdown = readFileSync(join(CORPUS, `${name}.md`), 'utf8')
  const expected = readFileSync(join(V2, `${name}.html`), 'utf8')
  const actual = await renderPostContent({ markdown })
  if (actual === expected) {
    same += 1
    continue
  }
  const kind = classify(expected, actual)
  if (kind === 'REAL' || kind === null) {
    real.push(`--- ${name}\n${firstDifference(expected, actual)}`)
    continue
  }
  changed.push({ name, rung: kind, actual })
}

console.log(`\n${names.length} fixture(s) in golden/v2`)
console.log(`  ${same} unchanged`)
for (const c of changed) console.log(`  ${c.name}: ${c.rung}`)
if (real.length > 0) {
  console.log(`\n${real.length} difference(s) a reader WOULD see — nothing was written:\n`)
  for (const r of real) console.log(`${r}\n`)
  process.exit(1)
}

if (!write) {
  console.log(`\nNothing written. Re-run with --write to accept the ${changed.length} above.`)
  process.exit(0)
}
for (const c of changed) writeFileSync(join(V2, `${c.name}.html`), c.actual, 'utf8')
console.log(`\nwrote ${changed.length} reference(s)`)
