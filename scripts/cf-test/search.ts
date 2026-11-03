// The reader's search inside a Durable Object, for `bun run test:cf`.
//
// A query that opens with a d is asked for with a đ as well (`content/fts-word.ts`), which makes
// the MATCH text grouped `OR`s rather than plain phrases. The object's SQLite is its own build of
// FTS5, so the grammar is proven here and not only under Bun (`src/content/posts.test.ts`).
import { openDatabases } from '@/store/db'
import { savePost, searchPosts } from '@/content/posts'

export async function searchFindsStroke(): Promise<void> {
  openDatabases('./data')
  await savePost({ title: 'Đường về nhà', content: 'Người đọc lề sách', status: 'published', date: '2020-01-01T00:00:00.000Z' })
  for (const q of ['duong', 'DUONG', 'nguoi doc', 'đường']) {
    const found = (await searchPosts(q)).map((p) => p.slug)
    if (!found.includes('duong-ve-nha')) throw new Error(`"${q}" did not find "Đường về nhà": ${JSON.stringify(found)}`)
  }
}
