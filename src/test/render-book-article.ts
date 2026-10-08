// Renders two real articles through the server and prints their HTML as JSON on stdout,
// after the line marker `@@BOOK-ARTICLE@@`.
//
// For book-title.test.ts, which runs book mode's `fillFlow` over what the server actually
// writes. That test lives with the islands, whose tsconfig has the DOM lib and no server
// modules; importing the app there would pull the whole server into a project it does not
// compile in. A child process keeps each half in its own project.
import { freshDatabase, dropDatabase } from '@/test/db'
import { createApp } from '@/web/app'
import { savePost } from '@/content/posts'
import { saveSettings } from '@/content/settings-save'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { clearCache } from '@/server/cache'

export const MARK = '@@BOOK-ARTICLE@@'
type Input = Parameters<typeof savePost>[0]
const DIR = './.tmp/test-book-title-render'
freshDatabase(DIR)
try {
  const app = createApp()
  resetSecretCache(); resetLimits(); clearCache()
  await saveSettings({ author: { name: 'Ada Lovelace' } } as Parameters<typeof saveSettings>[0])
  const base = { content: 'Body words here.\n\n## A section\n\nMore.', status: 'published',
    date: new Date(Date.now() - 3_600_000).toISOString() }
  await savePost({ ...base, title: 'A real headline', slug: 'real-headline', categories: ['Typography'],
    excerpt: 'The written standfirst.' } as Input)
  await savePost({ ...base, title: '', slug: 'no-title-here', categories: ['Typography'] } as Input)
  clearCache()
  const titled = await (await app.request('/real-headline')).text()
  const untitled = await (await app.request('/no-title-here')).text()
  // After a marker: the request log shares stdout.
  process.stdout.write(`\n${MARK}${JSON.stringify({ titled, untitled })}`)
} finally {
  dropDatabase(DIR)
}
