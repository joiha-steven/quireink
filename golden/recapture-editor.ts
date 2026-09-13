// Re-capture `golden/editor/` — what an excused fixture publishes after ONE pass through the
// editor.
//
//   cd <repo root> && bun golden/recapture-editor.ts               # report only
//   cd <repo root> && bun golden/recapture-editor.ts --write       # write the spelling changes
//   cd <repo root> && bun golden/recapture-editor.ts --write --accept=a,b   # and these two moves
//
// ⚠️ `editor-corpus.test.ts` says of these files: "Re-capturing one to make a red check green
// turns this gate into a mirror." That is exactly right, and it is why this script refuses by
// default and refuses ALWAYS when a difference survives `html-equivalence.ts`'s ladder. The
// only thing `--write` alone will write is a change in how the same page is spelled.
//
// A real move — a word gone, a link flattened, a feature lost — comes out as REAL and nothing is
// written. Accepting one takes `--accept=<name>`, BY NAME, and that is the whole design: there
// is no flag that takes them all, so a page that moved for a reason nobody has looked at cannot
// ride in behind one that moved for a reason somebody has. Say in `MAY_DIFFER` what moved.
//
// The list of files is the directory itself: every excused fixture has one pinned answer, and
// `editor-corpus.test.ts` checks that the directory and `MAY_DIFFER` name the same set.

import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

GlobalRegistrator.register()

const { renderPostContent } = await import('@/render/post-content')
const { classify, firstDifference } = await import('@/render/html-equivalence')

const CORPUS = join(import.meta.dir, 'corpus')
const PINNED = join(import.meta.dir, 'editor')
const write = process.argv.includes('--write')
const accepted = new Set(
  (process.argv.find((a) => a.startsWith('--accept='))?.slice('--accept='.length) ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n !== ''),
)

async function roundTrip(source: string): Promise<string> {
  const { Editor } = await import('@tiptap/core')
  const { editorExtensions } = await import('@/admin/components/editorExtensions')
  const editor = new Editor({ extensions: editorExtensions(''), content: source })
  const out = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
  editor.destroy()
  return out
}

const files = readdirSync(PINNED).filter((f) => f.endsWith('.html')).sort()
const changed: { name: string; rung: string; actual: string }[] = []
const real: string[] = []
let same = 0

for (const file of files) {
  const name = file.replace(/\.html$/, '')
  const source = readFileSync(join(CORPUS, `${name}.md`), 'utf8')
  const expected = readFileSync(join(PINNED, file), 'utf8')
  const actual = await renderPostContent({ markdown: await roundTrip(source) })
  if (actual === expected) {
    same += 1
    continue
  }
  const kind = classify(expected, actual)
  if (kind === 'REAL' || kind === null) {
    if (accepted.has(name)) {
      changed.push({ name, rung: 'MOVED — accepted by name', actual })
      continue
    }
    real.push(`--- ${name}\n${firstDifference(expected, actual)}`)
    continue
  }
  changed.push({ name, rung: kind, actual })
}

console.log(`\n${files.length} pinned answer(s) in golden/editor`)
console.log(`  ${same} unchanged`)
for (const c of changed) console.log(`  ${c.name}: ${c.rung}`)
if (real.length > 0) {
  console.log(`\n${real.length} difference(s) a reader WOULD see — nothing was written:\n`)
  for (const r of real) console.log(`${r}\n`)
  GlobalRegistrator.unregister()
  process.exit(1)
}

if (!write) {
  console.log(`\nNothing written. Re-run with --write to accept the ${changed.length} above.`)
} else {
  for (const c of changed) writeFileSync(join(PINNED, `${c.name}.html`), c.actual, 'utf8')
  console.log(`\nwrote ${changed.length} answer(s)`)
}
GlobalRegistrator.unregister()
