// The golden corpus, rendered by this tree and sorted by WHAT KIND of difference is left.
//
// `golden.test.ts` is the gate; this is the instrument you reach for when the gate goes red and
// you need to know whether it went red about whitespace or about a sentence. It renders every
// fixture through the whole pipeline — footnotes, callouts, figures, Shiki — and runs each
// difference down `html-equivalence.ts`'s ladder, counting what dissolves at each rung and
// printing in full whatever survives.
//
// The ladder is shared with the gate deliberately. A second copy of it here would be a second
// definition of "the same page", and the two would disagree on the day it mattered.
//
//   bun scripts/md-golden-groups.ts

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderPostContent } from '@/render/post-content'
import { classify, firstDifference } from '@/render/html-equivalence'

const ROOT = join(import.meta.dir, '..', 'golden')
const CORPUS = join(ROOT, 'corpus')
const V2 = join(ROOT, 'v2', 'corpus')

const v2Names = new Set(readdirSync(V2).filter((f) => f.endsWith('.html')))
const files = readdirSync(CORPUS).filter((f) => f.endsWith('.md')).sort()
const counts = new Map<string, number>()
const real: { name: string; diff: string }[] = []

for (const file of files) {
  const name = file.replace(/\.md$/, '')
  const markdown = readFileSync(join(CORPUS, file), 'utf8')
  // The v2 answer where one exists: those fixtures already diverge from 1.x on purpose, so
  // comparing them against 1.x would report a difference that was decided long ago.
  const reference = readFileSync(
    v2Names.has(`${name}.html`) ? join(V2, `${name}.html`) : join(ROOT, 'v1', 'corpus', `${name}.html`),
    'utf8',
  )
  const actual = await renderPostContent({ markdown })
  const kind = classify(reference, actual)
  if (kind === null) {
    counts.set('byte-identical', (counts.get('byte-identical') ?? 0) + 1)
    continue
  }
  if (kind === 'REAL') {
    real.push({ name, diff: firstDifference(reference, actual) })
    continue
  }
  counts.set(kind, (counts.get(kind) ?? 0) + 1)
}

console.log(`\n${files.length} fixture(s) in golden/corpus\n`)
for (const [kind, n] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${kind}`)
}
console.log(`  ${String(real.length).padStart(3)}  REAL — a reader would see it\n`)

for (const r of real) {
  console.log(`--- ${r.name}`)
  console.log(r.diff)
  console.log()
}
