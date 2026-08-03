// Seed a throwaway database with a post that exercises every island: fenced code for the
// copy button, two figures for the lightbox, and enough headings to scroll.
//
// Development only. It writes wherever DATA_DIR points, so it is run against `.tmp/run`,
// never against a real data directory.

import { openDatabases } from '@/store/db'
import { savePost } from '@/content/posts'
import { getSettings, saveSettings } from '@/content/settings'

openDatabases(process.env.DATA_DIR ?? './.tmp/run')

const { features } = await getSettings()
await saveSettings({
  title: 'Quire',
  description: 'Notes on building things',
  features: { ...features, progressBar: true },
})

const BODY = `A paragraph before anything else, so the page has something to read.

## Code

\`\`\`ts
const answer = 42
console.log(answer)
\`\`\`

## Pictures

![A red square](https://placehold.co/600x400/e11d48/fff.png)

![A blue square](https://placehold.co/600x400/2563eb/fff.png)

## Filler

${Array.from({ length: 30 }, (_, i) => `Paragraph ${i + 1} of filler, so the page scrolls.`).join('\n\n')}
`

await savePost({
  title: 'Every island at once',
  content: BODY,
  status: 'published',
  date: '2026-01-01T00:00:00.000Z',
  categories: ['engineering'],
})

console.log('seeded')
