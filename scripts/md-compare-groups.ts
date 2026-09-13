// The comparison, sorted into the kinds of difference rather than listed one by one.
//
// `md-compare.ts` answers "which files differ". On a real corpus that is 67 lines nobody
// reads, and the useful question is the other one: WHAT KINDS of difference are there, and
// which of them would a reader ever see.
//
// So each difference is normalised through a ladder of known-harmless rewrites — a void tag
// written `<br />` instead of `<br>`, a newline between two block tags, an entity resolved to
// the character it names — and whatever SURVIVES that ladder is a real difference, printed in
// full. A difference that dissolves at a rung is counted under that rung's name.
//
// THE LADDER IS SHARED with `render/html-equivalence.ts`, which is what the golden gate holds
// itself to. It used to be copied here, and a copy is a second definition of "the same page"
// that agrees with the first until the day one of them is corrected. The one rung below is the
// exception, and it is here because it is NOT harmless in general.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { marked } from 'marked'
import { inkExtension, underExtension, ringExtension } from '@/pen/marked'
import { mathBlockExtension, mathInlineExtension } from '@/render/math'
import { LADDER as SHARED } from '@/render/html-equivalence'
import { toHtml } from '@/md/index'

marked.use({ gfm: true })
marked.use({ extensions: [inkExtension, underExtension, ringExtension] })
marked.use({ extensions: [mathBlockExtension, mathInlineExtension] })

const dir = process.argv[2]
if (!dir) {
  console.error('usage: bun scripts/md-compare-groups.ts <dir of .md>')
  process.exit(1)
}

/**
 * The shared ladder, plus the one rung that belongs only to this comparison.
 *
 * ⚠️ THE EXTRA RUNG UNDOES A SAFETY RULE, which is why it is not in the shared ladder and must
 * never be moved there. `marked` hands a raw `<script>` through and the engine escapes it, and
 * calling that "the same page" is true of nothing except this one question: whether the two
 * PARSERS found the same structure. Anywhere else it would dissolve exactly the difference
 * that matters.
 */
const LADDER = [
  ...SHARED,
  {
    name: 'a raw <script>/<style> disabled (GFM safety rule)',
    apply: (h: string) => h.replace(/&lt;(\/?)(script|style|title|textarea|iframe|xmp|noembed|noframes|plaintext)/gi, '<$1$2'),
  },
]

function classify(a: string, b: string): string | null {
  let left = a
  let right = b
  for (const rung of LADDER) {
    if (left === right) return null
    const nextLeft = rung.apply(left)
    const nextRight = rung.apply(right)
    // The rung dissolved it, so THIS is what the difference was.
    if (nextLeft === nextRight && left !== right) return rung.name
    left = nextLeft
    right = nextRight
  }
  return left === right ? null : 'REAL'
}

const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
const counts = new Map<string, number>()
const real: { file: string; marked: string; mine: string }[] = []

for (const file of files) {
  const source = readFileSync(join(dir, file), 'utf8')
  const theirs = await marked.parse(source)
  const mine = toHtml(source)
  if (theirs === mine) {
    counts.set('identical', (counts.get('identical') ?? 0) + 1)
    continue
  }
  const kind = classify(theirs, mine)
  if (kind === null) {
    counts.set('identical', (counts.get('identical') ?? 0) + 1)
    continue
  }
  counts.set(kind, (counts.get(kind) ?? 0) + 1)
  if (kind === 'REAL') {
    // The first line that still differs after the whole ladder, with room to read it.
    const l = theirs.split('\n')
    const r = mine.split('\n')
    for (let i = 0; i < Math.max(l.length, r.length); i++) {
      if (l[i] !== r[i]) {
        real.push({ file, marked: l[i] ?? '(ends)', mine: r[i] ?? '(ends)' })
        break
      }
    }
  }
}

console.log(`\n${files.length} file(s)\n`)
for (const [kind, n] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${kind}`)
}

if (real.length > 0) {
  console.log(`\n----- differences a reader could see (${real.length}) -----`)
  for (const r of real) {
    console.log(`\n  ${r.file}`)
    console.log(`    marked: ${r.marked.slice(0, 400)}`)
    console.log(`    src/md: ${r.mine.slice(0, 400)}`)
  }
}
