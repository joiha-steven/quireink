// Puts a seeded instance into one cell of the theme matrix, through the product's own settings
// writer (the one Save uses), and adds the one post the seeder lacks: a single post carrying an
// image, a captioned figure, a table, a code block, a footnote and a series.
//
//   DATA_DIR=<dir> bun scripts/theme-matrix-setup.ts fixture
//   DATA_DIR=<dir> bun scripts/theme-matrix-setup.ts cell <look> <list|front> <image|text>
import { openDatabases } from '@/store/db'
import type { SiteLook } from '@/types'

openDatabases(process.env.DATA_DIR ?? './data')
const { getSettings, saveSettings } = await import('@/content/settings')
const { savePost } = await import('@/content/posts')

const [command, look, mode, kind] = process.argv.slice(2)

const BODY = `A fixture post that carries every block the reading column draws, so one page shows them all[^1].

![A leaf of the Gutenberg Bible: two columns of forty-two lines, gathered in quires of five folded sheets](/uploads/media/gutenberg-bible-epistle.jpg#right-third)

## A table

| Trade | Who | Does |
|---|---|---|
| Eshi | the designer | brush drawing, colour notes |
| Horishi | the block cutter | one block per colour |
| Surishi | the printer | inks, registers, pulls each sheet |

## Code

\`\`\`ts
export function measure(chars: number): string {
  // 45 to 75 characters is the comfortable range.
  return chars < 45 ? 'short' : chars > 75 ? 'long' : 'good'
}
\`\`\`

Inline \`code\` sits in a sentence, and a quotation follows.

> The measure is the design.

![The Great Wave off Kanagawa, from Thirty-six Views of Mount Fuji, about 1831](/uploads/media/hokusai-great-wave.jpg)

[^1]: The footnote, which belongs at the foot of the page.
`

if (command === 'fixture') {
  await savePost({
    title: 'Every block in one post', slug: 'matrix-every-block', status: 'published',
    date: '2026-07-29T10:00:00.000Z',
    content: BODY, excerpt: 'One post with a figure, a table, code, a footnote and a series.',
    categories: ['Printing'], tags: ['craft', 'colour'],
    series: 'Ink and press', seriesOrder: 5,
    featuredImage: '/uploads/media/gutenberg-bible-epistle.jpg',
  })
  console.log('fixture post added')
} else if (command === 'cell') {
  const overrides = JSON.parse(process.env.THEME_MATRIX_OVERRIDES ?? '{}') as Record<string, unknown>
  const before = await getSettings()
  const wantMode = mode === 'front' ? 'front' : 'list'
  const wantKind = kind === 'image' ? 'image' : 'text'
  await saveSettings({
    ...before,
    ...overrides,
    look: look as SiteLook,
    home: { ...before.home, mode: wantMode, front: { ...before.home.front, kind: wantKind } },
  })
  // The sanitiser may quietly drop a value it does not accept; a cell photographed with the
  // wrong settings is worse than no cell, so what was asked for is read back and checked.
  const after = await getSettings()
  const wrong: string[] = []
  if (after.look !== look) wrong.push(`look ${after.look} != ${look}`)
  if (after.home.mode !== wantMode) wrong.push(`home.mode ${after.home.mode} != ${wantMode}`)
  if (after.home.front.kind !== wantKind) wrong.push(`home.front.kind ${after.home.front.kind} != ${wantKind}`)
  const saved = after as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(overrides)) {
    if (JSON.stringify(saved[key]) !== JSON.stringify(value)) {
      wrong.push(`${key} is ${JSON.stringify(saved[key])}, asked for ${JSON.stringify(value)}`)
    }
  }
  if (wrong.length) throw new Error(`settings were not saved as asked: ${wrong.join('; ')}`)
  console.log(`look=${after.look} home=${after.home.mode} kind=${after.home.front.kind} scheme=${after.defaultScheme} palette=${after.themePreset} overrides=${JSON.stringify(overrides)}`)
} else {
  throw new Error('usage: theme-matrix-setup.ts fixture | cell <look> <list|front> <image|text>')
}
