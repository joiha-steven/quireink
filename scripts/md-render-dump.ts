// Render every fixture through the WHOLE pipeline and write the HTML out, for comparing two
// trees against each other.
//
// The point is that it runs `renderPostContent` — footnotes, callouts, figures, galleries,
// video embeds, Shiki — so what it dumps is the article body a reader is served, not the
// Markdown step in isolation. Run it once on the old tree and once on the new one, then diff
// the two directories with `diff -r`.
//
//   bun scripts/md-render-dump.ts <dir of .md> <out dir>

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderPostContent } from '@/render/post-content'

const [source, out] = process.argv.slice(2)
if (!source || !out) {
  console.error('usage: bun scripts/md-render-dump.ts <dir of .md> <out dir>')
  process.exit(1)
}

mkdirSync(out, { recursive: true })
const files = readdirSync(source).filter((f) => f.endsWith('.md')).sort()
for (const file of files) {
  const markdown = readFileSync(join(source, file), 'utf8')
  writeFileSync(join(out, file.replace(/\.md$/, '.html')), await renderPostContent({ markdown }))
}
console.log(`${files.length} bài -> ${out}`)
