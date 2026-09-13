// The two engines, on the same Markdown, byte for byte.
//
// ADR 0052's fourth safety layer and the one the owner's decision rests on: the pages that
// exist do not change. This renders a corpus through `marked` — the engine that draws every
// published post today, with this blog's own extensions loaded — and through `src/md`, and
// reports every difference.
//
// IT COMPARES THE PARSE, NOT THE PAGE. `render/post-content.ts` runs eight passes over
// marked's HTML afterwards (callouts, figures, galleries, videos, tables, heading ids, task
// items, highlighting) and those passes are not changing. What is changing is the one call
// underneath them, so that call is what is measured. A difference here is a difference on the
// page; a difference anywhere else would be a bug in a pass neither engine touches.
//
// Usage:
//   bun scripts/md-compare.ts golden          the 45 golden fixtures
//   bun scripts/md-compare.ts <dir>           every .md file under a directory
//   bun scripts/md-compare.ts <dir> --full    print the differing HTML, not just the count
//
// The corpus for the real comparison — manhhung.me's 78 posts — is fetched into `.tmp/` over
// the blog's own MCP server and never enters this repository: it is the owner's writing, and
// rule one here is zero personal data.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { marked } from 'marked'
import { inkExtension, underExtension, ringExtension } from '@/pen/marked'
import { mathBlockExtension, mathInlineExtension } from '@/render/math'
import { toHtml } from '@/md/index'

marked.use({ gfm: true })
marked.use({ extensions: [inkExtension, underExtension, ringExtension] })
marked.use({ extensions: [mathBlockExtension, mathInlineExtension] })

const [target = 'golden', ...flags] = process.argv.slice(2)
const full = flags.includes('--full')

const dir = target === 'golden' ? 'golden/corpus' : target

function everyMarkdownFile(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name)
    if (statSync(path).isDirectory()) return everyMarkdownFile(path)
    return name.endsWith('.md') ? [path] : []
  })
}

/**
 * The first line on which the two outputs part company.
 *
 * A whole-file diff of two 400-line HTML documents is not something anybody reads, and the
 * question being asked is narrow: WHERE, and what did each say there.
 */
function firstDifference(a: string, b: string): { line: number; mine: string; theirs: string } | null {
  const left = a.split('\n')
  const right = b.split('\n')
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i] !== right[i]) {
      return { line: i + 1, theirs: left[i] ?? '(ends here)', mine: right[i] ?? '(ends here)' }
    }
  }
  return null
}

const files = everyMarkdownFile(dir).sort()
if (files.length === 0) {
  console.error(`no .md files under ${dir}`)
  process.exit(1)
}

let same = 0
const differ: { file: string; at: ReturnType<typeof firstDifference> }[] = []

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const theirs = await marked.parse(source)
  const mine = toHtml(source)
  if (theirs === mine) {
    same += 1
    continue
  }
  differ.push({ file, at: firstDifference(theirs, mine) })
  if (full) {
    console.log(`\n===== ${file} =====`)
    console.log('--- marked ---')
    console.log(theirs)
    console.log('--- src/md ---')
    console.log(mine)
  }
}

console.log(`\n${same}/${files.length} identical, ${differ.length} differ`)
for (const { file, at } of differ) {
  console.log(`\n  ${file}${at ? `  (line ${at.line})` : ''}`)
  if (at) {
    console.log(`    marked: ${JSON.stringify(at.theirs.slice(0, 160))}`)
    console.log(`    src/md: ${JSON.stringify(at.mine.slice(0, 160))}`)
  }
}

process.exit(differ.length === 0 ? 0 : 1)
