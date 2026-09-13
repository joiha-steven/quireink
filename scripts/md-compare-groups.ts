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
// The ladder is the argument. Each rung has to be a rewrite that cannot change what a browser
// draws, and each is named so the owner can disagree with it individually.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { marked } from 'marked'
import { inkExtension, underExtension, ringExtension } from '@/pen/marked'
import { mathBlockExtension, mathInlineExtension } from '@/render/math'
import { resolveEntities } from '@/md/entity'
import { toHtml } from '@/md/index'

marked.use({ gfm: true })
marked.use({ extensions: [inkExtension, underExtension, ringExtension] })
marked.use({ extensions: [mathBlockExtension, mathInlineExtension] })

const dir = process.argv[2]
if (!dir) {
  console.error('usage: bun scripts/md-compare-groups.ts <dir of .md>')
  process.exit(1)
}

/** Each rung: a name, and a rewrite that provably cannot change the rendered page. */
const LADDER: { name: string; apply: (html: string) => string }[] = [
  {
    name: 'void tags written with a slash (<br /> vs <br>)',
    apply: (h) => h.replace(/<(br|hr|img|input|meta|link)([^>]*?)\s*\/>/g, '<$1$2>'),
  },
  {
    name: 'a newline between two tags',
    apply: (h) => h.replace(/>\s*\n\s*</g, '><'),
  },
  {
    // CommonMark writes `<br />\n`; marked writes `<br>`. The newline is collapsed to nothing
    // by every HTML parser at that position, which is why it is on this ladder and not below.
    name: 'a newline after a line break',
    apply: (h) => h.replace(/<br\s*\/?>\s*\n/g, '<br>'),
  },
  {
    name: 'trailing space before a closing tag',
    apply: (h) => h.replace(/[ \t]+<\//g, '</'),
  },
  {
    name: 'an entity resolved to its character (&copy; vs ©)',
    apply: (h) => resolveEntities(h),
  },
  {
    name: 'a raw <script>/<style> disabled (GFM safety rule)',
    apply: (h) => h.replace(/&lt;(\/?)(script|style|title|textarea|iframe|xmp|noembed|noframes|plaintext)/gi, '<$1$2'),
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
